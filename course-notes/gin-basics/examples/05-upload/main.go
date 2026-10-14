package main

import (
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

const (
	maxRequestBytes = 4 << 20
	maxFileBytes    = 1 << 20
)

func NewRouter(uploadDir string) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	if err := r.SetTrustedProxies(nil); err != nil {
		panic(err)
	}
	// 这是内存阈值，超过后可以落到临时文件，并不是上传大小上限。
	r.MaxMultipartMemory = 256 << 10
	r.POST("/uploads", func(c *gin.Context) {
		if c.ContentType() != gin.MIMEMultipartPOSTForm {
			c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "请提交 multipart/form-data"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRequestBytes)
		form, err := c.MultipartForm()
		if err != nil {
			status := http.StatusBadRequest
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				status = http.StatusRequestEntityTooLarge
			}
			c.JSON(status, gin.H{"error": "上传表单无效或请求超过 4 MiB"})
			return
		}
		defer form.RemoveAll()
		files := form.File["files"]
		if len(files) == 0 || len(files) > 3 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "files 字段需要 1 到 3 个文件"})
			return
		}
		for _, file := range files {
			if file.Size > maxFileBytes {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "单个文件不能超过 1 MiB"})
				return
			}
		}
		if err := os.MkdirAll(uploadDir, 0700); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "存储目录不可用"})
			return
		}
		var paths []string
		var saved []gin.H
		committed := false
		defer func() {
			if !committed {
				for _, name := range paths {
					_ = os.Remove(name)
				}
			}
		}()
		for _, header := range files {
			src, err := header.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "打开上传内容失败"})
				return
			}
			// 不把 header.Filename 拼进磁盘路径。文件名由服务器生成。
			dst, err := os.CreateTemp(uploadDir, "upload-*.bin")
			if err != nil {
				_ = src.Close()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "创建文件失败"})
				return
			}
			paths = append(paths, dst.Name())
			written, copyErr := io.Copy(dst, io.LimitReader(src, maxFileBytes+1))
			sourceCloseErr := src.Close()
			destinationCloseErr := dst.Close()
			if copyErr != nil || sourceCloseErr != nil || destinationCloseErr != nil || written > maxFileBytes {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "保存文件失败"})
				return
			}
			saved = append(saved, gin.H{"id": filepath.Base(dst.Name()), "bytes": written})
		}
		committed = true
		c.JSON(http.StatusCreated, gin.H{"files": saved})
	})
	return r
}

func main() {
	if err := NewRouter(filepath.Join("data", "uploads")).Run("127.0.0.1:8080"); err != nil {
		log.Fatal(err)
	}
}
