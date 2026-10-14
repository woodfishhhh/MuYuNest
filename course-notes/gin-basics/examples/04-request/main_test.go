package main

import (
	"net/url"
	"strings"
	"testing"

	"example.com/gin-basics/internal/check"
)

func TestMissingAndEmptyQueryValues(t *testing.T) {
	r := NewRouter()
	w := check.Request(r, "GET", "/users/3?name=&page=&tag=go&tag=web", "", "")
	check.Status(t, w, 200)
	value := check.JSON(t, w)
	if value["name_exists"] != true || value["page"] != "" || len(value["tags"].([]any)) != 2 {
		t.Fatal(value)
	}
	value = check.JSON(t, check.Request(r, "GET", "/users/3", "", ""))
	if value["name_exists"] != false || value["page"] != "1" {
		t.Fatal(value)
	}
}

func TestFormAndRawBody(t *testing.T) {
	r := NewRouter()
	form := url.Values{"name": {"小明"}, "age": {"0"}}.Encode()
	w := check.Request(r, "POST", "/form", "application/x-www-form-urlencoded", form)
	check.Status(t, w, 200)
	value := check.JSON(t, w)
	if value["name"] != "小明" || value["age"] != "0" || value["age_exists"] != true {
		t.Fatal(value)
	}
	check.Status(t, check.Request(r, "POST", "/form", "application/json", `{"name":"小明"}`), 415)
	w = check.Request(r, "POST", "/raw", "text/plain", "hello")
	check.Status(t, w, 200)
	value = check.JSON(t, w)
	if value["first"] != "hello" || value["second"] != "hello" {
		t.Fatal(value)
	}
	check.Status(t, check.Request(r, "POST", "/raw", "text/plain", strings.Repeat("x", 5000)), 413)
	check.Status(t, check.Request(r, "POST", "/form", "application/x-www-form-urlencoded", "name="+strings.Repeat("x", 5000)), 413)
}
