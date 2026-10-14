package main

import (
	"log"
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

func NewRouter(baseDir string) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	if err := r.SetTrustedProxies(nil); err != nil {
		panic(err)
	}
	r.LoadHTMLGlob(filepath.Join(baseDir, "templates", "*.html"))
	r.Static("/assets", filepath.Join(baseDir, "static"))
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{
			"title": "Gin 文件示例", "name": c.DefaultQuery("name", "访客"),
		})
	})
	r.Match([]string{http.MethodGet, http.MethodPost}, "/download", func(c *gin.Context) {
		// 服务端选择固定文件，客户端只决定是否发起下载。
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.FileAttachment(filepath.Join(baseDir, "files", "report.csv"), "学习报告.csv")
	})
	return r
}

func main() {
	// 此程序从 03-files 目录运行，因此模板和文件路径以该目录为基准。
	if err := NewRouter(".").Run("127.0.0.1:8080"); err != nil {
		log.Fatal(err)
	}
}
