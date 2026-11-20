package migrations

import "embed"

//go:embed muyu/*.sql analytics/*.sql obituary/*.sql
var Files embed.FS
