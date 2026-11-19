# Go metrics rehearsal and rollback

Production metrics switched to Go on 2026-11-01; the observation period is still
open. Use `deploy/muyu-api-shadow.service` for parallel testing on **127.0.0.1:3012**.
The retained Python service remains on port 3011, off main-site traffic. Shadow has separate
state in `/var/lib/muyu-api-shadow`; it must never point at the Python data files.
Its executable lives at `/opt/blog-stack/services/muyu-api-shadow/api`.
Systemd `LoadCredential` supplies the original HMAC secret without changing its
permissions or printing it. Install only the binary from a verified revision.

## Production cutover and observation

Cutover completed at **2026-11-01 11:32:01 UTC** (19:32 Beijing time), using nginx
candidate `f3de1e3` and API binary `3ae92d3`. CI `41301913982` passed before the
operation. The write gate lasted **2.205 seconds**. Final baseline was total
**1,585**, **151** deduplication identities and **8,460** events; every stored row
and complete 1/30/365-day summary matched Python before opening Go writes.
Public GET returned the unchanged total and a Go request ID. No synthetic
registration or event was sent to production.

The production service is enabled at boot and nginx selects `172.18.0.1:3013`.
Python remains running off traffic for rollback readiness. PR #71 merged as
`dc7a772`; the parallel Vue branch has synchronized the same nginx configuration.
Restricted backups and the completion report are under
`/opt/blog-stack/rehearsals/cutover-20261101-f3de1e3` (mode 0700), including the
original nginx config, Python unit, secret and consistent data snapshots.

Observe through **2026-11-08 11:32 UTC** before retiring Python. Retain the legacy
unit/data backups through at least **2026-12-01 11:32 UTC**. Check actual Go health,
public counter continuity, collection errors and authenticated dashboard data
during observation; elapsed time alone is not acceptance. Post-cutover rollback
must export the latest Go state first, following the procedure below.

## Verified parallel deployment

Revision `3ae92d3` passed CI run `41300631565` and was installed on the VPS on
2026-11-01. `/api/health` reports that revision and `stage2-shadow`; listeners
confirm Go on `127.0.0.1:3012` and the original Python service on `0.0.0.0:3011`.
No nginx upstream was changed and the shadow unit is not enabled at boot.

The restricted VPS snapshot `/opt/blog-stack/rehearsals/metrics-3ae92d3`
contains 1,585 total visits, 151 visitor digests and 8,460 events. Imported visitor
identities and every event row matched the snapshot. Full summary responses for
1, 30 and 365 days matched Python, excluding only the response generation time.
`rehearsal-complete.json` records the aggregate results without identities.

A synthetic registration and event were then sent **only to shadow**. Its export
contained total 1,586, 152 digests and 8,461 events. Python resumed from that export:
the repeated visitor was not counted again, a new visitor incremented once, the
test event remained, and the next event ID exceeded the exported high-water mark.
`rollback/rollback-rehearsal-complete.json` records these checks. Both services
were active afterward. Shadow now contains synthetic rows; **do not use its state
for production cutover**. The final import requires clean production databases.

Desktop E2E against the Go binary, production Nuxt output and an authenticated
nginx dashboard passed: PWA navigation/cache exclusion, real collection/summary,
multi-tab deduplication, counted-browser migration, cookie recovery and lost-response
retry. Production proxy/dashboard changes and one-week observation remain pending.
These rehearsal results do not constitute production cutover.

All seven desktop metrics cases have passed, including anonymous 401 checks for
the dashboard/summary and public collection preflight. An anonymous Playwright
request context must explicitly set `httpCredentials: undefined`; otherwise it
inherits the suite's Basic Auth configuration and silently authenticates.

## Local browser integration

From the repository root, build the production blog output once, then:

```sh
docker compose -f deploy/metrics-e2e/compose.yaml up -d --build
pnpm -F @woodfish-nest/blog exec playwright test --config playwright.metrics.config.ts
docker compose -f deploy/metrics-e2e/compose.yaml down
```

Set `METRICS_E2E_DIST` to an absolute path to reuse an existing verified root-base
production build. The Go databases are disposable tmpfs mounts; restart the API
container for an empty database. Port 4183 and the public `e2e/e2e` Basic Auth
credential belong only to this local fixture. The suite deliberately writes
synthetic metrics and must never target a production database. Screenshots and
failure traces are kept under ignored `output/metrics-e2e`.

## Parallel rehearsal

1. Build the Linux amd64 API and both import commands from the reviewed revision.
   Record the commit and CI run. Copy the executables to the new shadow directory.
