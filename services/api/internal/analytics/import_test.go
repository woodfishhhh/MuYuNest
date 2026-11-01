package analytics

import (
	"context"
	"database/sql"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db/analyticssql"
)

func legacyFixture(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "统计 snapshot.db")
	python := "python3"
	if runtime.GOOS == "windows" {
		python = "python"
	}
	source, err := filepath.Abs("../../../../server/visitor-counter.py")
	if err != nil {
		t.Fatal(err)
	}
	script := `import importlib.util,sys
from datetime import datetime,timezone
spec=importlib.util.spec_from_file_location("legacy",sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
s=m.AnalyticsStore(sys.argv[2],b"secret")
for i in range(3):
 s.collect({"type":"pageview","sessionId":"session","path":"/中文","title":"标题"},"127.0.0.1","Chrome/140",datetime(2026,11,1,tzinfo=timezone.utc))
with s._connect() as c: c.execute("DELETE FROM analytics_events WHERE id=3")`
	if out, err := exec.Command(python, "-c", script, source, path).CombinedOutput(); err != nil {
		t.Fatalf("Python: %v %s", err, out)
	}
	return path
}

func TestImportLegacyPreservesRowsAndSequence(t *testing.T) {
	ctx := context.Background()
	path := legacyFixture(t)
	inspected, err := InspectLegacy(ctx, path)
	if err != nil || inspected != (LegacyReport{Events: 2, MaxID: 2, Sequence: 3}) {
		t.Fatalf("inspect=%+v err=%v", inspected, err)
	}
	store := testStore(t)
	for _, added := range []int64{2, 0} {
		report, err := store.ImportLegacy(ctx, path)
		if err != nil || report.Added != added || report.LegacyReport != inspected {
			t.Fatalf("import=%+v err=%v", report, err)
		}
	}
	uri, err := legacyURI(path)
	if err != nil {
		t.Fatal(err)
	}
	source, err := sql.Open("sqlite", uri)
	if err != nil {
		t.Fatal(err)
	}
	defer source.Close()
	expected, err := analyticssql.New(source).ListEvents(ctx)
	if err != nil {
		t.Fatal(err)
	}
	actual, err := analyticssql.New(store.db.Read).ListEvents(ctx)
	if err != nil || !reflect.DeepEqual(actual, expected) {
		t.Fatalf("rows differ: %v", err)
	}
	if _, err := source.Exec("DELETE FROM analytics_events"); err == nil {
		t.Fatal("source connection is writable")
	}
	var id int64
	err = store.db.Write.QueryRow(`INSERT INTO analytics_events(occurred_at,event_day,event_type,path,session_id,visitor_id,browser,operating_system,device) VALUES('now','2026-11-01','pageview','/','s','v','b','os','desktop') RETURNING id`).Scan(&id)
	if err != nil || id != 4 {
		t.Fatalf("next id=%d err=%v", id, err)
	}
	if _, err := store.ImportLegacy(ctx, path); err == nil {
		t.Fatal("accepted divergent target")
	}
	rows, err := analyticssql.New(store.db.Read).ListEvents(ctx)
	if err != nil || len(rows) != 3 {
		t.Fatalf("conflict changed rows: %v %v", rows, err)
	}
}

func TestImportLegacyRollbackAndDetach(t *testing.T) {
	ctx := context.Background()
	path := legacyFixture(t)
	store := testStore(t)
	if _, err := store.db.Write.Exec(`CREATE TRIGGER fail_import BEFORE INSERT ON analytics_events WHEN NEW.id=2 BEGIN SELECT RAISE(ABORT,'injected failure'); END`); err != nil {
		t.Fatal(err)
	}
	if _, err := store.ImportLegacy(ctx, path); err == nil {
		t.Fatal("expected write failure")
	}
	rows, err := analyticssql.New(store.db.Read).ListEvents(ctx)
	if err != nil || len(rows) != 0 {
		t.Fatalf("partial import: %v %v", rows, err)
	}
	if _, err := store.db.Write.Exec("DROP TRIGGER fail_import"); err != nil {
		t.Fatal(err)
	}
	report, err := store.ImportLegacy(ctx, path)
	if err != nil || report.Added != 2 {
		t.Fatalf("retry=%+v err=%v", report, err)
	}
	if _, err := store.db.Write.Exec("UPDATE analytics_events SET title='changed' WHERE id=1"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.ImportLegacy(ctx, path); err == nil {
		t.Fatal("overwrote conflicting row")
	}
	var title string
	if err := store.db.Read.QueryRow("SELECT title FROM analytics_events WHERE id=1").Scan(&title); err != nil || title != "changed" {
		t.Fatalf("title=%q err=%v", title, err)
	}
}
