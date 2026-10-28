---
title: "Gin 基础（01）：从 net/http 看懂一次请求"
slug: gin-basics-01-net-http
date: "2026-10-14"
updated: "2026-10-14"
categories: ["Go", "Gin"]
tags: ["Go", "Gin", "HTTP", "Web开发"]
course_order: 1
draft: false
---

# Gin 基础（01）：从 net/http 看懂一次请求

浏览器请求 `/hello/Ada`，Go 程序要做两件事：把请求交给哪个函数，往连接里写回什么。Gin 走的也是这条处理链。先把标准库里这几个对象分清，后面路由、处理器、服务器就不会混在一起。

## 请求怎样到达处理函数

- `http.Server`：监听端口、接受连接、处理 HTTP 协议。每个请求交给一个实现了 `http.Handler` 的对象，这个接口只有一个方法 `ServeHTTP(http.ResponseWriter, *http.Request)`。
- `http.ServeMux`：标准库的路由器，本身也是 `http.Handler`，按请求方法和路径选处理函数。
- `http.HandlerFunc`：把参数相同的普通函数适配成处理器。

![HTTP 服务器、路由与处理器的关系](./assets/http-request-flow.svg)

处理函数里，`r` 存着客户端传来的方法、URL、请求头和请求体；`w` 用来设置响应头、状态码和响应体。读请求用 `r`，写响应用 `w`。

Go 1.22 起，`ServeMux` 能直接注册 `GET /hello/{name}`，用 `r.PathValue("name")` 取路径变量。`GET` 模式也会匹配 `HEAD`。现在的标准库已经能按方法和路径变量路由，选 Gin 是为了绑定、校验、中间件组织这些需求。[Go 官方路由说明](https://go.dev/blog/routing-enhancements)

## 一个有明确输入规则的 HTTP 服务

示例有两个接口：

- `GET /hello/{name}`：返回问候语。
- `POST /echo`：接收一个带 `name` 的 JSON 对象。只允许一个 JSON 值，不允许未知字段，请求体最多 1024 字节。

用 Go 1.25 或更高版本，新建一个独立目录。下面的命令按 PowerShell 7 写；Linux/macOS 上把请求示例里的 `curl.exe` 换成 `curl`。

```powershell
mkdir gin-01-http
Set-Location gin-01-http
go mod init example.com/gin-01-http
```

每个示例单独运行，别把多个 `main` 函数放进同一个包。

保存为 `main.go`：

```go
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
```

`NewHandler` 返回路由器，`main` 把它装进服务器。路由组装单独放进函数，测试就能直接发 HTTP 请求，不用先占一个固定端口。

`json.NewDecoder(r.Body)` 从请求流里解码。第一次 `Decode` 成功只说明读到了一个 JSON 值，后面可能还有内容。所以要再读一次，拿到 `io.EOF` 才算读完，这样才能拒掉 `{"name":"A"} {"name":"B"}` 这种双 JSON 请求。

`http.MaxBytesReader` 包在原始请求体外面，超过限制返回 `*http.MaxBytesError`。这里把它映射成 `413`，普通格式错误映射成 `400`。只查 `Content-Length` 不够：请求可以用分块传输，请求头里声明的长度也代替不了实际读取上限。[net/http 的 MaxBytesReader](https://pkg.go.dev/net/http#MaxBytesReader)

## 发送请求并核对结果

运行：

```powershell
go run .
```

另开一个终端：

```powershell
curl.exe -i "http://127.0.0.1:8080/hello/Ada"
'{"name":"小明"}' | Set-Content -Encoding utf8NoBOM request.json
curl.exe -i "http://127.0.0.1:8080/echo" -H "Content-Type: application/json" --data-binary "@request.json"
```

两个响应都是 `200`，正文分别是 `{"message":"你好，Ada"}` 和 `{"name":"小明"}`，响应头带 `Content-Type: application/json; charset=utf-8`。

再试几种错误，分别对应字段、方法和媒体类型的问题：

- `request.json` 改成 `{"name":"小明","admin":true}`：`400`
- 请求方法改成 `GET /echo`：路由器返回 `405`
- 媒体类型改成 `text/plain`：接口返回 `415`

## 写响应时，先决定头部再写正文

普通的最终响应只能提交一次状态码。没先调 `WriteHeader` 的话，第一次 `Write` 会隐式提交 `200`，之后再想改成 `500` 就晚了。所以示例先序列化数据，成功了再设头部和状态码。

`127.0.0.1:8080` 只有本机能访问；`:8080` 通常监听所有可用网卡。打印一句 `http://127.0.0.1:8080` 不影响实际监听地址，起作用的是服务器的 `Addr`。

请求结束后，别再从后台 goroutine 写同一个 `ResponseWriter`。要做后台任务，先想好任务的输入、持久化和完成通知方式；响应还是由当前这次 HTTP 处理流程来写。

---

[课程目录](https://blog.woodfish.site/posts/gin-basics) · [JSON 响应与 HTTP 状态码 →](https://blog.woodfish.site/posts/gin-basics-02-responses)
