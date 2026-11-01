package visitors

import (
	"context"
	"fmt"
	"strings"
	"testing"
)

func snapshot(t *testing.T, total int64, ids ...string) Snapshot {
	t.Helper()
	source := fmt.Sprintf(`{"total":%d,"visitors":[%s]}`, total, strings.Join(ids, ","))
	result, err := ReadSnapshot(strings.NewReader(source))
	if err != nil {
		t.Fatal(err)
	}
	return result
}

func TestSnapshotValidation(t *testing.T) {
	for _, source := range []string{`{}`, `null`, `{"total":null}`, `{"total":-1}`, `{"total":1.5}`, `{"total":true}`, `{"total":1,"visitors":["raw-identity"]}`, `{"total":1} {}`} {
		if _, err := ReadSnapshot(strings.NewReader(source)); err == nil {
			t.Errorf("accepted %s", source)
		}
	}
	if got := snapshot(t, 100).Summary(); got.Total != 100 || got.Visitors != 0 {
		t.Fatalf("legacy total-only snapshot: %+v", got)
	}
}

func TestImportIsRepeatableAndPreservesRegistrations(t *testing.T) {
	store := openStore(t)
	a, b := strings.Repeat("a", 64), strings.Repeat("b", 64)
	first := snapshot(t, 100, fmt.Sprintf("%q", a), fmt.Sprintf("%q", a))
	result, err := store.Import(context.Background(), first)
	if err != nil || result.Total != 100 || result.AddedVisitors != 1 || result.Visitors != 1 {
		t.Fatalf("first=%+v err=%v", result, err)
	}
	result, err = store.Import(context.Background(), first)
	if err != nil || result.PreviousTotal != 100 || result.AddedVisitors != 0 {
		t.Fatalf("repeat=%+v err=%v", result, err)
	}
	registered, err := store.Register(context.Background(), a, false)
	if err != nil || registered.Counted || registered.Total != 100 {
		t.Fatalf("imported identity recounted: %+v %v", registered, err)
	}
	registered, err = store.Register(context.Background(), b, false)
	if err != nil || !registered.Counted || registered.Total != 101 {
		t.Fatalf("new identity: %+v %v", registered, err)
	}
	for _, stale := range []Snapshot{first, snapshot(t, 102, fmt.Sprintf("%q", a))} {
		if _, err := store.Import(context.Background(), stale); err == nil {
			t.Fatal("accepted a stale or divergent snapshot")
		}
	}
	total, err := store.Total(context.Background())
	if err != nil || total != 101 {
		t.Fatalf("rejection changed total=%d err=%v", total, err)
	}
	result, err = store.Import(context.Background(), snapshot(t, 102, fmt.Sprintf("%q", a), fmt.Sprintf("%q", b)))
	if err != nil || result.Total != 102 || result.AddedVisitors != 0 {
		t.Fatalf("incremental=%+v err=%v", result, err)
	}
}

func TestImportRollsBackOnWriteFailure(t *testing.T) {
	store := openStore(t)
	_, err := store.db.Write.Exec(`CREATE TRIGGER reject_import BEFORE UPDATE ON visitor_counter BEGIN SELECT RAISE(FAIL,'test failure'); END`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Import(context.Background(), snapshot(t, 10, fmt.Sprintf("%q", strings.Repeat("a", 64)))); err == nil {
		t.Fatal("expected write failure")
	}
	var count int
	if err := store.db.Read.QueryRow("SELECT COUNT(*) FROM visitors").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("partially imported %d identities", count)
	}
}
