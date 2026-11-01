# Content renderer migration

The metadata helpers currently preserve the TypeScript generator's fenced-code
stripping, searchable plain text, reading duration and search-text composition.
They are not yet a Markdown-to-HTML renderer. Excerpts, legacy heading anchors,
HTML structure, sanitization, highlighting and math remain migration gates.

Regenerate the committed compressed metadata oracle from the repository root:

```sh
pnpm -F @woodfish-nest/content-tools exec tsx src/export-render-metadata.ts
go -C services/api test ./internal/render
```

The exporter calls the original TS helpers with all 246 tracked source articles,
their normalized Markdown and actual frontmatter metadata, plus ten edge cases.
It does not include untracked drafts or regenerate public assets. These metadata
fixtures run before asset rewriting; complete rendered article fixtures will
add the post-rewrite HTML/TOC/excerpt checks required before content cutover.
The gzip file keeps the oracle independent of Node during Go tests. CI regenerates
it from source and rejects drift. It is about 1.4 MB rather than duplicating the
uncompressed Markdown and expected text several times in the checkout.

Use ECMAScript whitespace semantics: BOM is whitespace, Unicode NEL is not.
Reading units count Han/Hiragana/Katakana/Hangul runes and remaining words, at
220 units per minute with a minimum of one minute. Unclosed fences discard the
remaining lines, matching the existing generator.