2. Install the shadow unit, `systemctl daemon-reload`, then start it. Check
   `/api/health` over loopback, including its commit. Verify Python remains active
   and nginx still points to 3011. No enable-at-boot is needed for rehearsal.
3. Take a consistent legacy analytics snapshot with Python's SQLite backup API,
   not `cp` of a live SQLite main file. Copy the atomically replaced visitor JSON.
   Keep snapshots on the VPS with restricted permissions; do not print identities.
4. Stop the shadow service before importing. Run both import commands against the
   shadow databases as the service's state owner, then restart it. Compare totals
   and complete summary responses for 1, 30 and 365 days. Replay synthetic requests
   only into disposable rehearsal copies; they must not pollute the final import.
5. Removing the shadow service is the rehearsal rollback: stop it, remove its unit,
   and reload systemd. Preserve its data until the rehearsal has been reviewed.

## Final cutover gates

The production `muyu-api.service` uses the verified Docker gateway
`172.18.0.1:3013`. Its separate state is `/var/lib/muyu-api`; do not confuse
it with shadow. `/srv/muyu-data` currently belongs to the live image-bed service
and contains `muyu.sqlite` plus WAL/SHM. Preserve its ownership and files during
stage 2. Unify storage paths during the image-bed migration, after its import and
rollback gates have passed.

The candidate `deploy/nginx.conf` keeps existing Basic Auth, serves the dashboard
from `/opt/blog-stack/sites/analytics-dashboard` through the existing sites mount,
and selects port 3013. A marker at host path
`/opt/blog-stack/nginx/conf.d/metrics-write-gate` causes registration and collection
to return 503 with Retry-After 30; reads and authentication remain available.
Both marker states were checked in isolated nginx containers on the VPS, without
changing the active proxy. A nested bind into a read-only directory needs an
existing mountpoint; the gate test used a separate temporary config directory.

For future migrations, do not merge a new upstream configuration before its final
import and manual cutover: merging triggers site deployment. First validate CI, save
the live nginx config, install a gated version still pointing to Python, and stop
the writers. Import the final snapshots into the clean production Go databases,
start/check Go, then install the candidate while the write gate remains present.
After read/auth checks, remove the gate and record the baseline and timestamp.
Only then merge so subsequent site deployments preserve the selected backend.
Also merge the updated main into the parallel Vue branch before another preview
deployment; its old nginx file would otherwise restore port 3011.

- CI, Python parity, import/export rehearsal and browser analytics/visitor E2E pass.
- Preserve existing nginx Basic Auth for analytics health/summary and the dashboard;
  only collect remains public. Serve dashboard files from nginx after Python stops.
- Overwrite `X-Forwarded-For` with the verified client address at the public proxy.
- Have a tested upstream reachable from the nginx container; the loopback-only
  shadow binding is deliberately not a production upstream.
- Back up nginx, both services' state, and the original secret; keep secrets local.
- Briefly gate metric writes, stop both writers, take final consistent snapshots,
  and import into clean production Go databases. The importer rejects divergent
  rehearsal rows; do not force it or discard production registrations.
- Start Go, check readiness and totals, switch nginx and validate before releasing
  the write gate. Record the exact cutover time and baseline counts.
- Observe for one week before retiring Python. Preserve its unit and backups for
  one month. Do not mark observation complete based on a green deployment.

## Rollback with post-cutover registrations

Do not restore the old pre-cutover JSON or database directly: that loses new data.
Gate metric writes and stop Go and Python before exporting. On the VPS:

```sh
python3 deploy/export-go-metrics.py \
  --database /var/lib/muyu-api/muyu.db \
  --analytics /var/lib/muyu-api/analytics.db \
  --output /opt/blog-stack/rehearsals/rollback-YYYYMMDD-HHMMSS
```

The new directory contains `visitor-count.json`, `analytics.sqlite3`, and a final
`export-complete.json` count report. No completion report means the export failed;
do not install a partial directory. Existing output directories are never replaced.
The full exported state contains the imported baseline plus Go-era increments,
including visitor deduplication identities and the event AUTOINCREMENT high-water
mark. SQLite backup includes committed WAL pages.

Back up the stopped Python data directory as a whole, including any WAL/SHM files.
Install the export into a **new** directory with the original service ownership,
then move the original directory aside and put the new directory at its old path.
Never replace only a database main file while leaving unrelated WAL/SHM files.
Start Python, compare counts, switch nginx back to 3011, run `nginx -t` and reload,
then release the gate and verify repeated visitors are not counted again.
Keep the stopped Go databases for investigation; do not merge two live writers.
