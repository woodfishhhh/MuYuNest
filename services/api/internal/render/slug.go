package render

import (
	"sort"
	"strconv"
	"strings"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

// Slugger follows github-slugger's collision sequence, including collisions with
// explicit numeric suffixes. Create one per article, not one per heading.
type Slugger struct{ occurrences map[string]int }

func NewSlugger() *Slugger { return &Slugger{occurrences: make(map[string]int)} }

func (s *Slugger) Slug(value string) string {
	value = cases.Lower(language.Und).String(value)
	result := strings.Map(func(r rune) rune {
		index := sort.Search(len(slugRemovedRanges), func(i int) bool { return slugRemovedRanges[i].hi >= r })
		if index < len(slugRemovedRanges) && slugRemovedRanges[index].lo <= r {
			return -1
		}
		if r == ' ' {
			return '-'
		}
		return r
	}, value)
	original := result
	for {
		if _, exists := s.occurrences[result]; !exists {
			break
		}
		s.occurrences[original]++
		result = original + "-" + strconv.Itoa(s.occurrences[original])
	}
	s.occurrences[result] = 0
	return result
}

func (s *Slugger) HeadingID(text string) string {
	text = htmlTag.ReplaceAllString(text, "")
	text = strings.NewReplacer("&", " ", "+", " ").Replace(text)
	return s.Slug(collapseWhitespace(text))
}
