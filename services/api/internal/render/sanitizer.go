// DOMPurify compatibility rules are adapted from DOMPurify 3.4.3.
// Copyright 2025-2026 Dr.-Ing. Mario Heiderich, Cure53.
// Licensed under Apache-2.0 OR MPL-2.0; see DOMPurify.LICENSE.
package render

import (
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

var articleTags = []string{"h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "ul", "ol", "li", "blockquote", "pre", "code", "strong", "em", "del", "s", "mark", "sup", "sub", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "div", "span", "details", "summary"}
var articleAttrs = []string{"href", "src", "alt", "title", "class", "id", "loading", "decoding", "target", "rel", "width", "height", "colspan", "rowspan"}
var articleURI = regexp.MustCompile(`(?i)^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))`)
var attrURIWhitespace = regexp.MustCompile(`[\x{0000}-\x{0020}\x{00a0}\x{1680}\x{180e}\x{2000}-\x{2029}\x{205f}\x{3000}]`)
var articleARIA = regexp.MustCompile(`(?i)^aria-[\w-]+$`)

func SanitizeArticleHTML(raw string) (string, error) {
	nodes, err := html.ParseFragment(strings.NewReader(raw), &html.Node{Type: html.ElementNode, Data: "body", DataAtom: atom.Body})
	if err != nil {
		return "", err
	}
	aria := map[string]bool{}
	var filter func(*html.Node)
	filter = func(node *html.Node) {
		attrs := node.Attr[:0]
		for _, attr := range node.Attr {
			attr.Val = strings.TrimFunc(attr.Val, func(r rune) bool { return jsWhitespace.MatchString(string(r)) })
			if attr.Key == "id" && clobberedArticleIDs[attr.Val] {
				continue
			}
			if articleARIA.MatchString(attr.Key) {
				aria[attr.Key] = true
				attrs = append(attrs, attr)
				continue
			}
			safe := attr.Key == "alt" || attr.Key == "class" || attr.Key == "id" || attr.Key == "title"
			dataImage := node.Data == "img" && (attr.Key == "src" || attr.Key == "href") && strings.HasPrefix(attr.Val, "data:")
			if safe || dataImage || attr.Val == "" || articleURI.MatchString(attrURIWhitespace.ReplaceAllString(attr.Val, "")) {
				attrs = append(attrs, attr)
			}
		}
		node.Attr = attrs
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			filter(child)
		}
	}
	var normalized strings.Builder
	for _, node := range nodes {
		filter(node)
		if err := html.Render(&normalized, node); err != nil {
			return "", err
		}
	}
	policy := bluemonday.NewPolicy()
	policy.AllowElements(articleTags...)
	policy.AllowNoAttrs().OnElements(articleTags...)
	policy.AllowAttrs(articleAttrs...).Globally()
	for name := range aria {
		policy.AllowAttrs(name).Globally()
	}
	// Match DOMPurify's dropped subtrees, while allowing the content of ordinary
	// unsupported wrappers. URL attributes were checked once on the parsed DOM.
	policy.AllowElementsContent("object", "nostyle")
	policy.SkipElementsContent("annotation-xml", "audio", "colgroup", "desc", "foreignobject", "head", "iframe", "math", "mi", "mn", "mo", "ms", "mtext", "noembed", "noframes", "noscript", "plaintext", "script", "style", "svg", "template", "title", "video", "xmp")
	return policy.Sanitize(normalized.String()), nil
}
