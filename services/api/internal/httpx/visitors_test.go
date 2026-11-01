package httpx

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
)

func TestVisitorHTTPPythonParity(t *testing.T) {
	dir := t.TempDir()
	mainDB, err := db.Open(context.Background(), filepath.Join(dir, "muyu.db"), "muyu")
	if err != nil {
		t.Fatal(err)
	}
	defer mainDB.Close()
	analyticsDB, err := db.Open(context.Background(), filepath.Join(dir, "analytics.db"), "analytics")
	if err != nil {
		t.Fatal(err)
	}
	defer analyticsDB.Close()
	const origin = "https://blog.woodfish.site"
	goServer := httptest.NewServer(New(slog.New(slog.NewTextHandler(io.Discard, nil)), []string{origin}, mainDB, analyticsDB, dir, "test", "test", []byte("test-secret")))
	defer goServer.Close()
	python := "python3"
	if runtime.GOOS == "windows" {
		python = "python"
	}
	source, err := filepath.Abs("../../../../server/visitor-counter.py")
	if err != nil {
		t.Fatal(err)
	}
	legacyFile := filepath.Join(dir, "legacy.json")
	script := `import importlib.util,sys
spec=importlib.util.spec_from_file_location("legacy_counter",sys.argv[1])
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
server=module.create_server("127.0.0.1",0,sys.argv[2],allowed_origin=sys.argv[3])
print(server.server_address[1],flush=True)
server.serve_forever()`
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, python, "-u", "-c", script, source, legacyFile, origin)
	var stderr bytes.Buffer
	command.Stderr = &stderr
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
		t.Fatalf("Python start: %v %s", err, &stderr)
	}
	pythonURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	a, b, c, d := strings.Repeat("a", 32), strings.Repeat("b", 32), strings.Repeat("c", 32), strings.Repeat("d", 32)
	type step struct {
		method, path string
		headers      map[string]string
	}
	sequence := []step{
		{"GET", "/api/visitor-count", nil},
		{"POST", "/api/visitor-count/visit", map[string]string{"X-Visitor-ID": a, "Origin": origin, "X-Forwarded-Proto": "https"}},
		{"POST", "/api/visitor-count/visit", map[string]string{"X-Visitor-ID": a}},
		{"POST", "/api/visitor-count/visit", map[string]string{"Cookie": "woodfish_visitor=" + a, "X-Visitor-ID": b}},
		{"POST", "/api/visitor-count/visit", map[string]string{"Cookie": "woodfish_visitor=" + a, "X-Visitor-ID": "invalid"}},
		{"POST", "/api/visitor-count/visit", map[string]string{"X-Visitor-ID": b, "X-Visitor-Counted": "1"}},
		{"POST", "/api/visitor-count/visit", map[string]string{"X-Visitor-ID": b}},
		{"POST", "/api/visitor-count/visit", map[string]string{"X-Visitor-ID": c, "X-Visitor-Counted": "0"}},
		{"POST", "/api/visitor-count/visit", map[string]string{"X-Visitor-ID": strings.ToUpper(a)}},
		{"POST", "/api/visitor-count/visit", map[string]string{"Cookie": "woodfish_visitor=bad", "X-Visitor-ID": d}},
		{"POST", "/api/visitor-count/visit", map[string]string{"X-Visitor-ID": a, "Origin": "https://untrusted.example"}},
		{"GET", "/api/visitor-count", map[string]string{"Origin": "https://untrusted.example"}},
		{"POST", "/api/visitor-count", nil},
		{"GET", "/api/visitor-count/visit", nil},
		{"OPTIONS", "/api/visitor-count/visit", nil},
	}
	client := &http.Client{Timeout: 5 * time.Second}
	type reply struct {
		status  int
		body    map[string]any
		cookies []http.Cookie
	}
	request := func(base string, step step) reply {
		t.Helper()
		req, err := http.NewRequest(step.method, base+step.path, nil)
		if err != nil {
			t.Fatal(err)
		}
		for key, value := range step.headers {
			req.Header.Set(key, value)
		}
		response, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		result := reply{status: response.StatusCode}
		if err := json.NewDecoder(response.Body).Decode(&result.body); err != nil {
			t.Fatal(err)
		}
		if response.Header.Get("Cache-Control") != "no-store" {
			t.Fatal("missing no-store")
		}
		// The unified API wraps legacy error messages in its documented envelope.
		if envelope, ok := result.body["error"].(map[string]any); ok {
			if envelope["code"] == "" || envelope["requestId"] == "" {
				t.Fatal("incomplete error envelope")
			}
			result.body["error"] = strings.ToLower(envelope["message"].(string))
		}
		for _, cookie := range response.Cookies() {
			cookie.Raw = ""
			cookie.RawExpires = ""
			result.cookies = append(result.cookies, *cookie)
		}
		return result
	}
	for i, step := range sequence {
		expected, actual := request(pythonURL, step), request(goServer.URL, step)
		if !reflect.DeepEqual(actual, expected) {
			t.Fatalf("step %d %s: Go=%+v Python=%+v", i, step.path, actual, expected)
		}
	}
	var legacy struct {
		Total    int64
		Visitors []string
	}
	data, err := os.ReadFile(legacyFile)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &legacy); err != nil {
		t.Fatal(err)
	}
	rows, err := mainDB.Read.Query("SELECT visitor_id FROM visitors ORDER BY visitor_id")
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
	sort.Strings(legacy.Visitors)
	if !reflect.DeepEqual(ids, legacy.Visitors) {
		t.Fatalf("stored IDs: Go=%v Python=%v", ids, legacy.Visitors)
	}
}

