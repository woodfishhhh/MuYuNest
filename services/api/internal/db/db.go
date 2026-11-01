package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/db/sqlgen"
	"github.com/woodfishhhh/MuYuNest/services/api/migrations"
	_ "modernc.org/sqlite"
)

// Store serializes writes while allowing concurrent WAL readers.
type Store struct {
	Read  *sql.DB
	Write *sql.DB
}

func Open(ctx context.Context, path, migrationSet string) (*Store, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	if err = os.MkdirAll(filepath.Dir(absolute), 0750); err != nil {
		return nil, err
	}
	uriPath := filepath.ToSlash(absolute)
	if filepath.VolumeName(absolute) != "" {
		uriPath = "/" + uriPath
	}
	u := url.URL{Scheme: "file", Path: uriPath}
	q := u.Query()
	// DSN pragmas run for every new connection, not only the initial one.
	for _, pragma := range []string{"journal_mode(WAL)", "foreign_keys(ON)", "busy_timeout(5000)", "synchronous(NORMAL)"} {
		q.Add("_pragma", pragma)
	}
	u.RawQuery = q.Encode()
	writer, err := sql.Open("sqlite", u.String())
	if err != nil {
		return nil, err
	}
	writer.SetMaxOpenConns(1)
	writer.SetMaxIdleConns(1)
	store := &Store{Write: writer}
	fail := func(err error) (*Store, error) { return nil, errors.Join(err, store.Close()) }
	if err = writer.PingContext(ctx); err != nil {
		return fail(fmt.Errorf("open %s: %w", migrationSet, err))
	}
	source, err := fs.Sub(migrations.Files, migrationSet)
	if err != nil {
		return fail(err)
	}
	provider, err := goose.NewProvider(goose.DialectSQLite3, writer, source)
	if err != nil {
		return fail(err)
	}
	if _, err = provider.Up(ctx); err != nil {
		return fail(fmt.Errorf("migrate %s: %w", migrationSet, err))
	}
	q.Add("_pragma", "query_only(ON)")
	u.RawQuery = q.Encode()
	store.Read, err = sql.Open("sqlite", u.String())
	if err != nil {
		return fail(err)
	}
	store.Read.SetMaxOpenConns(4)
	store.Read.SetMaxIdleConns(4)
	if err = store.Read.PingContext(ctx); err != nil {
		return fail(err)
	}
	return store, nil
}

func (s *Store) Close() error {
	var readErr error
	if s.Read != nil {
		readErr = s.Read.Close()
	}
	return errors.Join(readErr, s.Write.Close())
}

// Check exercises a persistent write and a read for readiness probes.
func (s *Store) Check(ctx context.Context) error {
	if err := sqlgen.New(s.Write).WriteHealthProbe(ctx); err != nil {
		return err
	}
	_, err := sqlgen.New(s.Read).ReadHealthProbe(ctx)
	return err
}
