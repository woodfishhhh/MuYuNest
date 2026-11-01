package visitors

import (
	"context"
	"encoding/json"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"strings"
	"sync"
	"testing"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
)

func openStore(t *testing.T) *Store {
	t.Helper()
	database, err := db.Open(context.Background(), filepath.Join(t.TempDir(), "muyu.db"), "muyu")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := database.Close(); err != nil {
			t.Error(err)
		}
	})
	return New(database)
}

func TestPythonRegistrationParity(t *testing.T) {
	python := "python3"
	if runtime.GOOS == "windows" {
		python = "python"
	}
	input := `[{"id":"a","already":false},{"id":"a","already":false},{"id":"b","already":true},{"id":"b","already":false},{"id":"c","already":false},{"id":"a","already":true}]`
	script := `import importlib.util,json,sys
spec=importlib.util.spec_from_file_location("legacy_counter",sys.argv[1])
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
store=module.JsonCounterStore(sys.argv[2])
results=[]
for item in json.load(sys.stdin):
 total,counted=store.register(item["id"],item["already"])
 results.append({"total":total,"counted":counted})
print(json.dumps({"results":results,"visitors":sorted(store._read_payload()["visitors"])}))`
	legacy, err := filepath.Abs("../../../../server/visitor-counter.py")
	if err != nil {
		t.Fatal(err)
	}
	command := exec.Command(python, "-c", script, legacy, filepath.Join(t.TempDir(), "counter.json"))
	command.Stdin = strings.NewReader(input)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("Python reference: %v\n%s", err, output)
	}
	var expected struct {
		Results  []Registration
		Visitors []string
	}
	if err := json.Unmarshal(output, &expected); err != nil {
		t.Fatal(err)
	}
	var sequence []struct {
		ID      string
		Already bool
	}
	if err := json.Unmarshal([]byte(input), &sequence); err != nil {
		t.Fatal(err)
	}
	store := openStore(t)
	var actual []Registration
	for _, item := range sequence {
		result, err := store.Register(context.Background(), item.ID, item.Already)
		if err != nil {
			t.Fatal(err)
		}
		actual = append(actual, result)
	}
	if !reflect.DeepEqual(actual, expected.Results) {
		t.Fatalf("Go=%+v Python=%+v", actual, expected.Results)
	}
	rows, err := store.db.Read.Query("SELECT visitor_id FROM visitors")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	sort.Strings(ids)
	if !reflect.DeepEqual(ids, expected.Visitors) {
		t.Fatalf("Go=%v Python=%v", ids, expected.Visitors)
	}
	total, err := store.Total(context.Background())
	if err != nil || total != 2 {
		t.Fatalf("total=%d err=%v", total, err)
	}
}

func TestConcurrentRegistrationCountsOnce(t *testing.T) {
	store := openStore(t)
	var wg sync.WaitGroup
	counts := make(chan bool, 32)
	for range 32 {
		wg.Go(func() {
			result, err := store.Register(context.Background(), "same-digest", false)
			if err != nil {
				t.Error(err)
				return
			}
			counts <- result.Counted
		})
	}
	wg.Wait()
	close(counts)
	count := 0
	for counted := range counts {
		if counted {
			count++
		}
	}
	total, err := store.Total(context.Background())
	if err != nil || total != 1 || count != 1 {
		t.Fatalf("total=%d newly counted=%d err=%v", total, count, err)
	}
}

func TestFailedIncrementRollsBackIdentity(t *testing.T) {
	store := openStore(t)
	_, err := store.db.Write.Exec(`CREATE TRIGGER reject_increment BEFORE UPDATE ON visitor_counter
	BEGIN SELECT RAISE(FAIL, 'test write failure'); END`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Register(context.Background(), "failed-digest", false); err == nil {
		t.Fatal("expected counter update failure")
	}
	var identities int
	if err := store.db.Read.QueryRow("SELECT COUNT(*) FROM visitors").Scan(&identities); err != nil {
		t.Fatal(err)
	}
	total, err := store.Total(context.Background())
	if err != nil || identities != 0 || total != 0 {
		t.Fatalf("identities=%d total=%d err=%v", identities, total, err)
	}
}
