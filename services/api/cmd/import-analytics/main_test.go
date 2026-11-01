package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
)

func TestDryRunAndSameFile(t *testing.T) {
	dir := t.TempDir()
	source, target := filepath.Join(dir, "source.db"), filepath.Join(dir, "target.db")
	database, err := db.Open(context.Background(), source, "analytics")
	if err != nil {
		t.Fatal(err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	if err := run([]string{"--source", source, "--database", target, "--dry-run"}, &output); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatalf("dry-run touched target: %v", err)
	}
	if !strings.Contains(output.String(), `"dryRun":true`) {
		t.Fatalf("report=%s", &output)
	}
	if err := run([]string{"--source", source, "--database", source}, &output); err == nil || !strings.Contains(err.Error(), "different files") {
		t.Fatalf("same file error=%v", err)
	}
	if err := run([]string{"--source", source, "--database", target}, &output); err != nil {
		t.Fatal(err)
	}
}

func TestInvalidSourceDoesNotCreateTarget(t *testing.T) {
	for _, kind := range []string{"missing", "bad-schema"} {
		t.Run(kind, func(t *testing.T) {
			dir := t.TempDir()
			source, target := filepath.Join(dir, "source.db"), filepath.Join(dir, "target.db")
			if kind == "bad-schema" {
				database, err := db.Open(context.Background(), source, "muyu")
				if err != nil {
					t.Fatal(err)
				}
				if err := database.Close(); err != nil {
					t.Fatal(err)
				}
			}
			var output bytes.Buffer
			if err := run([]string{"--source", source, "--database", target}, &output); err == nil {
				t.Fatal("accepted invalid source")
			}
			if _, err := os.Stat(target); !os.IsNotExist(err) {
				t.Fatalf("created target: %v", err)
			}
			if kind == "missing" {
				if _, err := os.Stat(source); !os.IsNotExist(err) {
					t.Fatalf("created source: %v", err)
				}
			}
		})
	}
}
