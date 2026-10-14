package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"strings"
	"time"
)

type Input struct {
	Name string `json:"name"`
}

// 先完成序列化，再提交状态码，避免编码失败后已经发出 200。
func writeJSON(w http.ResponseWriter, status int, value any) {
	data, err := json.Marshal(value)
	if err != nil {
		http.Error(w, "response encoding failed", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if _, err := w.Write(data); err != nil {
		log.Printf("write response: %v", err)
	}
}

func NewHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /hello/{name}", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"message": "你好，" + r.PathValue("name")})
	})
	mux.HandleFunc("POST /echo", func(w http.ResponseWriter, r *http.Request) {
		mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{"error": "请使用 application/json"})
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1024)
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		var input Input
		err = decoder.Decode(&input)
		if err == nil {
			// 再读一次应当只遇到 EOF；否则请求中还有另一段 JSON 或其他内容。
			var extra any
			if nextErr := decoder.Decode(&extra); nextErr != io.EOF {
				if nextErr == nil {
					err = errors.New("only one JSON value is allowed")
				} else {
					err = nextErr
				}
			}
		}
		if err != nil {
			status := http.StatusBadRequest
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				status = http.StatusRequestEntityTooLarge
			}
			writeJSON(w, status, map[string]string{"error": "请求体过大或 JSON 格式不符合要求"})
			return
		}
		if strings.TrimSpace(input.Name) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name 不能为空"})
			return
		}
		writeJSON(w, http.StatusOK, input)
	})
	return mux
}

func main() {
	server := &http.Server{
		Addr: "127.0.0.1:8080", Handler: NewHandler(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Fatal(server.ListenAndServe())
}
