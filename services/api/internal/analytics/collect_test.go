package analytics

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/db/analyticssql"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	database, err := db.Open(context.Background(), filepath.Join(t.TempDir(), "analytics.db"), "analytics")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := database.Close(); err != nil {
			t.Error(err)
		}
	})
	return New(database, []byte("parity-secret"))
}

func TestCollectPythonParity(t *testing.T) {
	type item struct {
		Payload any    `json:"payload"`
		IP      string `json:"ip"`
		UA      string `json:"ua"`
		Now     string `json:"now"`
	}
	var cases []item
	add := func(raw, ua string) {
		var payload any
		if err := json.Unmarshal([]byte(raw), &payload); err != nil {
			t.Fatal(err)
		}
		cases = append(cases, item{payload, "203.0.113.7", ua, "2026-11-01T12:34:56.789Z"})
	}
	page := `{"type":"pageview","sessionId":"s:1","path":" /posts/中文?private=1#anchor ","title":" 标题 ","referrer":"https://EXAMPLE.COM/path","language":"zh-CN","timezone":"Asia/Shanghai"}`
	for _, ua := range []string{"Windows Chrome/140 Edg/140", "Linux Chrome/140 OPR/90", "iPhone CriOS/140 Mobile", "iPad Safari/18", "Android Chrome/140 Mobile", "Macintosh Firefox/140", "", "Googlebot"} {
		add(page, ua)
	}
	add(`{"type":"unsupported"}`, "HeadlessChrome")
	for _, raw := range []string{`null`, `[]`, `{}`, `{"type":"wrong"}`, `{"type":"pageview","sessionId":"bad space"}`, `{"type":"event","sessionId":"a"}`, `{"type":"event","sessionId":"a","name":"click","data":[1]}`} {
		add(raw, "Chrome/140")
	}
	for _, data := range []string{`false`, `0`, `""`, `[]`, `null`, `{"empty":"  ","bool":true,"nested":{},"array":[],"null":null,"number":4.5}`} {
		add(`{"type":"event","sessionId":"a","name":"click","data":`+data+`}`, "Firefox/140")
	}
	for _, metric := range []string{`{"metric":"lcp","value":12.5,"rating":" good "}`, `{"metric":"CLS","value":true}`, `{"metric":"CLS","value":false}`, `{"metric":"FCP","value":600000}`, `{"metric":"TTFB","value":0}`, `{"metric":"INP","value":1}`, `{"metric":"LCP","value":-1}`, `{"metric":"LCP","value":600001}`, `{"metric":"LCP","value":"1"}`} {
		add(`{"type":"performance","sessionId":"a","name":"vital","data":`+metric+`}`, "Safari/18")
	}
	many := map[string]any{}
	for i := range 17 {
		many[strings.Repeat("k", i+1)] = float64(i)
	}
	cases = append(cases, item{map[string]any{"type": "event", "sessionId": "s", "name": "wide", "data": many}, "127.0.0.1", "Chrome/140", "2026-11-01T12:34:56.789Z"})
	cases = append(cases, item{map[string]any{"type": "event", "sessionId": strings.Repeat("s", 90), "name": strings.Repeat("名🙂", 50), "title": strings.Repeat("题🙂", 120), "data": map[string]any{strings.Repeat("键", 60): strings.Repeat("文🙂", 100)}}, "203.0.113.8", "Chrome/140", "2026-11-02T12:34:56.789Z"})
	encoded, err := json.Marshal(cases)
	if err != nil {
		t.Fatal(err)
	}
	script := `import importlib.util,json,sys
from datetime import datetime
spec=importlib.util.spec_from_file_location("legacy",sys.argv[1]);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
store=module.AnalyticsStore(sys.argv[2],b"parity-secret")
results=[]
for item in json.load(sys.stdin):
 try:
  accepted=store.collect(item["payload"],item["ip"],item["ua"],datetime.fromisoformat(item["now"].replace("Z","+00:00")))
  results.append({"accepted":accepted,"invalid":False})
 except ValueError: results.append({"accepted":False,"invalid":True})
with store._connect() as connection: rows=[dict(row) for row in connection.execute("SELECT * FROM analytics_events ORDER BY id")]
for row in rows: row["data_json"]=json.loads(row["data_json"])
print(json.dumps({"results":results,"events":rows}))`
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
	type outcome struct {
		Accepted bool `json:"accepted"`
		Invalid  bool `json:"invalid"`
	}
	var expected struct {
		Results []outcome
		Events  []map[string]any
	}
	if err := json.Unmarshal(output, &expected); err != nil {
		t.Fatal(err)
	}
	store := testStore(t)
	var actual []outcome
	for _, item := range cases {
		now, err := time.Parse(time.RFC3339Nano, item.Now)
		if err != nil {
			t.Fatal(err)
		}
		accepted, err := store.Collect(context.Background(), item.Payload, item.IP, item.UA, now)
		if err != nil && !errors.Is(err, ErrInvalidEvent) {
			t.Fatal(err)
		}
		actual = append(actual, outcome{accepted, errors.Is(err, ErrInvalidEvent)})
	}
	if !reflect.DeepEqual(actual, expected.Results) {
		t.Fatalf("outcomes:\nGo=%+v\nPython=%+v", actual, expected.Results)
	}
	events, err := analyticssql.New(store.db.Read).ListEvents(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var actualEvents []map[string]any
	for _, event := range events {
		encoded, err := json.Marshal(event)
		if err != nil {
			t.Fatal(err)
		}
		var row map[string]any
		if err := json.Unmarshal(encoded, &row); err != nil {
			t.Fatal(err)
		}
		row["metric_value"] = nil
		if event.MetricValue.Valid {
			row["metric_value"] = event.MetricValue.Float64
		}
		var data any
		if err := json.Unmarshal([]byte(event.DataJson), &data); err != nil {
			t.Fatal(err)
		}
		row["data_json"] = data
		actualEvents = append(actualEvents, row)
	}
	if len(actualEvents) != len(expected.Events) {
		t.Fatalf("rows Go=%d Python=%d", len(actualEvents), len(expected.Events))
	}
	for i, row := range actualEvents {
		if !reflect.DeepEqual(row, expected.Events[i]) {
			t.Fatalf("event %d:\nGo=%+v\nPython=%+v", i, row, expected.Events[i])
		}
	}
}

func TestRetentionBoundary(t *testing.T) {
	store := testStore(t)
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)
	for _, offset := range []int{-181, -180, 0} {
		accepted, err := store.Collect(context.Background(), map[string]any{"type": "pageview", "sessionId": "s"}, "127.0.0.1", "Chrome/140", now.AddDate(0, 0, offset))
		if err != nil || !accepted {
			t.Fatalf("accepted=%v err=%v", accepted, err)
		}
	}
	events, err := analyticssql.New(store.db.Read).ListEvents(context.Background())
	if err != nil || len(events) != 2 {
		t.Fatalf("events=%v err=%v", events, err)
	}
	if events[0].EventDay != now.AddDate(0, 0, -180).Format("2006-01-02") {
		t.Fatalf("cutoff=%s", events[0].EventDay)
	}
}
