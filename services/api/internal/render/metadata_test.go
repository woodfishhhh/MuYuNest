package render

import (
	"compress/gzip"
	"encoding/json"
	"os"
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
		})
	}
}
