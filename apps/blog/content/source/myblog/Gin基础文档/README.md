---
title: "Gin 基础课程：请求、响应、绑定与中间件"
slug: gin-basics
date: "2026-10-14"
updated: "2026-10-14"
categories: ["Go", "Gin"]
tags: ["Go", "Gin", "HTTP", "Web开发"]
course_order: 0
draft: false
---

# Gin 基础课程：请求、响应、绑定与中间件

请求进入 Gin 后，先过路由和中间件，再由处理器读参数、做校验、写响应。学这条链路时，把数据来源、错误状态和执行顺序放在一起看，比单独记几个 API 更好定位问题。

下面 8 篇笔记每篇都有完整程序、运行命令和预期结果。会 Go 的结构体、函数、接口和基本错误处理就够了，要复习可以看 [Go 基础课程](https://blog.woodfish.site/posts/go-basics)。

## 阅读目录

| 顺序 | 笔记 | 主要解决的问题 |
| --- | --- | --- |
| 01 | [从 net/http 看懂一次请求](https://blog.woodfish.site/posts/gin-basics-01-net-http) | 请求如何进入处理器，JSON 如何读取和写回 |
| 02 | [JSON 响应与 HTTP 状态码](https://blog.woodfish.site/posts/gin-basics-02-responses) | HTTP 状态、业务码和统一 JSON 如何分工 |
| 03 | [HTML 模板、静态文件与下载](https://blog.woodfish.site/posts/gin-basics-03-templates-files) | 模板路径、静态资源和浏览器下载如何配合 |
| 04 | [路径、查询参数、表单与请求体](https://blog.woodfish.site/posts/gin-basics-04-request-data) | 路径、query、form、header 和 body 分别从哪里读取 |
| 05 | [单文件与多文件上传](https://blog.woodfish.site/posts/gin-basics-05-uploads) | 文件如何限量、限大小并安全保存 |
| 06 | [参数绑定与请求体复用](https://blog.woodfish.site/posts/gin-basics-06-binding) | 不同绑定器怎样选择，请求体何时需要缓存 |
| 07 | [校验规则、中文错误与自定义校验](https://blog.woodfish.site/posts/gin-basics-07-validation) | 零值、必填、中文文案与字段键如何处理 |
| 08 | [路由分组、中间件与服务退出](https://blog.woodfish.site/posts/gin-basics-08-middleware) | 中间件何时继续或终止，服务如何正常退出 |

## 示例环境

示例固定用 Gin `v1.12.0`，这个版本要求 Go `1.25.0` 或更高。本地验证用的是 Go `1.26.4`。固定版本是为了减少练习时依赖变化带来的差异，不是说其他版本都不能用。[Gin 的 go.mod](https://github.com/gin-gonic/gin/blob/v1.12.0/go.mod)

每篇都可以复制到一个独立目录运行。所有程序默认监听 `127.0.0.1:8080`，按 Ctrl+C 停掉再启动下一篇，免得端口冲突。命令以 PowerShell 7 为例，JSON 请求通过 UTF-8 文件发送，少受终端引号转义的干扰。

也可以直接拿 [全部示例与测试](https://github.com/woodfishhhh/MuYuNest/tree/main/course-notes/gin-basics/examples)，进入该目录执行：

```powershell
go mod download
go test ./...
```

测试通过 HTTP 请求和响应检查表单绑定、文件下载、上传限制、中文校验错误和中间件顺序。每个示例互相独立；`03-files` 还带模板、样式和 CSV 文件，运行前要先进它自己的目录。
