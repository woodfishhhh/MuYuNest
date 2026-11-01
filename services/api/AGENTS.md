# Go API

Run Go commands from `services/api`, or use `go test ./services/api/...` at the repository root.

- SQLite uses modernc (no CGO). Each database has a single writer and a query-only reader pool; set connection-local PRAGMAs in the DSN.
- SQL migrations are embedded from `migrations/muyu` and `migrations/analytics`; apply with independent goose providers, without global migration state.
- Tests use temporary databases, never production paths. Preserve `/srv/muyu-data` and `/srv/muyu-images`.
- Keep runtime data under ignored `data/`. No secrets belong in `.env.example` or test output.
- Format changes with gofmt, build affected packages, then run their tests. CI must eventually include race detection and contract generation drift checks as required by the split plan.
