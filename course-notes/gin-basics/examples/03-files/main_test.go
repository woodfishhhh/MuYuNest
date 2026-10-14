package main

import (
	"mime"
	"net/url"
	"strings"
	"testing"

	"example.com/gin-basics/internal/check"
	"github.com/gin-gonic/gin"
)

func TestHTMLIsEscaped(t *testing.T) {
	w := check.Request(NewRouter("."), "GET", "/?name="+url.QueryEscape("<script>alert(1)</script>"), "", "")
	check.Status(t, w, 200)
	if strings.Contains(w.Body.String(), "<script>") || !strings.Contains(w.Body.String(), "&lt;script&gt;") {
		t.Fatal("template did not escape the supplied name")
	}
}

func TestStaticCatchAllCannotBeReusedForAParameterRoute(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Error("overlapping static catch-all and parameter route were accepted")
		}
	}()
	r := NewRouter(".")
	r.GET("/assets/:id", func(c *gin.Context) { c.String(200, "conflict") })
}

func TestDownloadsSupportGETAndPOST(t *testing.T) {
	r := NewRouter(".")
	for _, method := range []string{"GET", "POST"} {
		t.Run(method, func(t *testing.T) {
			w := check.Request(r, method, "/download", "", "")
			check.Status(t, w, 200)
			kind, params, err := mime.ParseMediaType(w.Header().Get("Content-Disposition"))
			if err != nil || kind != "attachment" || params["filename"] != "学习报告.csv" {
				t.Fatalf("invalid attachment header: %q (%v)", w.Header().Get("Content-Disposition"), err)
			}
			if !strings.Contains(w.Body.String(), "gin,learning") {
				t.Fatal("download body is missing")
			}
		})
	}
	check.Status(t, check.Request(r, "GET", "/assets/site.css", "", ""), 200)
}
