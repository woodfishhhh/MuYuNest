package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"example.com/gin-basics/internal/check"
)

func TestHTTPContract(t *testing.T) {
	for _, tc := range []struct {
		name, method, target, body string
		status                     int
	}{
		{"path parameter", "GET", "/hello/Ada", "", 200},
		{"wrong method", "GET", "/echo", "", 405},
		{"valid JSON", "POST", "/echo", `{"name":"小明"}`, 200},
		{"empty body", "POST", "/echo", "", 400},
		{"missing name", "POST", "/echo", `{}`, 400},
		{"unknown field", "POST", "/echo", `{"name":"小明","admin":true}`, 400},
		{"multiple JSON values", "POST", "/echo", `{"name":"小明"} {"name":"小李"}`, 400},
		{"oversized body", "POST", "/echo", `{"name":"` + strings.Repeat("x", 2000) + `"}`, 413},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := check.Request(NewHandler(), tc.method, tc.target, "application/json", tc.body)
			check.Status(t, w, tc.status)
		})
	}
	check.Status(t, check.Request(NewHandler(), "POST", "/echo", "text/plain", `{"name":"小明"}`), 415)
}

func TestHEADUsesGETRouteWithoutResponseBody(t *testing.T) {
	srv := httptest.NewServer(NewHandler())
	defer srv.Close()
	r, err := http.Head(srv.URL + "/hello/Ada")
	if err != nil {
		t.Fatal(err)
	}
	defer r.Body.Close()
	data, err := io.ReadAll(r.Body)
	if err != nil || r.StatusCode != 200 || len(data) != 0 {
		t.Fatalf("HEAD status=%d, bytes=%d, err=%v", r.StatusCode, len(data), err)
	}
}
