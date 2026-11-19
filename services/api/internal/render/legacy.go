package render

import (
	"bytes"
	"regexp"
	"strings"
	"unicode/utf16"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"
)

var legacyMarkdown = goldmark.New(goldmark.WithExtensions(extension.GFM), goldmark.WithParserOptions(
	parser.WithBlockParsers(util.Prioritized(&positionedATX{parser.NewATXHeadingParser()}, 550)),
))

type positionedATX struct{ parser.BlockParser }

func (p *positionedATX) Open(parent ast.Node, reader text.Reader, context parser.Context) (ast.Node, parser.State) {
	_, segment := reader.PeekLine()
	node, state := p.BlockParser.Open(parent, reader, context)
	// Empty ATX headings still participate in legacy slug collisions and need
	// their source line. Goldmark otherwise stores no segment for these nodes.
	if node != nil && node.Lines().Len() == 0 {
		node.Lines().Append(text.NewSegment(segment.Start, segment.Start))
	}
	return node, state
}

var excerptImageHTML = regexp.MustCompile(`(?i)<img\b[^>]*>`)
var excerptEmphasis = regexp.MustCompile(`[*_]{1,2}(.*?)[*_]{1,2}`)
var excerptCode = regexp.MustCompile("`([^`]+)`")

func Excerpt(markdown, title string) string {
	source := []byte(markdown)
	document := legacyMarkdown.Parser().Parse(text.NewReader(source))
	result := ""
	_ = ast.Walk(document, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering || (node.Kind() != ast.KindParagraph && node.Kind() != ast.KindTextBlock) {
			return ast.WalkContinue, nil
		}
		value := string(node.Lines().Value(source))
		value = imageMarkup.ReplaceAllString(value, " ")
		value = excerptImageHTML.ReplaceAllString(value, " ")
		value = htmlTag.ReplaceAllString(value, "")
		value = linkMarkup.ReplaceAllString(value, "${1}")
		value = excerptEmphasis.ReplaceAllString(value, "${1}")
		value = excerptCode.ReplaceAllString(value, "${1}")
		value = collapseWhitespace(value)
		if value != "" && !strings.EqualFold(value, "[toc]") {
			result = value
			return ast.WalkStop, nil
		}
		return ast.WalkContinue, nil
	})
	if result == "" {
		result = "A deep dive into " + title + "."
	}
	units := utf16.Encode([]rune(result))
	if len(units) > 150 {
		return string(utf16.Decode(units[:150])) + "..."
	}
	return result
}

type Heading struct {
	ID    string `json:"id"`
	Level int    `json:"level"`
	Text  string `json:"text"`
	Line  int    `json:"line"`
}

func LegacyHeadings(markdown string) []Heading {
	source := []byte(strings.ReplaceAll(markdown, "\r\n", "\n"))
	document := legacyMarkdown.Parser().Parse(text.NewReader(source))
	slugger := NewSlugger()
	headings := make([]Heading, 0)
	_ = ast.Walk(document, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		heading, ok := node.(*ast.Heading)
		if !ok || heading.Level < 2 || heading.Level > 4 {
			return ast.WalkContinue, nil
		}
		value := legacyHeadingText(heading, source)
		id := slugger.HeadingID(value)
		if id != "" {
			segment := heading.Lines().At(0)
			headings = append(headings, Heading{ID: id, Level: heading.Level, Text: collapseWhitespace(value), Line: bytes.Count(source[:segment.Start], []byte("\n"))})
		}
		return ast.WalkSkipChildren, nil
	})
	return headings
}

func legacyHeadingText(heading ast.Node, source []byte) string {
	var result strings.Builder
	_ = ast.Walk(heading, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		var value []byte
		switch n := node.(type) {
		case *ast.Image, *ast.RawHTML:
			return ast.WalkSkipChildren, nil
		case *ast.Text:
			value = n.Segment.Value(source)
			if !n.IsRaw() && n.Parent().Kind() != ast.KindCodeSpan {
				value = util.ResolveEntityNames(util.ResolveNumericReferences(util.UnescapePunctuations(value)))
			}
		case *ast.String:
			value = n.Value
		case *ast.AutoLink:
			value = n.Label(source)
		}
		result.WriteString(htmlTag.ReplaceAllString(strings.ReplaceAll(string(value), "\n", " "), ""))
		return ast.WalkContinue, nil
	})
	return result.String()
}
