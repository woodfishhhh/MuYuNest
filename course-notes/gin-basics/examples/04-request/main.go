package main

import (
	"bytes"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func readError(c *gin.Context, err error) {
	status := http.StatusBadRequest
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		status = http.StatusRequestEntityTooLarge
	}
	c.JSON(status, gin.H{"error": "请求体无效或超过 4 KiB"})
}

func NewRouter() *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	if err := r.SetTrustedProxies(nil); err != nil {
		panic(err)
	}
	r.GET("/users/:id", func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil || id < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id 必须是正整数"})
			return
		}
		name, exists := c.GetQuery("name")
		c.JSON(http.StatusOK, gin.H{
			"id": id, "name": name, "name_exists": exists,
			"page": c.DefaultQuery("page", "1"), "tags": c.QueryArray("tag"),
		})
	})
	r.POST("/form", func(c *gin.Context) {
		if c.ContentType() != gin.MIMEPOSTForm && c.ContentType() != gin.MIMEMultipartPOSTForm {
			c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "请提交表单"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
		// 显式检查解析错误，不能把超限或损坏的表单当成空字段。
		var err error
		if c.ContentType() == gin.MIMEMultipartPOSTForm {
			err = c.Request.ParseMultipartForm(4096)
			if c.Request.MultipartForm != nil {
				defer c.Request.MultipartForm.RemoveAll()
			}
		} else {
			err = c.Request.ParseForm()
		}
		if err != nil {
			readError(c, err)
			return
		}
		age, exists := c.GetPostForm("age")
		c.JSON(http.StatusOK, gin.H{"name": c.PostForm("name"), "age": age, "age_exists": exists})
	})
	r.POST("/raw", func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
		data, err := io.ReadAll(c.Request.Body)
		if err != nil {
			readError(c, err)
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(data))
		again, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "重新读取失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"first": string(data), "second": string(again)})
	})
	return r
}

func main() {
	if err := NewRouter().Run("127.0.0.1:8080"); err != nil {
		log.Fatal(err)
	}
}
