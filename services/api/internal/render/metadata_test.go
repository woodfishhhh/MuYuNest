package render

import (
	"compress/gzip"
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

func TestMetadataTypeScriptParity(t *testing.T) {
	file, err := os.Open("testdata/metadata.json.gz")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	reader, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	var cases []struct {
		Name                    string
		Input                   SearchInput
		Stripped, Plain, Search string
		Reading                 int
		Excerpt                 string
		Headings                []Heading
	}
	if err := json.NewDecoder(reader).Decode(&cases); err != nil {
		t.Fatal(err)
	}
	if len(cases) < 246 {
		t.Fatalf("corpus unexpectedly small: %d", len(cases))
	}
	for _, item := range cases {
		t.Run(item.Name, func(t *testing.T) {
			if actual := StripFencedCodeBlocks(item.Input.Markdown); actual != item.Stripped {
				t.Error("fenced-code stripping differs")
			}
			if actual := SearchablePlainText(item.Input.Markdown); actual != item.Plain {
				t.Error("searchable plain text differs")
			}
			if actual := ReadingMinutes(item.Input.Markdown); actual != item.Reading {
				t.Errorf("reading minutes Go=%d TS=%d", actual, item.Reading)
			}
			if actual := SearchText(item.Input); actual != item.Search {
				t.Error("search text differs")
			}
			if actual := Excerpt(item.Input.Markdown, item.Input.Title); actual != item.Excerpt {
				t.Errorf("excerpt Go=%q TS=%q", actual, item.Excerpt)
			}
			if actual := LegacyHeadings(item.Input.Markdown); !reflect.DeepEqual(actual, item.Headings) {
				for i := 0; i < max(len(actual), len(item.Headings)); i++ {
					if i >= len(actual) || i >= len(item.Headings) {
						t.Errorf("heading count Go=%d TS=%d", len(actual), len(item.Headings))
						break
					}
					if actual[i] != item.Headings[i] {
						t.Errorf("heading %d Go=%+v TS=%+v", i, actual[i], item.Headings[i])
						break
					}
				}
			}
		})
	}
}
