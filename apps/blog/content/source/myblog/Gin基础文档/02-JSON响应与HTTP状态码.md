---
title: "Gin 基础（02）：JSON 响应与 HTTP 状态码"
slug: gin-basics-02-responses
date: "2026-10-14"
updated: "2026-10-14"
categories: ["Go", "Gin"]
tags: ["Go", "Gin", "HTTP", "Web开发"]
course_order: 2
draft: false
---

# Gin 基础（02）：JSON 响应与 HTTP 状态码

接口返回 JSON，也别所有请求都回 `200`。HTTP 状态码说的是协议层面的结果，JSON 里的业务码是应用自己的错误分类。两者分开，浏览器、监控和前端业务代码才都能看懂同一次失败。

## Gin 在标准库之上提供了什么

`gin.Engine` 实现了 `http.Handler`，所以既能用 `r.Run(...)` 启动，也能当 `http.Server.Handler` 用。`r.GET("/users/:id", handler)` 把方法、路径和处理器关联起来；处理器里用 `*gin.Context` 拿路径参数、调绑定方法，也用它的 JSON、HTML 等方法写响应。

- `gin.Default()`：默认装好 Logger 和 Recovery。
- `gin.New()`：不带这两个中间件。

下面用 `gin.New()` 再手动装 Recovery，配置从哪来一眼就能看清。Recovery 只管请求处理链里的 panic，普通业务错误还是要自己返回。

## HTTP 状态码和业务码怎样配合

| 情况 | HTTP 状态码 | 业务码示例 |
| --- | --- | --- |
| 查询成功 | 200 | 0 |
| 参数格式不符合接口约定 | 400 | 1001 |
| 缺少有效身份凭证 | 401 | 按应用定义 |
| 身份有效，但没有操作权限 | 403 | 按应用定义 |
| 用户或资源不存在 | 404 | 1002 |
| 路径存在，但方法不支持 | 405 | 1003 |
| 未预期的服务端故障 | 500 | 按应用定义 |

`1001`、`1002` 没有通用标准，由项目自己定义。HTTP `401` 和 `403` 含义不同，别都笼统叫“权限错误”。现有系统如果约定所有业务结果都走 `200`，接入时就照它的约定来；新设计的接口，直接用明确的 HTTP 状态表达失败。

## 完整的 JSON 响应示例

用 Go 1.25 或更高版本，新建一个独立目录。下面的命令按 PowerShell 7 写；Linux/macOS 上把请求示例里的 `curl.exe` 换成 `curl`。

```powershell
mkdir gin-02-response
Set-Location gin-02-response
go mod init example.com/gin-02-response
go get github.com/gin-gonic/gin@v1.12.0
```

每个示例单独运行，别把多个 `main` 函数放进同一个包。

保存为 `main.go`：

```go
package main

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Code int    `json:"code"`
	Data any    `json:"data"`
	Msg  string `json:"msg"`
}

func reply(c *gin.Context, status, code int, data any, message string) {
	c.JSON(status, Response{Code: code, Data: data, Msg: message})
}

func NewRouter() *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	if err := r.SetTrustedProxies(nil); err != nil {
		panic(err)
	}
	r.HandleMethodNotAllowed = true
	r.NoRoute(func(c *gin.Context) {
		reply(c, http.StatusNotFound, 1002, nil, "资源不存在")
	})
	r.NoMethod(func(c *gin.Context) {
		reply(c, http.StatusMethodNotAllowed, 1003, nil, "请求方法不支持")
	})
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/users/:id", func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil || id < 1 {
			reply(c, http.StatusBadRequest, 1001, nil, "id 必须是正整数")
			return
		}
		// 固定数据用于演示响应契约，不连接数据库。
		if id != 1 {
			reply(c, http.StatusNotFound, 1002, nil, "用户不存在")
			return
		}
		reply(c, http.StatusOK, 0, gin.H{"id": id, "name": "小明"}, "成功")
	})
	return r
}

func main() {
	if err := NewRouter().Run("127.0.0.1:8080"); err != nil {
		log.Fatal(err)
	}
}
```

`gin.H` 是字符串键的映射，临时拼个小对象用。`Response` 结构体固定了 `code`、`data`、`msg` 三个字段，适合当接口契约。`json:"code"` 决定输出的字段名，跟 Go 字段 `Code` 的大小写是两回事。

`reply` 分别接收 HTTP 状态码和业务码，两种信息不挤在一个参数里。失败分支写完响应马上 `return`，免得后面的代码再写一份成功响应。

- `HandleMethodNotAllowed`：打开方法不匹配的检测。
- `NoMethod`：把这类错误的正文整理成同样的 JSON 格式。
- `NoRoute`：处理根本没有对应资源路径的请求。

## 实际调用

```powershell
go run .
```

另开一个终端，依次请求：

```powershell
curl.exe -i "http://127.0.0.1:8080/users/1"
curl.exe -i "http://127.0.0.1:8080/users/nope"
curl.exe -i "http://127.0.0.1:8080/users/2"
curl.exe -i -X POST "http://127.0.0.1:8080/users/1"
```

第一个响应是：

```json
{"code":0,"data":{"id":1,"name":"小明"},"msg":"成功"}
```

后面三个响应的 HTTP 状态依次是 `400`、`404`、`405`，业务码分别是 `1001`、`1002`、`1003`。`data` 为 `nil` 时编码成 JSON `null`；契约要求空对象的话，要明确传一个对象，`nil` 不会自动变成 `{}`。

示例里只有写死在代码里的固定用户，主要验证响应行为。真查数据库时，要把“记录不存在”和“数据库连接失败”分开，分别映射到对应的客户端错误和服务端错误。

## 还需要记住的响应约定

- 创建了新资源用 `201`，需要的话返回 `Location`。
- 已经接受异步任务用 `202`。
- `204` 表示成功但没有响应体。别一边发 `204` 一边要求客户端解析 JSON。

Go 结构体字段要导出，JSON 编码器才能输出它。敏感字段在响应 DTO 里去掉；直接把整个数据库模型丢给 `c.JSON`，很容易把不打算公开的字段一起发出去。

参考：[Gin 入门与 Engine](https://gin-gonic.com/en/docs/quickstart/)、[Gin 的响应 API](https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0#Context.JSON)。

---

[← 从 net/http 看懂一次请求](https://blog.woodfish.site/posts/gin-basics-01-net-http) · [课程目录](https://blog.woodfish.site/posts/gin-basics) · [HTML 模板、静态文件与下载 →](https://blog.woodfish.site/posts/gin-basics-03-templates-files)
