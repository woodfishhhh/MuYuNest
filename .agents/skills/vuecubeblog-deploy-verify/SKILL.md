---
name: vuecubeblog-deploy-verify
description: Publish scoped articles and blog content through the VueCubeBlog content generator, CI, VPS deployment workflow, and live site verification while preserving canonical slugs and unrelated dirty changes. Use in this repository when asked to put notes or Markdown on the blog, regenerate content, repair a failed blog deployment, publish or redeploy the site, or prove that specific posts and post-index entries are live.
---

# VueCubeBlog Deploy Verify

Move content through the repository's canonical source and automated release path, then verify the exact public articles rather than stopping at a commit or workflow status.

## Load the current publishing contract

1. Read the repository `AGENTS.md`, nested instructions for every touched area, and [references/publish-map.md](references/publish-map.md).
2. Inspect `git status --short --branch` before editing. Preserve unrelated source, workflow, lockfile, generated output, and local browser artifacts.
3. Re-read `package.json`, `.github/workflows/ci.yml`, and `.github/workflows/deploy-vps.yml` before publishing. Commands and trigger topology are time-sensitive.
4. Treat `apps/blog/content/source/myblog` as the canonical source for imported personal notes unless the current generator or repository instructions route that content elsewhere.

## Prepare the source

1. Identify the exact source files, intended titles, categories, dates, assets, and stable slugs.
2. Inspect nearby articles and generator tests before inventing frontmatter or directory conventions.
3. Preserve an existing canonical slug. When rewriting or renaming source, inspect `preferredSlug` and generator behavior so a content refresh does not create a new URL unexpectedly.
4. Keep private provenance, transcript, subtitle, ASR, and editorial process artifacts outside the public article body unless the user explicitly wants them published.
5. Copy or edit only the selected content and its required assets. Do not bulk-import an entire notes tree by default.

## Generate and review the content diff

Run from the repository root:

```powershell
pnpm generate:content:ci
```

Then:

1. Inspect the source and generated diff together.
2. Confirm each intended article has exactly one expected generated post and `post-index.json` entry.
3. Check title, slug, excerpt, date, category, image paths, internal links, and code fences.
4. Investigate unexpected generated churn before proceeding. Do not silently accept slug changes, duplicate entries, missing assets, or unrelated corpus rewrites.

## Validate locally

Choose focused checks based on the change, then broaden for a release candidate:

```powershell
pnpm content-tools:test
pnpm test
pnpm typecheck
pnpm -F @woodfish-nest/blog build:deploy:dist
```

Also inspect the generated `apps/blog/public/post-index.json` and open representative articles in a real browser when rendering, navigation, assets, syntax highlighting, or responsive layout could regress. Record final exit status; a started command is not a passed check.

## Publish through the active workflow

When the user explicitly asks to publish or deploy, follow the normal scoped source-control and automation path:

1. Stage only the selected source, required assets, and generator-owned artifacts attributable to the task.
2. Exclude unrelated dirty changes and local browser/test artifacts.
3. Commit and push the intended branch only when authorized by the publishing request and repository policy.
4. Follow the active CI run for the exact commit.
5. Follow the `Deploy to VPS` run triggered by successful `CI` on `main`, or its current documented manual-dispatch path.
6. Do not fall back to ad hoc rsync/SSH merely because polling or a GitHub API request is transient. Diagnose the workflow first; use manual deployment only when the user explicitly selects that recovery path.

Bind every release statement to the commit and workflow run that actually produced the deployed artifact.

## Verify the live articles

After deployment succeeds:

1. Fetch `https://blog.woodfish.site/` and confirm the expected asset base loads.
2. Fetch the live `post-index.json` path used by the application and confirm every intended slug/title is present.
3. Open every new or changed article URL, not just the home page.
4. Check HTTP success, correct title/body, assets, code blocks, internal links, and absence of obvious console/runtime failures.
5. Compare the live slug set and content markers to the generated local output and deployed commit.
6. Treat CDN/browser cache as a separate hypothesis; use bounded cache-busting only for diagnosis and verify the canonical URL afterward.

A successful push is not a release. A green CI run is not a deployment. A green deployment is not proof that every new article is reachable.

## Recover failures by stage

- **Generation failure:** repair source/frontmatter/assets or the generator contract; do not hand-edit generated JSON as the primary fix.
- **Unexpected slug change:** restore the canonical slug through source metadata or generator logic and add/adjust a focused test.
- **CI failure:** inspect the exact failing job and reproduce its command locally.
- **Deploy failure:** inspect artifact resolution, SSH/rsync staging, activation, rollback, and smoke steps in the current workflow.
- **Live 404 or stale index:** compare deployed artifact, live `post-index.json`, article URL, base path, and cache behavior.
- **Transient GitHub/SSH failure:** re-query the same run and retry only the established idempotent workflow step when evidence shows the source/artifact is sound.

## Report completion

Include:

- canonical source files and final slugs;
- generated artifacts reviewed;
- focused and broad validation commands with exit status;
- commit and CI/deploy run coordinates when publishing occurred;
- live index and per-article URLs actually checked;
- unrelated dirty changes deliberately left untouched;
- any remaining deployment, cache, credential, or external-service uncertainty.
