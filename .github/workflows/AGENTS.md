<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-29 | Updated: 2026-04-29 -->

# .github/workflows

## Purpose

GitHub Actions CI/CD workflow definitions for automated testing, building, and deployment.

## Key Files

| File | Description |
|------|-------------|
| `ci.yml` | CI workflow: runs `npm test` (Vitest) and `npm run typecheck` on pull requests and pushes to `main` |
| `deploy-image-bed.yml` | Image-bed release: pushes the API image and uploads the admin UI to a restricted inbox |

## For AI Agents

### CI Workflow
- Triggers: push to `main`, pull requests
- Steps: checkout → setup Node.js → `npm ci` → `npm test` → `npm run typecheck`
- Fails fast on test or typecheck errors

### Deploy Workflow
- Job `deploy` in `ci.yml`; runs on push to `main` after `verify-and-build`
- Uses secret `BLOG_DEPLOY_SSH_KEY` for the restricted host user `blog-deploy` (rrsync into `/opt/blog-stack/deploy-incoming/blog` only)
- Rsyncs `apps/blog/dist/` to `release/`, writes the commit SHA to `READY`; the host's `blog-activate.path` validates and swaps it into `/opt/blog-stack/sites/newBlog`
- Does not push nginx config (managed on the host)

### Image-bed Deploy Workflow
- Uses `IMAGE_BED_DEPLOY_SSH_KEY` for `imgbed-deploy` (write-only rrsync to `/opt/blog-stack/deploy-incoming/image-bed`).
- Pushes the API image to GHCR with commit SHA and `latest` tags, then uploads `web/` and writes `READY`.
- The host validates and activates both artifacts; CI checks the run-specific status and both live revisions. CI never pushes nginx or Compose configuration. See [host setup](../../deploy/image-bed/README.md#automated-deploy-host-setup).

<!-- MANUAL: -->
