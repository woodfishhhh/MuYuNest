package migrations

import "embed"

//go:embed muyu/*.sql analytics/*.sql
var Files embed.FS
