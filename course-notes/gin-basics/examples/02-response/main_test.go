package main

import (
	"testing"

	"example.com/gin-basics/internal/check"
)

func TestHTTPAndBusinessCodes(t *testing.T) {
	r := NewRouter()
	for _, tc := range []struct {
		method, path string
		status, code int
	}{
		{"GET", "/users/1", 200, 0},
		{"GET", "/users/2", 404, 1002},
		{"GET", "/users/nope", 400, 1001},
		{"POST", "/users/1", 405, 1003},
		{"GET", "/missing", 404, 1002},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			w := check.Request(r, tc.method, tc.path, "", "")
			check.Status(t, w, tc.status)
			if check.JSON(t, w)["code"] != float64(tc.code) {
				t.Fatal(w.Body.String())
			}
			if w.Header().Get("Content-Type") != "application/json; charset=utf-8" {
				t.Fatal("response is not declared as JSON")
			}
		})
	}
}
