# CLAUDE.md

> WoodFishNest / MuYuNest project operating contract and memory snapshot.
> Last consolidated: 2026-05-18 Asia/Shanghai.

This file is the primary entry point for Claude-style agents working in this
repository. It condenses the durable project rules, current stack reality,
deployment memory, recent fixes, and verification expectations into one
reference.

## Project Identity

WoodFishNest, formerly VueCubeBlog, is a personal blog and self-hosted image-bed
monorepo.

- Public blog: `apps/blog`, a Nuxt 5 nightly SPA with Vue 3, Three.js, Pinia,
  Tailwind CSS v4, GSAP where appropriate, and pre-generated Markdown content.
- Image-bed API: `apps/image-bed-api`, a Hono + SQLite service for image uploads.
- Image-bed admin UI: `apps/image-bed-web`, a Vue 3 + Vite app mounted under
  the image-bed domain.
- Shared packages: `packages/shared`, `packages/content-tools`,
  `packages/upload-cli`.
- Deployment: VPS behind nginx, blog served at `https://blog.woodfish.site/`,
  image-bed served at `https://img.woodfish.site/`.

The project is practical production software. Prefer boring, observable fixes
over speculative architecture.

## Current Workspace Memory

- Current repository path:
  `C:\Users\woodfish\Desktop\前端\three.js.learn\VueCubeBlog`.
- Current canonical GitHub repository:
  `https://github.com/woodfishhhh/MuYuNest.git`.
- The old remote `woodfishhhh/VueThreeBlog` redirects, but `origin` should point
  at `woodfishhhh/MuYuNest`.
- User timezone for dates and deployment interpretation: Asia/Shanghai.
- Current main deployment branch: `main`.
- Current live blog base path: `/` on `blog.woodfish.site`.
- The container mount remains `/usr/share/nginx/html/newBlog`; do not confuse it
  with the public URL base.
- Current production nginx container for blog: `blog-nginx`.
- Default local VPS SSH target used by `deploy/deploy.ps1`:
  `root@36.151.148.198`.

## Instruction Precedence

Follow instructions in this order:

1. System, developer, and current user messages.
2. This `CLAUDE.md`.
3. `AGENTS.md` and any deeper scoped agent instruction files.
4. Local package scripts, workflow files, and source patterns.
5. External docs, only when current or primary-source verification is needed.

If this file conflicts with `AGENTS.md`, prefer this file for facts that are
known to have changed. In particular, package-manager facts in `AGENTS.md` are
currently stale.

## Package Manager And Runtime

Use `pnpm`, not `npm`.

- Root `package.json` declares `packageManager: "pnpm@10.11.0"`.
- Root scripts delegate through `pnpm -F ...`.
- CI uses `pnpm/action-setup@v4` and `pnpm install --frozen-lockfile`.
- `deploy/deploy.ps1` must use `pnpm build:deploy` and `pnpm verify:dist`.
- Do not reintroduce `npm run ...` into deployment scripts unless the repository
  package manager changes.

Common commands from repo root:

```powershell
pnpm install
pnpm dev
pnpm generate:content
pnpm generate:content:ci
pnpm typecheck
pnpm test
pnpm build
pnpm build:deploy
pnpm verify:dist
```

Workspace-specific commands:

```powershell
pnpm -F @woodfish-nest/blog dev
pnpm -F @woodfish-nest/blog test
pnpm -F @woodfish-nest/blog typecheck
pnpm -F @woodfish-nest/blog build
pnpm -F @woodfish-nest/image-bed-api typecheck
pnpm -F @woodfish-nest/image-bed-api test
pnpm -F @woodfish-nest/image-bed-web build
pnpm -F @woodfish-nest/content-tools test
```

## Architecture Rules

### Blog App

- `apps/blog` is SPA-only: `ssr: false` in `nuxt.config.ts`.
- Do not wrap normal Three.js/browser code in `ClientOnly` just to appease SSR;
  SSR is intentionally disabled.
