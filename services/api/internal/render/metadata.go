package render

import (
	"regexp"
	"strings"
	"unicode"
)

var (
	fenceOpen         = regexp.MustCompile("^[ \\t]*(`{3,}|~{3,})")
	fenceClose        = regexp.MustCompile("^[ \\t]*(`{3,}|~{3,})[ \\t]*$")
	inlineCode        = regexp.MustCompile("`[^`]+`")
	imageMarkup       = regexp.MustCompile(`!\[[^\]]*\]\([^)]+\)`)
	linkMarkup        = regexp.MustCompile(`\[([^\]]+)\]\([^)]+\)`)
	htmlTag           = regexp.MustCompile(`<[^>]+>`)
	searchPunctuation = regexp.MustCompile(`[#>*_~-]`)
	// ECMAScript whitespace includes BOM, but excludes Unicode NEL (U+0085).
	jsWhitespace = regexp.MustCompile(`[\t\n\v\f\r \x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]+`)
)

func collapseWhitespace(value string) string {
	return strings.Trim(jsWhitespace.ReplaceAllString(value, " "), " ")
}

func StripFencedCodeBlocks(markdown string) string {
	var output []string
	var marker byte
	length := 0
	for _, line := range strings.Split(strings.ReplaceAll(markdown, "\r\n", "\n"), "\n") {
		if marker == 0 {
			opening := fenceOpen.FindStringSubmatch(line)
			if opening == nil {
				output = append(output, line)
				continue
			}
			marker = opening[1][0]
			length = len(opening[1])
			output = append(output, "")
			continue
		}
		closing := fenceClose.FindStringSubmatch(line)
		if closing != nil && closing[1][0] == marker && len(closing[1]) >= length {
			marker = 0
			output = append(output, "")
		}
	}
	return strings.Join(output, "\n")
}

func SearchablePlainText(markdown string) string {
	text := StripFencedCodeBlocks(markdown)
	text = inlineCode.ReplaceAllString(text, " ")
	text = imageMarkup.ReplaceAllString(text, " ")
	text = linkMarkup.ReplaceAllString(text, " ${1} ")
	text = htmlTag.ReplaceAllString(text, " ")
	text = searchPunctuation.ReplaceAllString(text, " ")
	return collapseWhitespace(text)
}

func ReadingMinutes(markdown string) int {
	plain := SearchablePlainText(markdown)
	cjk := 0
	other := strings.Map(func(r rune) rune {
		if unicode.In(r, unicode.Han, unicode.Hiragana, unicode.Katakana, unicode.Hangul) {
			cjk++
			return ' '
		}
		return r
	}, plain)
	words := 0
	if text := collapseWhitespace(other); text != "" {
		words = len(strings.Split(text, " "))
	}
	return max(1, (cjk+words+219)/220)
}

type SearchInput struct {
	Title      string   `json:"title"`
	Type       string   `json:"type"`
	Categories []string `json:"categories"`
	Tags       []string `json:"tags"`
	Markdown   string   `json:"markdown"`
}

func SearchText(input SearchInput) string {
	return collapseWhitespace(strings.Join([]string{input.Title, input.Type, strings.Join(input.Categories, " "), strings.Join(input.Tags, " "), SearchablePlainText(input.Markdown)}, " "))
}
