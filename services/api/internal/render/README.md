# Content renderer migration

The helpers preserve the TypeScript generator's fenced-code stripping, searchable
plain text, reading duration, search-text composition, excerpts and legacy heading
extraction. They are not yet a safe Markdown-to-HTML renderer. HTML structure,
sanitization, highlighting and math remain migration gates.

Regenerate the committed compressed metadata oracle from the repository root:

```sh
pnpm -F @woodfish-nest/content-tools exec tsx src/export-render-metadata.ts
pnpm -F @woodfish-nest/content-tools exec tsx src/export-render-slugs.ts
go -C services/api test ./internal/render
```

The exporter calls the original TS helpers with all 246 tracked source articles,
their normalized Markdown and actual frontmatter metadata, plus seventeen edge cases.
It does not include untracked drafts or regenerate public assets. These metadata
fixtures run before asset rewriting; complete rendered article fixtures will
add the post-rewrite HTML/TOC/excerpt checks required before content cutover.
The gzip file keeps the oracle independent of Node during Go tests. CI recomputes
the oracle and compares decompressed JSON exactly with `--check`, rejecting content
drift without depending on gzip platform headers. It is about 1.4 MB rather than duplicating the
uncompressed Markdown and expected text several times in the checkout.

Use ECMAScript whitespace semantics: BOM is whitespace, Unicode NEL is not.
Reading units count Han/Hiragana/Katakana/Hangul runes and remaining words, at
220 units per minute with a minimum of one minute. Unclosed fences discard the
remaining lines, matching the existing generator.

`Slugger` preserves github-slugger 2.0.0's removal ranges and duplicate numbering,
including explicit suffix collisions. Its generated 736-range table comes from
the locked JavaScript dependency, not Go Unicode punctuation categories. The
upstream license is retained alongside it. Lowercasing uses Unicode-aware full
case conversion, including dotted I and contextual Greek sigma.

Parity covers the 4,306 TS-extracted heading inputs across all 246 articles,
1,488 lowercase mappings and collision/Unicode examples. This proves slug
generation for those inputs. Goldmark 1.8.7 now also parses the complete article
Markdown and matches legacy heading IDs, text, levels and source lines against TS.
An ATX parser hook records the empty source segment of empty headings: repeated
empty headings still consume slug suffixes and must retain their line numbers.
Attaching those IDs to final rendered HTML remains part of the next gate.

Excerpt selection follows the first nonempty paragraph (including list/quote
paragraphs), skips `[toc]` and image-only paragraphs, and uses the original regex
stripping rules rather than rendered text. Truncation counts JavaScript UTF-16
units at 150; reading-time counting continues to count Unicode runes separately.