- Pinia is wired manually through `src/plugins/pinia.ts` and auto-imports. Do
  not add `@pinia/nuxt` module usage unless the Nuxt version compatibility is
  deliberately changed.
- Tailwind CSS v4 is configless here. Tokens and custom surfaces live in
  `apps/blog/src/assets/main.css`; do not add a Tailwind config file by default.
- `import.meta.env.BASE_URL` is not the app base URL in this Nuxt SPA setup.
  Use the existing `getBaseUrl()` / `__APP_BASE_URL__` pattern for content,
  favicon, generated JSON, and API-relative URL construction.
- Blog content is generated before build into `apps/blog/src/generated/*.json`.
  Source content lives under `apps/blog/content`.

### Content Pipeline

- Use `pnpm generate:content` for full local content generation and image
  optimization.
- Use `pnpm generate:content:ci` for CI/deploy generation with reused assets.
- If editing source data like `apps/blog/content/source/blog/source/_data/link.yml`,
  regenerate content and include resulting generated JSON / asset removals when
  they are part of the intended source-data change.
- Do not hand-edit generated JSON unless diagnosing. Prefer changing source
  content and rerunning the content tool.

### Image Bed

- Image-bed API is Docker-backed on the VPS.
- `img.woodfish.site` nginx routing has historically depended on the mounted
  `/opt/blog-stack/nginx/conf.d/default.conf`. Keep related server blocks inside
  the mounted nginx config unless the container mount is changed to the whole
  `conf.d` directory.
- nginx inside Docker cannot reach host services at `127.0.0.1`; use the Docker
  host bridge address pattern already present in deploy config.
- Do not remove or overwrite host-mounted `/srv/muyu-images` or `/srv/muyu-data`.

## UI And Interaction Rules

- Preserve the existing immersive blog style, but prioritize usability over
  decorative motion.
- For scroll surfaces, prefer native browser scrolling. Avoid custom smooth
  scroll loops unless there is strong evidence they are required and harmless.
- The friend page intentionally uses a regular native two-column waterfall, not
  infinite cloned loops.
- Friend cards use pointer-driven pseudo-3D tilt. Keep this scoped to cards and
  the mobile submit trigger; do not tilt the full friend application form card.
- Post article pages rely on `.article-page` as the scroll container. Keep
  `pointer-events: auto`, `overflow-y: auto`, and TOC behavior verified in a real
  browser after layout changes.
- Article images should remain loadable inside custom scroll containers. Be
  careful with native `loading="lazy"` and non-document scroll roots.
- For mobile and desktop visual changes, verify in Chrome DevTools or Playwright
  before claiming the UI is fixed.

## Deployment Rules

### GitHub Actions Deploy

Main workflow: `.github/workflows/deploy-vps.yml`.

Important behavior:

- `push` to `main` triggers blog deploy.
- Build order is install, generate content, typecheck, build deploy artifact,
  package archive, upload chunks, verify remote archive, upload nginx config,
  activate release, smoke test live site.
- Site archive upload is chunked into 1 MB parts and recombined remotely. This
  replaced a previous raw SSH pipe upload that repeatedly timed out and produced
  truncated archives.
- Do not replace chunked upload with `cat archive | ssh "cat > file"` unless
  there is new evidence that the network issue is gone.
- After pushing, check Actions at roughly one-minute intervals when actively
  debugging. Do not wait 45 minutes before checking failure state.

### Local VPS Deploy

Local script: `deploy/deploy.ps1`.

Behavior:

- Defaults to `root@36.151.148.198`.
- Builds with `pnpm build:deploy`.
- Packages `apps/blog/dist`.
- Uploads archive and `deploy/nginx.conf`.
- Atomically switches `/opt/blog-stack/sites/newBlog`.
- Runs nginx config test and reload.
- Smokes `https://blog.woodfish.site/`.

Use this script when GitHub Actions visibility is blocked but SSH is available
and the user explicitly wants deployment completed.

