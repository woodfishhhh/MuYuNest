package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/analytics"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
)

func run(args []string, output io.Writer) error {
	flags := flag.NewFlagSet("import-analytics", flag.ContinueOnError)
	source := flags.String("source", "", "legacy analytics.sqlite3 snapshot")
	target := flags.String("database", "", "target analytics.db")
	dryRun := flags.Bool("dry-run", false, "inspect source without opening target")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if *source == "" || (!*dryRun && *target == "") || flags.NArg() != 0 {
		return fmt.Errorf("use --source FILE and either --dry-run or --database FILE")
	}
	report, err := analytics.InspectLegacy(context.Background(), *source)
	if err != nil {
		return err
	}
	if *dryRun {
		return json.NewEncoder(output).Encode(struct {
			analytics.LegacyReport
			DryRun bool `json:"dryRun"`
		}{report, true})
	}
	sourceInfo, err := os.Stat(*source)
	if err != nil {
		return err
	}
	if targetInfo, err := os.Stat(*target); err == nil {
		if os.SameFile(sourceInfo, targetInfo) {
			return fmt.Errorf("source and target must be different files")
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	targetDB, err := db.Open(context.Background(), *target, "analytics")
	if err != nil {
		return err
	}
	defer targetDB.Close()
	imported, err := analytics.New(targetDB, nil).ImportLegacy(context.Background(), *source)
	if err != nil {
		return err
	}
	return json.NewEncoder(output).Encode(imported)
}

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
