package visitors

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"regexp"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db/sqlgen"
)

type Snapshot struct {
	total int64
	ids   map[string]struct{}
}
type SnapshotSummary struct {
	Total    int64 `json:"total"`
	Visitors int   `json:"visitors"`
}
type ImportResult struct {
	SnapshotSummary
	PreviousTotal int64 `json:"previousTotal"`
	AddedVisitors int   `json:"addedVisitors"`
}

var digestPattern = regexp.MustCompile(`^[a-f0-9]{64}$`)

// ReadSnapshot validates the legacy file once, before a target database is opened.
func ReadSnapshot(reader io.Reader) (Snapshot, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return Snapshot{}, err
	}
	var input struct {
		Total    *int64   `json:"total"`
		Visitors []string `json:"visitors"`
	}
	if err := json.Unmarshal(data, &input); err != nil {
		return Snapshot{}, fmt.Errorf("parse visitor snapshot: %w", err)
	}
	if input.Total == nil || *input.Total < 0 {
		return Snapshot{}, fmt.Errorf("visitor snapshot requires a nonnegative integer total")
	}
	snapshot := Snapshot{total: *input.Total, ids: make(map[string]struct{}, len(input.Visitors))}
	for i, id := range input.Visitors {
		if !digestPattern.MatchString(id) {
			return Snapshot{}, fmt.Errorf("visitor snapshot entry %d is not a SHA-256 digest", i)
		}
		snapshot.ids[id] = struct{}{}
	}
	return snapshot, nil
}

func (s Snapshot) Summary() SnapshotSummary {
	return SnapshotSummary{Total: s.total, Visitors: len(s.ids)}
}

// Import is repeatable while Go remains off traffic. It rejects stale snapshots
// and target-only visitors instead of erasing registrations made after a cutover.
func (s *Store) Import(ctx context.Context, snapshot Snapshot) (ImportResult, error) {
	tx, err := s.db.Write.BeginTx(ctx, nil)
	if err != nil {
		return ImportResult{}, err
	}
	defer tx.Rollback()
	queries := sqlgen.New(tx)
	before, err := queries.VisitorTotal(ctx)
	if err != nil {
		return ImportResult{}, err
	}
	if snapshot.total < before {
		return ImportResult{}, fmt.Errorf("snapshot total %d is below target total %d", snapshot.total, before)
	}
	existing, err := queries.ListVisitorIDs(ctx)
	if err != nil {
		return ImportResult{}, err
	}
	for _, id := range existing {
		if _, ok := snapshot.ids[id]; !ok {
			return ImportResult{}, fmt.Errorf("target contains a visitor absent from the snapshot; stop traffic and reconcile before importing")
		}
	}
	for id := range snapshot.ids {
		if _, err := queries.RegisterVisitor(ctx, id); err != nil {
			return ImportResult{}, err
		}
	}
	if err := queries.SetVisitorTotal(ctx, snapshot.total); err != nil {
		return ImportResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return ImportResult{}, err
	}
	return ImportResult{SnapshotSummary: snapshot.Summary(), PreviousTotal: before, AddedVisitors: len(snapshot.ids) - len(existing)}, nil
}
