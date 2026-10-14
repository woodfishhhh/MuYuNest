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

一个接口返回 JSON，并不意味着所有请求都应该返回 HTTP `200`。HTTP 状态码描述请求在协议层面的结果，JSON 中的业务码描述应用自己的错误分类。把二者分开，浏览器、监控和前端业务代码才能读懂同一次失败。

## Gin 在标准库之上提供了什么

`gin.Engine` 实现了 `http.Handler`，因此既可以用 `r.Run(...)` 启动，也可以作为 `http.Server.Handler`。`r.GET("/users/:id", handler)` 把方法、路径和处理器关联起来；进入处理器后，`*gin.Context` 提供路径参数、绑定方法以及 JSON、HTML 等响应方法。

`gin.Default()` 默认安装 Logger 和 Recovery；`gin.New()` 创建不带这两个中间件的引擎。下面使用 `gin.New()`，再显式安装 Recovery，便于看清配置来自哪里。Recovery 处理的是请求处理链中的 panic，普通业务错误仍要自己返回。

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

`1001`、`1002` 没有通用标准，必须由项目定义。HTTP `401` 和 `403` 则有不同含义，不应都笼统称为“权限错误”。现有系统如果约定所有业务结果都走 `200`，接入时要遵守其契约；新设计接口时，可以直接使用明确的 HTTP 状态表达失败。

## 完整的 JSON 响应示例

使用 Go 1.25 或更高版本，新建独立目录。以下命令按 PowerShell 7 编写；Linux/macOS 请求示例中的 `curl.exe` 可换成 `curl`。

```powershell
mkdir gin-02-response
Set-Location gin-02-response
go mod init example.com/gin-02-response
go get github.com/gin-gonic/gin@v1.12.0
```

每个示例单独运行，避免多个 `main` 函数放进同一个包。

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

`gin.H` 是字符串键的映射，适合临时构造小对象；`Response` 结构体固定了 `code`、`data`、`msg` 三个字段，适合作为接口契约。`json:"code"` 决定输出字段名，与 Go 字段 `Code` 的大小写分工不同。

`reply` 同时接收 HTTP 状态码和业务码，没有把两种信息挤进一个参数。失败分支写出响应后紧接着 `return`，避免后续代码再写一份成功响应。

`HandleMethodNotAllowed` 打开方法不匹配的检测；`NoMethod` 负责把错误正文整理成同样的 JSON 格式。`NoRoute` 则处理根本没有对应资源路径的请求。

## 实际调用

```powershell
go run .
```

在另一个终端依次请求：

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

后面三个响应的 HTTP 状态依次为 `400`、`404`、`405`，业务码分别为 `1001`、`1002`、`1003`。`data` 为 `nil` 时会编码成 JSON `null`；如果契约要求空对象，需要明确传入对象，而不是期待 `nil` 自动变成 `{}`。

这份示例只保存了代码中的固定用户，主要验证响应行为。真正查询数据库时，要把“记录不存在”和“数据库连接失败”区分开，分别映射到预期的客户端错误和服务端错误。

## 还需要记住的响应约定

创建了新资源可以用 `201`，并按需要返回 `Location`；已经接受异步任务可以用 `202`；`204` 表示成功但没有响应体。不要一边发送 `204` 一边要求客户端解析 JSON。

Go 结构体字段必须导出，JSON 编码器才能正常输出它。敏感字段应在响应 DTO 中排除；直接把数据库模型整体交给 `c.JSON`，容易把本不打算公开的字段一起发送。

参考：[Gin 入门与 Engine](https://gin-gonic.com/en/docs/quickstart/)、[Gin 的响应 API](https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0#Context.JSON)。

---

[← 从 net/http 看懂一次请求](https://blog.woodfish.site/posts/gin-basics-01-net-http) · [课程目录](https://blog.woodfish.site/posts/gin-basics) · [HTML 模板、静态文件与下载 →](https://blog.woodfish.site/posts/gin-basics-03-templates-files)
