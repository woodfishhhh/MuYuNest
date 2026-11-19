package render

import (
	"compress/gzip"
	"encoding/json"
	"os"
	"testing"
)

func TestSluggerTypeScriptParity(t *testing.T) {
	file, err := os.Open("testdata/slugs.json.gz")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	reader, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	var sequences []struct {
		Name             string
		Heading          bool
		Inputs, Expected []string
	}
	if err := json.NewDecoder(reader).Decode(&sequences); err != nil {
		t.Fatal(err)
	}
	for _, sequence := range sequences {
		t.Run(sequence.Name, func(t *testing.T) {
			slugger := NewSlugger()
			for i, input := range sequence.Inputs {
				var actual string
				if sequence.Heading {
					actual = slugger.HeadingID(input)
				} else {
					actual = slugger.Slug(input)
				}
				if actual != sequence.Expected[i] {
					t.Errorf("input %q: Go=%q TS=%q", input, actual, sequence.Expected[i])
				}
			}
		})
	}
}
