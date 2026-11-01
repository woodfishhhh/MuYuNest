package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/visitors"
)

func run(args []string, output io.Writer) error {
	flags := flag.NewFlagSet("import-visitors", flag.ContinueOnError)
	source := flags.String("source", "", "legacy visitor-count.json snapshot")
	database := flags.String("database", "", "target muyu.db (required for a real import)")
	dryRun := flags.Bool("dry-run", false, "validate and summarize source without opening the target")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if *source == "" || (!*dryRun && *database == "") || flags.NArg() != 0 {
		return fmt.Errorf("use --source FILE and either --dry-run or --database FILE")
	}
	file, err := os.Open(*source)
	if err != nil {
		return err
	}
	defer file.Close()
	snapshot, err := visitors.ReadSnapshot(file)
	if err != nil {
		return err
	}
	if *dryRun {
		return json.NewEncoder(output).Encode(struct {
			visitors.SnapshotSummary
			DryRun bool `json:"dryRun"`
		}{snapshot.Summary(), true})
	}
	store, err := db.Open(context.Background(), *database, "muyu")
	if err != nil {
		return err
	}
	defer store.Close()
	result, err := visitors.New(store).Import(context.Background(), snapshot)
	if err != nil {
		return err
	}
	return json.NewEncoder(output).Encode(result)
}

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
