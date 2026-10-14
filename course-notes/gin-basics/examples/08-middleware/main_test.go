package main

import (
	"bytes"
	"net/http/httptest"
	"strings"
	"testing"

	"example.com/gin-basics/internal/check"
	"github.com/gin-gonic/gin"
)

func TestAuthAndMiddlewareOrder(t *testing.T) {
	for _, tc := range []struct {
		name, token string
		status      int
		order       string
	}{
		{"allowed", "Bearer demo-token", 200, "global.before\ngroup.before\nhandler\ngroup.after status=200\nglobal.after status=200\n"},
		{"denied", "", 401, "global.before\ngroup.before\ngroup.after status=401\nglobal.after status=401\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var output bytes.Buffer
			r, err := NewRouter("demo-token", &output)
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest("GET", "/api/me", nil)
			req.RemoteAddr = "192.0.2.1:1234"
			req.Header.Set("Authorization", tc.token)
			req.Header.Set("X-Forwarded-For", "203.0.113.99")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			check.Status(t, w, tc.status)
			if output.String() != tc.order {
				t.Fatalf("wrong order: %s", output.String())
			}
			if tc.status == 200 && check.JSON(t, w)["client_ip"] != "192.0.2.1" {
				t.Fatal("untrusted forwarded header was accepted")
			}
		})
	}
	if _, err := NewRouter("", &bytes.Buffer{}); err == nil {
		t.Fatal("empty demonstration token was accepted")
	}
}

func TestAbortDoesNotReturnFromCurrentFunction(t *testing.T) {
	var events []string
	r := gin.New()
	r.Use(func(c *gin.Context) {
		events = append(events, "before")
		c.Abort()
		events = append(events, "after")
	})
	r.GET("/", func(c *gin.Context) { events = append(events, "handler") })
	check.Request(r, "GET", "/", "", "")
	if strings.Join(events, ",") != "before,after" {
		t.Fatal(events)
	}
}

func TestReturnAloneDoesNotAbortTheChain(t *testing.T) {
	r := gin.New()
	r.Use(func(c *gin.Context) { return })
	r.GET("/", func(c *gin.Context) { c.String(200, "handler executed") })
	w := check.Request(r, "GET", "/", "", "")
	if w.Body.String() != "handler executed" {
		t.Fatal(w.Body.String())
	}
}

func TestUseDoesNotRetroactivelyChangeRegisteredRoutes(t *testing.T) {
	r := gin.New()
	r.GET("/early", func(c *gin.Context) { c.Status(200) })
	r.Use(func(c *gin.Context) { c.Header("X-Late", "present") })
	r.GET("/late", func(c *gin.Context) { c.Status(200) })
	if check.Request(r, "GET", "/early", "", "").Header().Get("X-Late") != "" {
		t.Fatal("middleware unexpectedly changed an existing route")
	}
	if check.Request(r, "GET", "/late", "", "").Header().Get("X-Late") != "present" {
		t.Fatal("middleware is missing on a later route")
	}
}
