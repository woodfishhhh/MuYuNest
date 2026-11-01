# MuYu API

Gin, Go 1.27.3, modernc SQLite, independent embedded goose migrations, sqlc and OpenAPI generation. Implemented routes are `/api/health`, `GET /api/visitor-count` and `POST /api/visitor-count/visit`; other contract routes describe later migration stages and are not registered.

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
  --tmpfs /srv/muyu-data:uid=65532,gid=65532 \
  --tmpfs /srv/muyu-images:uid=65532,gid=65532 muyu-api:local
```

The tmpfs example is disposable verification storage, not a production persistence setup. Production migration must back up and rehearse on copies before using existing data directories. The runtime image uses UID 65532.

OpenAPI lives in `packages/api-contract/openapi.yaml`. Go generation selects health and visitor operations; expand the operation list as handlers are implemented. Do not hand-edit `internal/api/gen.go`, `internal/db/sqlgen`, or the TypeScript schema. CI checks regeneration drift, build, vet, lint, race tests and the container build.

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
No import or production cutover has been performed yet.
