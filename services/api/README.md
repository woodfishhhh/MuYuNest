# MuYu API

Gin, Go 1.27.3, modernc SQLite, independent embedded goose migrations, sqlc and OpenAPI generation. Implemented routes are `/api/health`, `GET /api/visitor-count`, `POST /api/visitor-count/visit`, and analytics collect/health/summary; other contract routes describe later migration stages and are not registered.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev                 # Nuxt + Go Air; forwards extra arguments to Nuxt
pnpm dev:blog            # frontend only
pnpm api:dev             # Go Air only
pnpm api:build
pnpm api:test
pnpm api:vet
pnpm contract:generate
pnpm api:sqlc
```

Air reads `services/api/.env` when present; copy `.env.example` for local overrides. Default API address is `127.0.0.1:8080`. The existing Nuxt frontend still uses its static content source. API proxying is part of the blog-web migration.

Each database has a single writer and four query-only reader connections. Every connection gets WAL, foreign keys, a 5000ms busy timeout and NORMAL synchronous mode. Health checks persist a probe in both databases and create/remove a file in the image directory, returning 503 on failure. Local data and Air binaries are ignored.

```sh
docker build -t muyu-api:local services/api
docker run --rm --read-only -p 127.0.0.1:8080:8080 \
  -e VISITOR_ANALYTICS_SECRET=development-only-secret \
  --tmpfs /srv/muyu-data:uid=65532,gid=65532 \
  --tmpfs /srv/muyu-images:uid=65532,gid=65532 muyu-api:local
```

The tmpfs example is disposable verification storage, not a production persistence setup. Production migration must back up and rehearse on copies before using existing data directories. The runtime image uses UID 65532.

OpenAPI lives in `packages/api-contract/openapi.yaml`. Go generation selects health, visitor and analytics operations; expand the operation list as handlers are implemented. Do not hand-edit `internal/api/gen.go`, `internal/db/sqlgen`, or the TypeScript schema. CI checks regeneration drift, build, vet, lint, race tests and the container build.

pnpm 11 script-time dependency verification is configured to **error**, not auto-install: implicit non-frozen installs otherwise upgrade the Nuxt nightly dependency graph. Resolve dependency-state errors with an explicit frozen install.

Stage 2 visitor storage and HTTP routing preserve the legacy registration semantics. The
parity test runs the existing Python `JsonCounterStore` with the same registration
sequence and compares both responses and stored identities. Tests require
`python` on Windows or `python3` on Linux. Temporary SQLite databases also verify
concurrent deduplication and transaction rollback; no production files are used.

HTTP parity runs the Python service and Go router on isolated loopback ports.
It compares 15 request cases, cookie attributes and persisted SHA-256 identities.
Error messages use the new API's structured envelope; the parity test normalizes
that documented difference. A valid visitor cookie takes precedence over a valid
header, while an invalid supplied header is still rejected. Only the exact
`X-Visitor-Counted: 1` value suppresses the initial increment. The proxy must
overwrite `X-Forwarded-Proto`, which controls the persistent cookie's Secure flag.
No production import or cutover has been performed yet.

To rehearse visitor migration on a backup (from `services/api`):

```sh
go run ./cmd/import-visitors --source /path/to/visitor-count.json --dry-run
go run ./cmd/import-visitors --source /path/to/visitor-count.json --database /path/to/rehearsal-muyu.db
```

Dry-run validates and summarizes only the source; it does not open the target.
For a real cutover, stop registrations, back up both sides, take the final legacy
snapshot, then import. Repeating the same snapshot adds no visitors. An incremental
snapshot must include every existing target identity and must not lower its total;
otherwise the transaction is rejected. IDs are imported as existing SHA-256
digests, without rehashing or exposing them in reports. A failed write rolls back
both the identity inserts and total update.

Analytics event storage now uses the legacy `analytics_events` schema in the
separate analytics database. Fixed-time Python parity covers event acceptance,
bot filtering, daily HMAC identities, user-agent classification, Unicode field
limits and metric validation. JSON object ordering/Unicode escapes are normalized
when comparing `data_json`; stored values are compared semantically. The existing
180-day retention boundary is preserved. Summary parity covers empty data,
bounded day ranges, distinct visitors/sessions, 30-minute activity, session
durations, bounce rate, filled daily series, ranked groups and Web Vitals.
Analytics HTTP routes are wired. sqlc queries are grouped under
`queries/muyu` and `queries/analytics`, with separate generated packages.

To rehearse analytics migration on a consistent SQLite backup:

```sh
go run ./cmd/import-analytics --source /path/to/analytics.sqlite3 --dry-run
go run ./cmd/import-analytics --source /path/to/analytics.sqlite3 --database /path/to/rehearsal-analytics.db
```

The source is opened read-only and never migrated. Dry-run does not open the
target. Import preserves all event columns, IDs and the AUTOINCREMENT high-water
mark, including deleted IDs. Repeating a snapshot adds nothing; a later snapshot
can add rows only when every existing target row still matches. Divergent rows
or a target sequence ahead of the source reject the transaction. A source whose
retention cleanup removed previously imported rows requires reconciliation or a
fresh rehearsal target. Source and target must be different files. Stop writes
and take consistent backups of both databases before a real cutover; copying a
live SQLite main file without its WAL is not a consistent backup.

Startup now requires `VISITOR_ANALYTICS_SECRET_FILE` or `VISITOR_ANALYTICS_SECRET`.
Production must mount the original Python secret file: changing it changes daily
visitor identities. A configured file takes precedence and file errors never fall
back to the environment. Local development can use the explicit example secret.
Analytics collection preserves the 16 KiB body limit, bot filtering and stricter
Origin requirement (including missing Origin); visitor registration still permits
missing Origin. Summary day ranges clamp to 1–365. The proxy must overwrite
X-Forwarded-For, protect summary/dashboard access with the existing panel
authentication, and serve the dashboard static files. Those deployment changes,
production cutover remain pending. Analytics HTTP parity now replays 24 requests
against isolated Python and Go servers, comparing status, response values,
cache/Allow headers and stored event fields (except wall-clock timestamps).
Blank/repeated/space-padded day parameters follow Python parsing; invalid values
return the documented error envelope with the legacy message.

The [metrics runbook](../../docs/go-metrics-cutover.md) covers isolated VPS
rehearsal and rollback with registrations received after cutover.
`deploy/export-go-metrics.py` exports stopped Go databases into a new directory
that the original Python stores can resume without duplicate counting or reused
event IDs. It never installs files into a live service directory.
