package render

import (
	"compress/gzip"
	"encoding/json"
	"os"
	"sort"
	"strings"
	"testing"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

func canonicalHTML(t *testing.T, source string) string {
	t.Helper()
	nodes, err := html.ParseFragment(strings.NewReader(source), &html.Node{Type: html.ElementNode, Data: "body", DataAtom: atom.Body})
	if err != nil {
		t.Fatal(err)
	}
	var normalize func(*html.Node)
	normalize = func(node *html.Node) {
		sort.Slice(node.Attr, func(i, j int) bool { return node.Attr[i].Key < node.Attr[j].Key })
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			normalize(child)
		}
	}
	var result strings.Builder
	for _, node := range nodes {
		normalize(node)
		if err := html.Render(&result, node); err != nil {
			t.Fatal(err)
		}
	}
	return result.String()
}

func TestArticleSanitizerTypeScriptParity(t *testing.T) {
	file, err := os.Open("testdata/sanitizer.json.gz")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	reader, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	var cases []struct{ Name, Raw, Expected string }
	if err := json.NewDecoder(reader).Decode(&cases); err != nil {
		t.Fatal(err)
	}
	for _, item := range cases {
		t.Run(item.Name, func(t *testing.T) {
			actual, err := SanitizeArticleHTML(item.Raw)
			if err != nil {
				t.Fatal(err)
			}
			a, b := canonicalHTML(t, actual), canonicalHTML(t, item.Expected)
			if a != b {
				i := 0
				for i < min(len(a), len(b)) && a[i] == b[i] {
					i++
				}
				t.Errorf("first difference at byte %d: Go=%q TS=%q", i, a[max(0, i-50):min(len(a), i+150)], b[max(0, i-50):min(len(b), i+150)])
			}
		})
	}
}
