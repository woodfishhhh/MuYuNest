package httpx

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
)

func TestAnalyticsHTTP(t *testing.T) {
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
	router := New(slog.New(slog.NewTextHandler(io.Discard, nil)), []string{origin}, mainDB, stats, dir, "test", "test", []byte("secret"))
	for _, tc := range []struct {
		name, method, path, body, origin, ua string
		status                               int
	}{
		{"collect", "POST", "collect", `{"type":"pageview","sessionId":"s","path":"/中文"}`, origin, "Chrome/140", 202},
		{"bot", "POST", "collect", `{"type":"wrong"}`, origin, "Googlebot", 202},
		{"invalid", "POST", "collect", `{"type":"wrong"}`, origin, "Chrome/140", 400},
		{"no-origin", "POST", "collect", `{}`, "", "", 403},
		{"foreign-origin", "POST", "collect", `{}`, "https://evil.test", "", 403},
		{"empty", "POST", "collect", "", origin, "", 413},
		{"large", "POST", "collect", strings.Repeat(" ", 16385), origin, "", 413},
		{"bad-json", "POST", "collect", "{", origin, "", 400},
		{"trailing", "POST", "collect", "{} {}", origin, "", 400},
		{"bad-utf8", "POST", "collect", string([]byte{'"', 0xff, '"'}), origin, "", 400},
		{"preflight", "OPTIONS", "collect", "", "https://evil.test", "", 204},
		{"wrong-read", "GET", "collect", "", "", "", 404},
		{"health", "GET", "health", "", "https://evil.test", "", 200},
		{"summary", "GET", "summary?days=1", "", "", "", 200},
		{"clamp", "GET", "summary?days=0", "", "", "", 200},
		{"invalid-days", "GET", "summary?days=no", "", "", "", 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, "/api/analytics/"+tc.path, strings.NewReader(tc.body))
			req.Header.Set("Origin", tc.origin)
			req.Header.Set("User-Agent", tc.ua)
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)
			if res.Code != tc.status {
				t.Fatalf("status=%d body=%s", res.Code, res.Body)
			}
			if tc.status >= 400 {
				validateResponse(t, res, "ErrorEnvelope")
			}
			if strings.HasPrefix(tc.path, "summary") && tc.status == 200 {
				validateResponse(t, res, "AnalyticsSummary")
				var body struct {
					Totals struct {
						Pageviews int64 `json:"pageviews"`
					}
					RangeDays int `json:"rangeDays"`
				}
				if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				if body.Totals.Pageviews != 1 || body.RangeDays != 1 {
					t.Fatalf("summary=%s", res.Body)
				}
			}
		})
	}
	if _, err := stats.Write.Exec("DROP TABLE analytics_events"); err != nil {
		t.Fatal(err)
	}
	res := httptest.NewRecorder()
	router.ServeHTTP(res, httptest.NewRequest("GET", "/api/analytics/summary", nil))
	if res.Code != 500 || strings.Contains(res.Body.String(), "SQL") {
		t.Fatalf("database failure=%d %s", res.Code, res.Body)
	}
	validateResponse(t, res, "ErrorEnvelope")
}
