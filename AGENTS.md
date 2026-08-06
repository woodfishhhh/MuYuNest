# AGENTS.md — Monorepo Root

This document provides context for AI coding agents working in the `woodfish-nest` monorepo.

## Project Overview

Personal blog + image-bed infrastructure. The public-facing **blog** app (`apps/blog`) is a Nuxt 5 nightly SPA with an immersive Three.js 3D scene. The **image-bed** is a self-hosted image CDN used by the blog's writing workflow.

## Monorepo Structure

```
woodfish-nest/
├── apps/
│   ├── blog/            # Main blog SPA — Nuxt 5 nightly + Vite 8 + Three.js
│   ├── image-bed-api/   # Hono + SQLite REST API for image uploads
│   └── image-bed-web/   # Vue 3 + Vite 7 admin panel for image-bed
├── packages/
│   ├── content-tools/   # CLI: generate JSON content from Markdown, optimise images
│   ├── shared/          # Shared TypeScript types used by API + blog
│   └── upload-cli/      # Typora custom image uploader
├── deploy/              # Deployment scripts, nginx config, systemd units
├── docs/                # Architecture notes, ops runbooks, plans
└── tests/               # Root-level integration tests (server/visitor-counter)
```

## Package Manager

**pnpm workspaces** — `packageManager: "pnpm@10.11.0"`.

All install / workspace commands must be run from the **repo root** unless otherwise noted.

```bash
pnpm install                                    # install all workspace deps
pnpm add <pkg> -F @woodfish-nest/blog           # add a dep to a specific workspace
```

## Root Scripts (delegates to workspaces)

| Script                     | Workspace     | Purpose                                           |
| -------------------------- | ------------- | ------------------------------------------------- |
| `pnpm dev`                 | blog          | Start Nuxt dev server                             |
| `pnpm build`               | blog          | `nuxt generate` → static SPA in `apps/blog/dist/` |
| `pnpm build:deploy`        | blog          | Generate with prod base URL + verify dist         |
| `pnpm generate:content`    | blog          | Run content-tools CLI (full)                      |
| `pnpm generate:content:ci` | blog          | Run content-tools CLI (CI/deploy, reuse assets)   |
| `pnpm typecheck`           | blog          | `nuxt typecheck`                                  |
| `pnpm shared:build`        | shared        | Compile shared package                            |
| `pnpm image-bed:api:dev`   | image-bed-api | Start Hono dev server                             |
| `pnpm image-bed:web:dev`   | image-bed-web | Start Vite admin UI                               |
| `pnpm image-bed:deploy:up` | —             | `docker compose up -d` in production              |

## Technology Stack

| Layer            | Technology                                               |
| ---------------- | -------------------------------------------------------- |
| Blog framework   | Nuxt 5.0.0-nightly (`nuxt-nightly@5x`)                   |
| Build tooling    | Vite 8 + Rolldown (via `@nuxt/vite-builder-nightly@5x`)  |
| Blog UI          | Vue 3.5 + Pinia 3 + Vue Router 5                         |
| 3D scene         | Three.js r183                                            |
| CSS              | Tailwind CSS v4 (PostCSS plugin, no config file)         |
| Animation        | GSAP 3                                                   |
| Image bed API    | Hono 4 + better-sqlite3 on @hono/node-server             |
| Image bed web    | Vue 3 + Vite 7                                           |
| Content pipeline | Markdown-it, highlight.js, sharp (via content-tools CLI) |
| Testing          | Vitest 3 (all packages) + Playwright (blog E2E)          |
| TypeScript       | ~5.9.3 across all packages                               |

## Key Constraints

- **SPA only** (`ssr: false` in nuxt.config.ts) — Three.js and all browser APIs run without ClientOnly wrappers.
- **No Tailwind config file** — Tailwind v4 is config-less; all tokens live in CSS `@layer` / `@theme` blocks inside `src/assets/main.css`.
- **`@pinia/nuxt` is NOT used** — Pinia is wired up via `src/plugins/pinia.ts` and auto-imports configured in `nuxt.config.ts`.
- **Content is pre-generated** — Run `pnpm generate:content` before `pnpm build` to produce `src/generated/*.json`.
- **Node version** — Use Node 22 (LTS). The codebase targets `"es2020"` for Vite builds.

## Branch / Worktree Convention

Main development branch: `main`. Feature work is done on short-lived branches or git worktrees.

## Deployment

The blog is deployed to a VPS behind nginx. See `deploy/` for:

- `deploy.sh` / `deploy.ps1` — copy dist + nginx reload
- `nginx.conf` — serves the SPA at `blog.woodfish.site` and keeps legacy redirects
- `install-visitor-counter.sh` — systemd service for the Python visitor counter

The image-bed API runs in Docker Compose on a separate subdomain (`img.woodfish.site`).