### Smoke Evidence

Useful smoke checks:

```powershell
curl.exe -I https://blog.woodfish.site/
curl.exe -L https://blog.woodfish.site/friend/ -o NUL -w "status=%{http_code}`n"
curl.exe -I https://woodfish.site/newBlog/friend/
gh run list --repo woodfishhhh/MuYuNest --branch main --limit 5 --json databaseId,name,headSha,status,conclusion,url
```

Known network caveat:

- Local `gh` and browser access to GitHub can intermittently hit TLS handshake
  timeouts. Retry, use `gh run list` when available, and cross-check the live
  site. Do not mistake local GitHub API timeout for a workflow failure.

## Verification Rules

Always verify before claiming completion.

For code changes:

1. Run targeted tests for touched behavior.
2. Run `pnpm -F <workspace> typecheck` or root `pnpm typecheck` when relevant.
3. Run build when deployment, Nuxt config, generated content, or routing changed.
4. Use browser verification for UI, scroll, interaction, routing, PWA, or asset
   path changes.
5. If deploying, verify GitHub Actions and live URL status.

Common targeted checks:

```powershell
pnpm -F @woodfish-nest/blog test tests/home/friend-panel.test.ts
pnpm -F @woodfish-nest/blog test tests/views/post-view.test.ts tests/article/article-content.test.ts tests/article/article-toc.test.ts
pnpm -F @woodfish-nest/blog typecheck
pnpm -F @woodfish-nest/blog build
pnpm build:deploy
```

When UI is involved, report concrete evidence such as:

- Element computed styles that prove the bug is gone.
- Scroll container `scrollTop`, `scrollHeight`, `overflowY`, and pointer-events.
- TOC / target heading bounding boxes.
- Console and network errors.
- Relevant desktop and mobile viewport checks.

## Commit Message Protocol

Use the project Lore commit style.

```text
<short intent line: why this change exists>

Constraint: <external constraint or observed bug that shaped the decision>
Rejected: <alternative considered> | <reason it was rejected>
Confidence: <low|medium|high>
Scope-risk: <narrow|moderate|broad>
Directive: <future-facing instruction for later maintainers>
Tested: <commands and manual checks that passed>
Not-tested: <known verification gaps>
```

Recent examples:

- `Stabilize blog friend and post interactions`
- `Use pnpm for local VPS deploy`
- `Load image-bed routes through the mounted nginx config`

Commit only intentional changes. If user-made files are present and the user
says to include them, include them; otherwise do not silently revert or stage
unrelated work.

## Git And Remote Rules

- Main branch: `main`.
- Canonical remote: `origin https://github.com/woodfishhhh/MuYuNest.git`.
- The old `VueThreeBlog` URL may redirect; update remotes to `MuYuNest`.
- Do not amend commits unless explicitly requested.
- Never use destructive commands such as `git reset --hard` or
  `git checkout --` unless the user explicitly asks.
- Worktree may be dirty. Treat pre-existing changes as user work.
- Prefer non-interactive git commands.

## Windows Workspace Rules

- Use PowerShell-native commands on Windows.
- Prefer `rg` / `rg --files` for search.
- Use `apply_patch` for manual edits.
- Do not compose destructive file operations across shells.
- Before recursive delete or move, verify resolved absolute paths are inside the
  intended workspace.
- Avoid ad hoc shell redirection for file creation when `apply_patch` is
  appropriate.
