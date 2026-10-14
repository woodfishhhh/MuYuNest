package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"example.com/gin-basics/internal/check"
)

func upload(t *testing.T, handler http.Handler, sizes []int, filename string) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	for _, size := range sizes {
		part, err := w.CreateFormFile("files", filename)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(bytes.Repeat([]byte("x"), size)); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("POST", "/uploads", &body)
	r.Header.Set("Content-Type", w.FormDataContentType())
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, r)
	return response
}

func TestUploadUsesServerNamesAndAllowsDiskBackedParts(t *testing.T) {
	dir := t.TempDir()
	w := upload(t, NewRouter(dir), []int{3, 512 << 10}, "../../unsafe.txt")
	check.Status(t, w, 201)
	var data struct {
		Files []struct {
			ID    string `json:"id"`
			Bytes int64  `json:"bytes"`
		} `json:"files"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &data); err != nil {
		t.Fatal(err)
	}
	if len(data.Files) != 2 {
		t.Fatal(data)
	}
	for _, file := range data.Files {
		if filepath.Base(file.ID) != file.ID || !strings.HasPrefix(file.ID, "upload-") {
			t.Fatal("client filename leaked into storage path")
		}
		content, err := os.ReadFile(filepath.Join(dir, file.ID))
		if err != nil || int64(len(content)) != file.Bytes {
			t.Fatalf("saved content mismatch: %v", err)
		}
	}
}

func TestUploadLimits(t *testing.T) {
	for _, tc := range []struct {
		name   string
		sizes  []int
		status int
	}{
		{"missing file", nil, 400},
		{"too many files", []int{1, 1, 1, 1}, 400},
		{"file exceeds limit", []int{(1 << 20) + 1}, 413},
		{"request exceeds limit", []int{5 << 20}, 413},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			check.Status(t, upload(t, NewRouter(dir), tc.sizes, "test.bin"), tc.status)
			entries, err := os.ReadDir(dir)
			if err != nil || len(entries) != 0 {
				t.Fatalf("rejected request left saved files: %v", err)
			}
		})
	}
}
