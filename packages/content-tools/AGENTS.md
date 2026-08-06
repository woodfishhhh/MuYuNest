# AGENTS.md — packages/content-tools

CLI tool for generating blog content from Markdown source files and optimising images.

## Commands

```bash
# Run via tsx (from this package or via root npm run generate:content)
tsx src/cli.ts generate                     # full pipeline: parse posts + optimise images
tsx src/cli.ts generate --reuse-assets      # CI mode: skip image re-optimisation
tsx src/cli.ts optimize-images              # optimise images only
tsx src/cli.ts verify-dist                  # verify built dist has expected assets
tsx src/cli.ts verify-dist --dist-dir dist --base-path /  # with explicit paths

# Build (compile TS for use as a bin)
npm run build     # tsc → dist/
npm run typecheck # tsc --noEmit
vitest run        # unit tests
```

## Input / Output

| Path | Role |
|---|---|
| `apps/blog/content/posts/` | Markdown source files (frontmatter + content) |
| `apps/blog/content/source/` | Source images referenced in posts |
| `apps/blog/src/generated/` | **Output**: `post-index.json`, individual post JSON |
| `apps/blog/public/content/` | **Output**: individual post JSON for runtime fetch |
| `apps/blog/public/content-assets/` | **Output**: optimised images |
| `apps/blog/public/post-index.json` | **Output**: post listing index |

## Source Layout

```
src/
├── cli.ts                # Main CLI entry (citty-based commands)
├── generate-content.ts   # Orchestrate full content generation
├── image-optimizer-core.ts  # sharp image resizing + compression
├── optimize-images.ts    # CLI wrapper for image optimisation
├── paths.ts              # Canonical path constants
├── report.ts             # Post-generation report printer
├── verify-dist.ts        # Verify built dist has all expected files
├── index.ts              # Public API (for use as a library)
└── content/
    ├── parse-post.ts     # Parse individual Markdown file + frontmatter
    └── ...               # Other content helpers
```

## Important Rules

- **Generated files** (`src/generated/`, `public/content/`) must NOT be manually edited.
- **`--reuse-assets`** flag skips sharp image re-processing; use in CI when source images haven't changed.
- `verify-dist` checks that `dist/` contains the expected hashed JS/CSS chunks and all content JSON files. Fails the build if anything is missing.