- Be aware that PowerShell execution policy can block scripts; use:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/deploy.ps1
```

## Recent Delivery Memory

### 2026-05-18 Blog Scroll And Friend Page Stabilization

Delivered commits:

- `8c7e52a` Stabilize blog friend and post interactions.
- `5e7e7bd` Use pnpm for local VPS deploy.

Key fixes:

- Removed `useGsapSmoothScroll` and its tests.
- Reworked friend page to ordinary native scrolling.
- Removed infinite waterfall cloning; friend links now use a regular two-column
  waterfall.
- Stopped `SlideController` from hijacking friend-page wheel/touch events.
- Added pseudo-3D pointer tilt to friend cards.
- Added pseudo-3D tilt to mobile `提交友链` trigger.
- Removed rotation from the desktop `投递你的站点` application form card because
  the tilted full-card shadow was visually unstable.
- Fixed post page scroll by ensuring `.article-page` has `pointer-events: auto`.
- Moved desktop article TOC upward by changing sticky top to `0`, aligning it
  with article top while preserving nav clearance.
- Added Vitest Vue plugin and `vite-plus/test` alias so legacy tests run under
  Vitest.
- Updated local VPS deploy script from `npm` to `pnpm`.

Verification that passed:

- `pnpm -F @woodfish-nest/blog test tests/home/friend-panel.test.ts`.
- `pnpm -F @woodfish-nest/blog test tests/views/post-view.test.ts tests/article/article-content.test.ts tests/article/article-toc.test.ts`.
- `pnpm -F @woodfish-nest/blog typecheck`.
- `pnpm -F @woodfish-nest/blog build`.
- `powershell -ExecutionPolicy Bypass -File deploy/deploy.ps1`.
- GitHub Actions `CI` success on `5e7e7bd`.
- GitHub Actions `Deploy to VPS` success on `5e7e7bd`.
- Historical live check: `https://woodfish.site/newBlog/friend/` returned 200
  before the subdomain migration.

### 2026-05-18 Image-Bed Deploy Stabilization

Recent deploy-related commits before the blog interaction work:

- `2b93969` Load image-bed routes through the mounted nginx config.
- `46118f8` Expose image-bed API on the Docker host bridge.
- `5c465f9` Proxy image-bed API through host bridge from nginx.
- `7336e2f` Replace conflicting image-bed container during deploy.
- `4cb7a84` Sync image-bed compose file before VPS update.
- `f37705d` Use GHCR for image-bed API deploy images.

Durable lessons:

- Keep image-bed nginx server blocks in the mounted default nginx config unless
  container mounts change.
- nginx container-to-host API calls must use the Docker host bridge address.
- Deployment must preserve the stable `muyu-image-bed-api` container name and
  host-mounted data/image directories.
- CI/CD should verify public `/api/health` and `/admin/` after image-bed deploy.

## Known Sharp Edges

- `AGENTS.md` currently says npm workspaces and `npm@11.14.1`; actual repo state
  is pnpm. Follow `package.json`, CI, and this file.
- Nuxt SPA `import.meta.env.BASE_URL` may resolve to build assets directory, not
  app base. Use `getBaseUrl()`.
- PWA service worker can cache stale local preview assets. When DevTools computed
  styles do not match freshly built CSS, unregister service workers and clear
  caches before retesting.
- Article page uses a nested scroll root. Keyboard scroll may require focus on
  the article/content region during browser tests.
- GitHub API access can intermittently timeout from this Windows machine even
  when git push and site access work.
- Build output can change generated content/assets after source content edits;
  inspect generated diffs before committing.

## Review Stance

When asked for a review:

- Lead with findings, ordered by severity.
- Include file and line evidence.
- Focus on bugs, behavioral regressions, security, performance, maintainability,
  deployment risks, and missing tests.
- If no issues are found, say that explicitly and mention residual risks or test
  gaps.

## Durable Agent Behavior

- Work directly when the request is scoped and reversible.
- Keep diffs small, reviewable, and aligned with existing patterns.
- Prefer native browser scrolling and platform behavior over heavy interaction
  machinery.
- Ask only for destructive, credential-gated, production-risky, or materially
  scope-changing decisions.
- Use subagents only for independent bounded work when explicitly requested or
  when the active environment authorizes it.
- Do not revert user changes.
- Do not invent new deployment paths without checking current workflows and live
  VPS behavior.
- Report verification honestly, including commands that failed because of local
  network or environment issues.
