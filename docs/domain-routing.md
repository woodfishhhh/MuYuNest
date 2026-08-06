# Public Domain Routing

Public sites use one hostname per product. The apex is a compatibility router,
not a static-site document root.

| Canonical URL | Site directory in `blog-nginx` | Build URL base |
| --- | --- | --- |
| `https://blog.woodfish.site/` | `/usr/share/nginx/html/newBlog` | `/` |
| `https://pretext.woodfish.site/` | `/usr/share/nginx/html/pretext` | `/pretext/` compatibility assets |
| `https://weather.woodfish.site/` | `/usr/share/nginx/html/weather` | `/weather/` compatibility assets |
| `https://xcpc.woodfish.site/` | `/usr/share/nginx/html/xcpc-super-template` | `/xcpc-super-template/` compatibility assets |
| `https://img.woodfish.site/` | image-bed routes and `/admin/` | unchanged |
| `https://analytics.woodfish.site/` | host-side analytics dashboard | Basic-authenticated reverse proxy |

`filter.woodfish.site` is owned by its separate nginx configuration and must not
be added to or removed from `deploy/nginx.conf`.

## Site Identity Assets

Canonical site icons live in `apps/blog/public/site-icons/`. The blog references
its icon directly; nginx maps the legacy favicon paths used by Pretext, Weather,
XCPC, and the image-bed admin to their matching icon in that shared directory.
This keeps every browser tab identifiable without requiring unrelated site
bundles to be rebuilt during a routing-only deployment.

When adding a public subdomain, add one square SVG source to this directory and
an exact favicon location in `deploy/nginx.conf`. Add a PNG or ICO derivative
only when the existing page declares that legacy favicon format.

## DNS And TLS

The `blog`, `pretext`, `weather`, `xcpc`, and `analytics` A records point to
`36.151.148.198`. Each hostname has its own Let's Encrypt certificate under
`/etc/letsencrypt/live/<hostname>/`; `certbot.timer` renews them. The webroot for
ACME HTTP-01 challenges is `/opt/blog-stack/certbot/www` on the host and
`/var/www/certbot` inside nginx.

## Redirect Contract

Permanent redirects preserve paths and query strings:

- `woodfish.site` and `www.woodfish.site` redirect to `blog.woodfish.site`.
- `/newBlog/*` redirects to the same path on `blog.woodfish.site`.
- `/pretext/*`, `/weather/*`, and `/xcpc-super-template/*` redirect to their
  corresponding subdomains.
- `/newBlog/sw.js` is not redirected. It serves a short-lived retirement worker
  that clears old-origin caches and unregisters itself.

Keep these redirects indefinitely because articles, friend links, search indexes,
and installed PWAs can retain the old URLs.

## Deployment Invariants

The blog's public base and storage mount are deliberately independent:

- `VITE_BASE_PATH=/` controls generated browser URLs.
- `DEPLOY_DIR=/opt/blog-stack/sites/newBlog` controls the host release directory.
- `DEPLOY_MOUNT_PATH=/newBlog/` controls the container-side validation path.

Never derive the storage directory from the public URL base. A release must pass
dist verification, `nginx -t`, container-side file verification, and an HTTPS
smoke test before the previous release is removed.

## Acceptance Checks

```powershell
Resolve-DnsName blog.woodfish.site -Type A
curl.exe -I https://blog.woodfish.site/
curl.exe -I https://woodfish.site/newBlog/friend/?from=legacy
curl.exe -I https://pretext.woodfish.site/
curl.exe -I https://weather.woodfish.site/
curl.exe -I https://xcpc.woodfish.site/
curl.exe -I https://analytics.woodfish.site/
```

The canonical pages must return `200`; legacy URLs must return `308` with the
same path and query on the canonical hostname. The analytics hostname must
return `401` without credentials and `200` after HTTP Basic authentication.
