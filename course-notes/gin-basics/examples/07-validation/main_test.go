package main

import (
	"strings"
	"testing"

	"example.com/gin-basics/internal/check"
)

func TestValidationContract(t *testing.T) {
	r := NewRouter()
	valid := `{"name":"小明","email":"lin@example.com","age":0,"slug":"gin-basics"}`
	check.Status(t, check.Request(r, "POST", "/validate", "application/json", valid), 200)
	for _, tc := range []struct{ name, body, field, label string }{
		{"missing name", `{"email":"lin@example.com","age":0,"slug":"gin-basics"}`, "name", "用户名"},
		{"missing age", `{"name":"小明","email":"lin@example.com","slug":"gin-basics"}`, "age", "年龄"},
		{"email", strings.Replace(valid, "lin@example.com", "invalid", 1), "email", "邮箱"},
		{"slug", strings.Replace(valid, "gin-basics", "Gin", 1), "slug", "课程标识"},
		{"optional IP", strings.Replace(valid, `"slug"`, `"ip":"invalid","slug"`, 1), "ip", "IP 地址"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := check.Request(r, "POST", "/validate", "application/json", tc.body)
			check.Status(t, w, 400)
			fields := check.JSON(t, w)["errors"].(map[string]any)
			messages, exists := fields[tc.field]
			if !exists || !strings.Contains(messages.([]any)[0].(string), tc.label) {
				t.Fatal(w.Body.String())
			}
			t.Log(w.Body.String())
		})
	}
	w := check.Request(r, "POST", "/validate", "application/json", `{"age":"not-a-number"}`)
	check.Status(t, w, 400)
	if _, hasValidationErrors := check.JSON(t, w)["errors"]; hasValidationErrors {
		t.Fatal("JSON type errors must not be treated as validator.ValidationErrors")
	}
}