func TestVisitorGeneratedIdentityAndStorageFailure(t *testing.T) {
	dir := t.TempDir()
	database, err := db.Open(context.Background(), filepath.Join(dir, "muyu.db"), "muyu")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	router := New(slog.New(slog.NewTextHandler(io.Discard, nil)), nil, database, database, dir, "test", "test", []byte("test-secret"))
	request := func(method, path, cookie string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		if cookie != "" {
			req.Header.Set("Cookie", cookie)
		}
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}
	first := request("POST", "/api/visitor-count/visit", "")
	if first.Code != 200 {
		t.Fatalf("registration: %d %s", first.Code, first.Body)
	}
	cookies := first.Result().Cookies()
	if len(cookies) != 1 || !visitorIDPattern.MatchString(cookies[0].Value) {
		t.Fatalf("cookies=%v", cookies)
	}
	cookie := cookies[0]
	if !cookie.HttpOnly || cookie.MaxAge != 31536000 || cookie.Path != "/" || cookie.SameSite != http.SameSiteLaxMode || cookie.Secure {
		t.Fatalf("cookie=%+v", cookie)
	}
	digest := sha256.Sum256([]byte(cookie.Value))
	var stored string
	if err := database.Read.QueryRow("SELECT visitor_id FROM visitors").Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != hex.EncodeToString(digest[:]) {
		t.Fatalf("identity was not hashed: %s", stored)
	}
	second := request("POST", "/api/visitor-count/visit", visitorCookie+"="+cookie.Value)
	var body struct {
		Total   int64
		Counted bool
	}
	if err := json.Unmarshal(second.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Total != 1 || body.Counted {
		t.Fatalf("repeat=%+v", body)
	}
	if _, err := database.Write.Exec("DROP TABLE visitor_counter"); err != nil {
		t.Fatal(err)
	}
	for _, route := range []struct{ method, path string }{{"GET", "/api/visitor-count"}, {"POST", "/api/visitor-count/visit"}} {
		res := request(route.method, route.path, "")
		if res.Code != 500 || strings.Contains(res.Body.String(), "SQL") {
			t.Fatalf("storage failure: %d %s", res.Code, res.Body)
		}
		validateResponse(t, res, "ErrorEnvelope")
	}
}
