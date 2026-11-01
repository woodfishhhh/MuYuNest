package httpx

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/api"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
)

func TestHealthAndOrigins(t *testing.T) {
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
	router := New(slog.New(slog.NewJSONHandler(io.Discard, nil)), []string{"https://blog.woodfish.site"}, mainDB, analyticsDB, dir, "test", "abc")
	request := func(origin string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}
	res := request("https://blog.woodfish.site")
	validateResponse(t, res, "Health")
	if res.Code != 200 {
		t.Fatalf("health: %d %s", res.Code, res.Body)
	}
	var body map[string]string
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["version"] != "test" || body["commit"] != "abc" {
		t.Fatalf("version: %v", body)
	}
	if res.Header().Get("X-Request-ID") == "" {
		t.Fatal("missing request id")
	}
	if res.Header().Get("Access-Control-Allow-Origin") != "https://blog.woodfish.site" {
		t.Fatal("missing CORS origin")
	}
	if got := request("https://untrusted.example"); got.Code != 403 {
		t.Fatalf("origin: %d", got.Code)
	}
	if _, err := analyticsDB.Write.Exec("DROP TABLE health_probe"); err != nil {
		t.Fatal(err)
	}
	if got := request(""); got.Code != 503 {
		t.Fatalf("unhealthy analytics: %d", got.Code)
	} else {
		validateResponse(t, got, "ErrorEnvelope")
	}
}

func validateResponse(t *testing.T, res *httptest.ResponseRecorder, schema string) {
	t.Helper()
	spec, err := api.GetSpec()
	if err != nil {
		t.Fatal(err)
	}
	var body any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if err := spec.Components.Schemas[schema].Value.VisitJSON(body); err != nil {
		t.Fatal(err)
	}
}
