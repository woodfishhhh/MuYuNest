# Gin 基础课程的可运行示例

Go 1.25+，Gin v1.12.0。每个编号目录是独立的 `main` 包；程序默认监听 127.0.0.1:8080。

```powershell
go mod download
go test ./...
go vet ./...
```

进入要运行的编号目录后执行 `go run .`。`03-files` 从当前目录加载模板和文件；`08-middleware` 运行前设置 `$env:DEMO_API_TOKEN = 'local-demo-token'`。停止一个示例后再启动另一个。

- [01-http](01-http/main.go)：[配套笔记](https://blog.woodfish.site/posts/gin-basics-01-net-http)，从 net/http 看懂一次请求。
- [02-response](02-response/main.go)：[配套笔记](https://blog.woodfish.site/posts/gin-basics-02-responses)，JSON 响应与 HTTP 状态码。
- [03-files](03-files/main.go)：[配套笔记](https://blog.woodfish.site/posts/gin-basics-03-templates-files)，HTML 模板、静态文件与下载。
- [04-request](04-request/main.go)：[配套笔记](https://blog.woodfish.site/posts/gin-basics-04-request-data)，路径、查询参数、表单与请求体。
- [05-upload](05-upload/main.go)：[配套笔记](https://blog.woodfish.site/posts/gin-basics-05-uploads)，单文件与多文件上传。
- [06-binding](06-binding/main.go)：[配套笔记](https://blog.woodfish.site/posts/gin-basics-06-binding)，参数绑定与请求体复用。
- [07-validation](07-validation/main.go)：[配套笔记](https://blog.woodfish.site/posts/gin-basics-07-validation)，校验规则、中文错误与自定义校验。
- [08-middleware](08-middleware/main.go)：[配套笔记](https://blog.woodfish.site/posts/gin-basics-08-middleware)，路由分组、中间件与服务退出。

上传练习产生的 `data/` 目录属于本地练习数据，不提交到版本库。示例令牌仅供本机练习，不包含实际账号、数据库或生产身份系统。
