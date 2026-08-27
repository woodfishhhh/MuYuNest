# VueCubeBlog publishing map

Read the current files before acting. This is a router, not a substitute for the repository contract.

## Canonical paths

- Personal-note source: `apps/blog/content/source/myblog/`
- Other hand-authored post source: `apps/blog/content/posts/`
- Generated post payloads: `apps/blog/src/generated/posts/`
- Generated public index: `apps/blog/public/post-index.json`
- Content generator package: `packages/content-tools/`
- Blog content tests: `apps/blog/tests/content/`
- Blog article rendering tests: `apps/blog/tests/article/`
- CI workflow: `.github/workflows/ci.yml`
- VPS workflow: `.github/workflows/deploy-vps.yml`
- Manual deployment implementation: `deploy/deploy.ps1`, `deploy/deploy.sh`, and `deploy/nginx.conf`

## Current command router

| Need | Command from repository root |
| --- | --- |
| Generate deploy-style content | `pnpm generate:content:ci` |
| Test generator behavior | `pnpm content-tools:test` |
| Test blog | `pnpm test` |
| Typecheck blog | `pnpm typecheck` |
| Build deployment artifact | `pnpm -F @woodfish-nest/blog build:deploy:dist` |
| Verify an existing dist through package script | Inspect and use the current `verify:dist` script |

Do not assume this table is current after package-script changes; inspect `package.json` first.

## Release graph to verify

At skill creation time, `CI` generates content, typechecks, builds the deployment dist, and uploads `blog-dist`. `Deploy to VPS` runs after a successful `CI` workflow on `main` and also supports manual dispatch. It resolves the artifact, stages through SSH/rsync, activates with rollback checks, and performs a live-site smoke test.

Re-read both workflow files every run. Never infer the deployed commit merely from the latest branch head.

## Scope checklist

Before staging or publishing, classify every changed file as one of:

1. selected canonical source;
2. required article asset;
3. generator-owned output caused by the selected source;
4. generator/test fix required to preserve the publishing contract;
5. unrelated pre-existing work.

Include categories 1-4 only when they are necessary for the requested publication. Leave category 5 untouched and call it out.

## Slug and corpus checks

- Search the source and generator for `preferredSlug` before changing filenames or frontmatter.
- Diff the old and new `post-index.json` slug sets.
- Verify there is one intended index entry per article.
- Inspect unexpected deletions and broad regenerated churn.
- Check Markdown fence balance and links for imported note sets.
- Keep public copy focused on the technical article; do not leak private provenance or source-processing narration by default.

## Live proof checklist

- Exact deployed commit and workflow run are known.
- Root page returns the expected application and assets.
- Live post index includes every intended slug and title.
- Every intended article URL returns successfully.
- Representative article content and assets match the generated output.
- Browser console and navigation are clean when the change could affect rendering.
- Any cache-busting diagnosis is followed by a check of the canonical URL.
