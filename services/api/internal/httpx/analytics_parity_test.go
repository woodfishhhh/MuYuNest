package httpx

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
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

func TestAnalyticsHTTPPythonParity(t *testing.T) {
	dir := t.TempDir()
	mainDB, err := db.Open(context.Background(), filepath.Join(dir, "main.db"), "muyu")
	if err != nil {
		t.Fatal(err)
	}
	defer mainDB.Close()
	stats, err := db.Open(context.Background(), filepath.Join(dir, "analytics.db"), "analytics")
	if err != nil {
		t.Fatal(err)
	}
	defer stats.Close()
	const origin = "https://blog.woodfish.site"
	goServer := httptest.NewServer(New(slog.New(slog.NewTextHandler(io.Discard, nil)), []string{origin}, mainDB, stats, dir, "test", "test", []byte("test-secret")))
	defer goServer.Close()
	python := "python3"
	if runtime.GOOS == "windows" {
		python = "python"
	}
	source, err := filepath.Abs("../../../../server/visitor-counter.py")
	if err != nil {
		t.Fatal(err)
	}
	legacyPath := filepath.Join(dir, "legacy.db")
	script := `import importlib.util,sys
spec=importlib.util.spec_from_file_location("legacy",sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
s=m.create_server("127.0.0.1",0,sys.argv[2],analytics_data_file=sys.argv[3],allowed_origin=sys.argv[4])
print(s.server_address[1],flush=True)
s.serve_forever()`
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, python, "-u", "-c", script, source, filepath.Join(dir, "visitors.json"), legacyPath, origin)
	stdout, err := command.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := command.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { cancel(); _ = command.Wait() }()
	var port int
	if _, err := fmt.Fscan(bufio.NewReader(stdout), &port); err != nil {
		t.Fatal(err)
	}
	pythonURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	type step struct{ method, path, body, origin, ua string }
	steps := []step{
		{"GET", "health", "", "https://untrusted.test", ""},
		{"POST", "collect", `{"type":"pageview","sessionId":"s","path":"/中文","title":"文章"}`, origin, "Chrome/140"},
		{"POST", "collect", `{"type":"event","sessionId":"s","name":"click","data":false}`, origin, "Chrome/140"},
		{"POST", "collect", `{"type":"performance","sessionId":"s","name":"vital","data":{"metric":"LCP","value":42}}`, origin, "Chrome/140"},
		{"POST", "collect", `{"type":"bad"}`, origin, "Googlebot"},
		{"POST", "collect", `null`, origin, "Googlebot"},
		{"POST", "collect", `[]`, origin, "Chrome/140"},
		{"POST", "collect", `{}`, "", "Chrome/140"},
		{"POST", "collect", `{}`, "https://untrusted.test", "Chrome/140"},
		{"POST", "collect", "", origin, ""},
		{"POST", "collect", strings.Repeat(" ", 16385), origin, ""},
		{"POST", "collect", "{} {}", origin, ""},
		{"POST", "collect", string([]byte{'"', 0xff, '"'}), origin, ""},
		{"OPTIONS", "collect", "", "https://untrusted.test", ""},
		{"OPTIONS", "summary", "", "", ""},
		{"GET", "collect", "", "", ""},
		{"POST", "health", "", "", ""},
		{"GET", "summary?days=1", "", "", ""},
		{"GET", "summary?days=0", "", "", ""},
		{"GET", "summary?days=366", "", "", ""},
		{"GET", "summary?days=bad", "", "", ""},
		{"GET", "summary?days=", "", "", ""},
		{"GET", "summary?days=1&days=2", "", "", ""},
		{"GET", "summary?days=%202%20", "", "", ""},
	}
	client := &http.Client{Timeout: 5 * time.Second}
	type reply struct {
		Status       int
		Body         map[string]any
		Cache, Allow string
	}
	request := func(base string, step step) reply {
		t.Helper()
		req, err := http.NewRequest(step.method, base+"/api/analytics/"+step.path, strings.NewReader(step.body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", step.origin)
		req.Header.Set("User-Agent", step.ua)
		req.Header.Set("X-Forwarded-For", "203.0.113.7, 10.0.0.1")
		response, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		result := reply{Status: response.StatusCode, Cache: response.Header.Get("Cache-Control"), Allow: response.Header.Get("Allow")}
		if response.StatusCode != 204 {
			if err := json.NewDecoder(response.Body).Decode(&result.Body); err != nil {
				t.Fatal(err)
			}
			if envelope, ok := result.Body["error"].(map[string]any); ok {
				result.Body["error"] = envelope["message"]
			}
			// Wall-clock timestamps differ between the two sequential HTTP requests.
			delete(result.Body, "generatedAt")
		}
		return result
	}
	for i, step := range steps {
		t.Run(fmt.Sprintf("%02d_%s", i, step.path), func(t *testing.T) {
			expected, actual := request(pythonURL, step), request(goServer.URL, step)
			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Go=%+v Python=%+v", actual, expected)
			}
		})
	}
	legacy, err := sql.Open("sqlite", legacyPath)
	if err != nil {
		t.Fatal(err)
	}
	defer legacy.Close()
	expected, err := analyticssql.New(legacy).ListEvents(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	actual, err := analyticssql.New(stats.Read).ListEvents(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(actual) != len(expected) {
		t.Fatalf("Go rows=%d Python=%d", len(actual), len(expected))
	}
	for i := range actual {
		actual[i].OccurredAt = ""
		expected[i].OccurredAt = ""
		var a, b any
		if err := json.Unmarshal([]byte(actual[i].DataJson), &a); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal([]byte(expected[i].DataJson), &b); err != nil {
			t.Fatal(err)
		}
		actual[i].DataJson = ""
		expected[i].DataJson = ""
		if !reflect.DeepEqual(a, b) || !reflect.DeepEqual(actual[i], expected[i]) {
			t.Errorf("row %d: Go=%+v Python=%+v", i, actual[i], expected[i])
		}
	}
}
