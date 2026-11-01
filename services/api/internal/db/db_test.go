package db

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

func TestStores(t *testing.T) {
	for _, name := range []string{"muyu", "analytics"} {
		t.Run(name, func(t *testing.T) {
			ctx := context.Background()
			path := filepath.Join(t.TempDir(), "space and 中文", name+".db")
			store, err := Open(ctx, path, name)
			if err != nil {
				t.Fatal(err)
			}
			defer store.Close()
			if err := store.Check(ctx); err != nil {
				t.Fatal(err)
			}
			// Hold multiple connections concurrently to check connection-local pragmas.
			for i := 0; i < 3; i++ {
				conn, err := store.Read.Conn(ctx)
				if err != nil {
					t.Fatal(err)
				}
				defer conn.Close()
				checkPragmas(t, ctx, conn)
				if _, err := conn.ExecContext(ctx, "DELETE FROM health_probe"); err == nil {
					t.Fatal("reader accepted a write")
				}
			}
			writer, err := store.Write.Conn(ctx)
			if err != nil {
				t.Fatal(err)
			}
			checkPragmas(t, ctx, writer)
			writer.Close()
			if _, err := store.Write.ExecContext(ctx, "CREATE VIRTUAL TABLE search_probe USING fts5(body, tokenize='trigram')"); err != nil {
				t.Fatal(err)
			}
			// Running migrations twice must preserve existing data and schema.
			second, err := Open(ctx, path, name)
			if err != nil {
				t.Fatal(err)
			}
			defer second.Close()
			if err := second.Check(ctx); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func checkPragmas(t *testing.T, ctx context.Context, conn *sql.Conn) {
	t.Helper()
	for key, want := range map[string]string{"journal_mode": "wal", "foreign_keys": "1", "busy_timeout": "5000", "synchronous": "1"} {
		var got string
		if err := conn.QueryRowContext(ctx, "PRAGMA "+key).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Errorf("%s = %s, want %s", key, got, want)
		}
	}
}

func TestInvalidStorage(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "invalid.db")
	if err := os.WriteFile(path, []byte("not a sqlite database"), 0600); err != nil {
		t.Fatal(err)
	}
	if store, err := Open(context.Background(), path, "muyu"); err == nil {
		store.Close()
		t.Fatal("corrupt database accepted")
	}
	if store, err := Open(context.Background(), filepath.Join(dir, "unknown.db"), "missing"); err == nil {
		store.Close()
		t.Fatal("missing migrations accepted")
	}
	if store, err := Open(context.Background(), filepath.Join(path, "nested.db"), "muyu"); err == nil {
		store.Close()
		t.Fatal("file used as parent directory")
	}
}
