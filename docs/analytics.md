# First-Party Analytics

The blog uses a lightweight, first-party analytics service rather than a
separate PostgreSQL-backed analytics stack. The existing Python visitor-counter
process also accepts analytics events and stores them in SQLite.

## Architecture

- `blog.woodfish.site/api/analytics/collect` is the only public collection endpoint.
- `blog.woodfish.site/analytics/` serves the private dashboard and summary API
  behind nginx HTTP Basic authentication.
- `server/visitor-counter.py` owns collection, aggregation, retention, and the
  existing visitor-counter endpoints.
- `server/analytics-dashboard/` contains the dependency-free dashboard.
- `/opt/blog-stack/services/visitor-counter/data/analytics.sqlite3` is the
  production database. SQLite runs in WAL mode.

The implementation uses only the Python standard library and adds no container,
database server, cookie banner, or client dependency.

## Data Contract

The browser sends page views, selected product events, and the TTFB, FCP, LCP,
and CLS web metrics. Page paths never include query strings or fragments.
Referrers are reduced to hostnames. Event fields are length-limited and only
scalar event values are accepted.

The service never stores a raw IP address or raw User-Agent. It derives a daily
visitor identifier with HMAC from the date, address, and User-Agent, then stores
only that identifier plus coarse browser, operating-system, and device labels.
The HMAC key lives at `/etc/woodfish/analytics-secret` and is not committed.

Tracking is limited to `blog.woodfish.site`, respects browser Do Not Track, and
uses a random tab-session identifier in `sessionStorage`. No analytics cookies
or cross-site identifiers are used.

Raw events are retained for 180 days. Cleanup runs at most once per UTC day when
new data arrives.

## Tracked Events

| Event | Purpose |
| --- | --- |
| `works-outbound` | Project and GitHub buttons |
| `works-drag-launch` | Orbit card dragged into the project target |
| `works-view-mode` | Orbit/Case mode selection |
| `friend-outbound` | Friend link navigation |
| `friend-random` | Random friend action |
| `travellings-outbound` | Travellings navigation entry point |
| `theme-change` | Day/night theme selection |
| `post-read-depth` | Article reaches 50% or 90% reading depth |

For imperative events, call `trackAnalyticsEvent` from
`apps/blog/src/utils/analytics.ts`. For ordinary links or buttons, add
`data-analytics-event` and optional `data-analytics-event-*` attributes. Never
put personal data, query strings, article body text, or free-form user input in
event data.

## Operations

Deploy or update the service with:

```powershell
pnpm deploy:visitor-counter
```

The installer preserves the SQLite database and secrets, updates dashboard
assets, restarts the systemd service, and ensures the nginx password file exists.
The first installation writes the dashboard credentials to
`/root/.config/woodfish/analytics-admin.env` with mode `0600`.

Health and service checks:

```bash
systemctl status visitor-counter
curl http://127.0.0.1:3011/api/analytics/health
journalctl -u visitor-counter --since today
```

Back up both the visitor count and analytics database. Copy the SQLite database
through its backup API or stop the service briefly before copying all database
files so the WAL is not omitted:

```bash
systemctl stop visitor-counter
tar -C /opt/blog-stack/services/visitor-counter/data \
  -czf /root/woodfish-metrics-$(date +%F).tar.gz .
systemctl start visitor-counter
```

Restore into the same data directory while the service is stopped, preserve the
secret file, then start the service and check the health endpoint. Rotating the
HMAC secret is allowed, but splits daily visitor identity at the rotation time.
