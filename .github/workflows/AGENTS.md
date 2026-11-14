<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-29 | Updated: 2026-04-29 -->

# .github/workflows

## Purpose

GitHub Actions CI/CD workflow definitions for automated testing, building, and deployment.

## Key Files

| File | Description |
|------|-------------|
| `ci.yml` | CI workflow: runs `npm test` (Vitest) and `npm run typecheck` on pull requests and pushes to `main` |
| `deploy-vps.yml` | Deploy workflow: builds the app with content generation and deploys to VPS via SSH/SCP |

## For AI Agents

### CI Workflow
- Triggers: push to `main`, pull requests
- Steps: checkout → setup Node.js → `npm ci` → `npm test` → `npm run typecheck`
- Fails fast on test or typecheck errors

### Deploy Workflow
- Job `deploy` in `ci.yml`; runs on push to `main` after `verify-and-build`
- Uses secret `BLOG_DEPLOY_SSH_KEY` for the restricted host user `blog-deploy` (rrsync into `/opt/blog-stack/deploy-incoming/blog` only)
- Rsyncs `apps/blog/dist/` to `release/`, writes the commit SHA to `READY`; the host's `blog-activate.path` validates and swaps it into `/opt/blog-stack/sites/newBlog`
- Does not push nginx config (managed on the host; `deploy-image-bed.yml` still pushes `deploy/nginx.conf` as root)

<!-- MANUAL: -->
