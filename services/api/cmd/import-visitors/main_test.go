package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDryRunNeverOpensTarget(t *testing.T) {
	dir := t.TempDir()
	source, target := filepath.Join(dir, "visitor-count.json"), filepath.Join(dir, "muyu.db")
	if err := os.WriteFile(source, []byte(`{"total":42}`), 0600); err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	if err := run([]string{"--source", source, "--database", target, "--dry-run"}, &output); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatalf("dry-run touched target: %v", err)
	}
	if !strings.Contains(output.String(), `"dryRun":true`) || !strings.Contains(output.String(), `"total":42`) {
		t.Fatalf("report=%s", &output)
	}
	if err := run([]string{"--source", source, "--database", target}, &output); err != nil {
		t.Fatal(err)
	}
	if err := run([]string{"--source", source, "--database", target}, &output); err != nil {
		t.Fatal(err)
	}
}

func TestInvalidSnapshotDoesNotCreateTarget(t *testing.T) {
	dir := t.TempDir()
	source, target := filepath.Join(dir, "visitor-count.json"), filepath.Join(dir, "muyu.db")
	if err := os.WriteFile(source, []byte(`{"total":false}`), 0600); err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	if err := run([]string{"--source", source, "--database", target}, &output); err == nil {
		t.Fatal("accepted invalid source")
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatalf("created target: %v", err)
	}
}
