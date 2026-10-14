package main

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"testing"

	"example.com/gin-basics/internal/check"
)

func TestShouldBindSupportsJSONAndBothFormEncodings(t *testing.T) {
	r := NewRouter()
	for _, tc := range []struct{ name, contentType, body string }{
		{"JSON", "application/json", `{"name":"Lin","age":0}`},
		{"urlencoded", "application/x-www-form-urlencoded", "name=Lin&age=0"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := check.Request(r, "POST", "/profile", tc.contentType, tc.body)
			check.Status(t, w, 200)
			if check.JSON(t, w)["age"] != float64(0) {
				t.Fatal(w.Body.String())
			}
		})
	}
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	if err := form.WriteField("name", "Lin"); err != nil {
		t.Fatal(err)
	}
	if err := form.WriteField("age", "0"); err != nil {
		t.Fatal(err)
	}
	if err := form.Close(); err != nil {
		t.Fatal(err)
	}
	check.Status(t, check.Request(r, "POST", "/profile", form.FormDataContentType(), body.String()), 200)
	check.Status(t, check.Request(r, "POST", "/profile", "application/json", `{"name":"Lin"}`), 400)
	check.Status(t, check.Request(r, "POST", "/profile", "application/json", `{"name":"Lin","age":-1}`), 400)
	w := check.Request(r, "POST", "/profile?name=Query&age=9", "application/x-www-form-urlencoded", "name=Body&age=0")
	check.Status(t, w, 200)
	if check.JSON(t, w)["name"] != "Body" {
		t.Fatal("urlencoded body should take precedence over query values")
	}
}

func TestBindingSourcesAndBodyCache(t *testing.T) {
	r := NewRouter()
	w := check.Request(r, "GET", "/search?page=3&tag=go&tag=web", "application/json", `{"page":9}`)
	check.Status(t, w, 200)
	if check.JSON(t, w)["page"] != float64(3) {
		t.Fatal(w.Body.String())
	}
	check.Status(t, check.Request(r, "GET", "/search?page=zero", "", ""), 400)
	check.Status(t, check.Request(r, "GET", "/users/12", "", ""), 200)
	check.Status(t, check.Request(r, "GET", "/users/zero", "", ""), 400)
	check.Status(t, check.Request(r, "GET", "/headers", "", ""), 400)
	req := httptest.NewRequest("GET", "/headers", nil)
	req.Header.Set("X-Request-ID", "request-1")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	check.Status(t, w, 200)
	w = check.Request(r, "POST", "/twice", "application/json", `{"name":"Lin","age":20}`)
	check.Status(t, w, 200)
	value := check.JSON(t, w)
	if value["name"] != "Lin" || value["age"] != float64(20) {
		t.Fatal(value)
	}
}
