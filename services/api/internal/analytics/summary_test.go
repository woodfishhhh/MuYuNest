package analytics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"
	"time"
)

func TestSummaryPythonParity(t *testing.T) {
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)
	type event struct {
		Payload map[string]any `json:"payload"`
		IP      string         `json:"ip"`
		UA      string         `json:"ua"`
		Time    string         `json:"time"`
	}
	events := []event{}
	add := func(kind, name, path, session, ip, ua string, at time.Time, data any) {
		events = append(events, event{map[string]any{"type": kind, "name": name, "path": path, "sessionId": session, "referrer": "https://EXAMPLE.com/path", "language": "zh-CN", "timezone": "Asia/Shanghai", "data": data}, ip, ua, at.Format(time.RFC3339Nano)})
	}
	for i := range 14 {
		add("pageview", "", fmt.Sprintf("/page-%02d", i), fmt.Sprintf("s-%d", i), "203.0.113.1", "Windows Chrome/140", now.Add(-time.Hour), nil)
	}
	add("pageview", "", "/shared", "shared", "203.0.113.1", "Windows Chrome/140", now.AddDate(0, 0, -1), nil)
	add("pageview", "", "/shared", "shared", "203.0.113.1", "Windows Chrome/140", now, nil)
	add("pageview", "", "/shared", "shared", "203.0.113.1", "Windows Chrome/140", now.Add(90*time.Second), nil)
	add("pageview", "", "/old", "old", "203.0.113.2", "iPad Safari/18", now.AddDate(0, 0, -31), nil)
	add("event", "outbound", "/shared", "event-only", "203.0.113.3", "Android Firefox/140", now, map[string]any{"target": "example"})
	for i, rating := range []string{"good", "needs-improvement", "poor"} {
		add("performance", "vital", "/shared", "metric", "203.0.113.4", "Macintosh Safari/18", now, map[string]any{"metric": "LCP", "value": float64(i)*100 + 0.125, "rating": rating})
	}
	windows := []int{0, 1, 3, 30, 400}
	input := struct {
		Now     string  `json:"now"`
		Events  []event `json:"events"`
		Windows []int   `json:"windows"`
	}{now.Format(time.RFC3339Nano), events, windows}
	encoded, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	script := `import importlib.util,json,sys
from datetime import datetime
spec=importlib.util.spec_from_file_location("legacy",sys.argv[1]);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
source=json.load(sys.stdin);now=datetime.fromisoformat(source["now"].replace("Z","+00:00"));module.utc_now=lambda:now
store=module.AnalyticsStore(sys.argv[2],b"parity-secret")
empty=store.summary(3)
for item in source["events"]:
 store.collect(item["payload"],item["ip"],item["ua"],datetime.fromisoformat(item["time"].replace("Z","+00:00")))
print(json.dumps({"empty":empty,"summaries":[store.summary(days) for days in source["windows"]]}))`
	python := "python3"
	if runtime.GOOS == "windows" {
		python = "python"
	}
	source, err := filepath.Abs("../../../../server/visitor-counter.py")
	if err != nil {
		t.Fatal(err)
	}
	command := exec.Command(python, "-c", script, source, filepath.Join(t.TempDir(), "reference.db"))
	command.Stdin = bytes.NewReader(encoded)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("Python: %v %s", err, output)
	}
	var expected struct {
		Empty     json.RawMessage
		Summaries []json.RawMessage
	}
	if err := json.Unmarshal(output, &expected); err != nil {
		t.Fatal(err)
	}
	compare := func(actual Summary, expected json.RawMessage) {
		t.Helper()
		encoded, err := json.Marshal(actual)
		if err != nil {
			t.Fatal(err)
		}
		var a, b any
		if err := json.Unmarshal(encoded, &a); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(expected, &b); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(a, b) {
			t.Fatalf("window %d:\nGo=%s\nPython=%s", actual.RangeDays, encoded, expected)
		}
	}
	store := testStore(t)
	empty, err := store.Summary(context.Background(), 3, now)
	if err != nil {
		t.Fatal(err)
	}
	compare(empty, expected.Empty)
	for _, event := range events {
		at, err := time.Parse(time.RFC3339Nano, event.Time)
		if err != nil {
			t.Fatal(err)
		}
		accepted, err := store.Collect(context.Background(), event.Payload, event.IP, event.UA, at)
		if err != nil || !accepted {
			t.Fatalf("accepted=%v err=%v", accepted, err)
		}
	}
	for i, days := range windows {
		actual, err := store.Summary(context.Background(), days, now)
		if err != nil {
			t.Fatal(err)
		}
		compare(actual, expected.Summaries[i])
	}
}
