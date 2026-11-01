# Go metrics rehearsal and rollback

The draft Go metrics implementation does not change nginx or stop Python.
Use `deploy/muyu-api-shadow.service` for parallel testing on **127.0.0.1:3012**.
The existing Python service remains on port 3011. The shadow service has separate
state in `/var/lib/muyu-api-shadow`; it must never point at the Python data files.
Its executable lives at `/opt/blog-stack/services/muyu-api-shadow/api`.
Systemd `LoadCredential` supplies the original HMAC secret without changing its
permissions or printing it. Install only the binary from a verified revision.

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
  --database /srv/muyu-data/muyu.db \
  --analytics /srv/muyu-data/analytics.db \
  --output /srv/muyu-data/rollback-YYYYMMDD-HHMMSS
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
