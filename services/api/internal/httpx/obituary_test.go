package httpx

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/obituary"
)

func TestObituaryBodyBoundary(t *testing.T) {
	r := gin.New()
	RegisterObituary(r, obituary.Stats{})
	for _, tc := range []struct {
		body, media string
		want        int
	}{{"{}", "text/plain", 415}, {strings.Repeat(" ", 1025), "application/json", 413}, {"{}", "application/json", 400}} {
		req := httptest.NewRequest("POST", "/api/obituary/ping", strings.NewReader(tc.body))
		req.Header.Set("Content-Type", tc.media)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Fatal(w.Code, tc.want)
		}
	}
}
