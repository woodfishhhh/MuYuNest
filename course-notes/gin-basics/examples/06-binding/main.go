package main

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

type Profile struct {
	Name string `json:"name" form:"name" binding:"required"`
	Age  *int   `json:"age" form:"age" binding:"required,gte=0,lte=150"`
}

func bindError(c *gin.Context, err error) {
	status := http.StatusBadRequest
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		status = http.StatusRequestEntityTooLarge
	}
	c.JSON(status, gin.H{"error": "参数格式、大小或校验不符合要求"})
}

func NewRouter() *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	if err := r.SetTrustedProxies(nil); err != nil {
		panic(err)
	}
	r.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 8192)
		c.Next()
	})
	r.GET("/search", func(c *gin.Context) {
		var input struct {
			Page int      `form:"page,default=1" binding:"gte=1"`
			Tags []string `form:"tag"`
		}
		if err := c.ShouldBindQuery(&input); err != nil {
			bindError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"page": input.Page, "tags": input.Tags})
	})
	r.GET("/users/:id", func(c *gin.Context) {
		var input struct {
			ID uint64 `uri:"id" binding:"gte=1"`
		}
		if err := c.ShouldBindUri(&input); err != nil {
			bindError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": input.ID})
	})
	r.GET("/headers", func(c *gin.Context) {
		var input struct {
			RequestID string `header:"X-Request-ID" binding:"required"`
		}
		if err := c.ShouldBindHeader(&input); err != nil {
			bindError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"request_id": input.RequestID})
	})
	r.POST("/profile", func(c *gin.Context) {
		switch c.ContentType() {
		case gin.MIMEJSON, gin.MIMEPOSTForm, gin.MIMEMultipartPOSTForm:
		default:
			c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "请提交 JSON 或表单"})
			return
		}
		var input Profile
		err := c.ShouldBind(&input)
		if c.Request.MultipartForm != nil {
			defer c.Request.MultipartForm.RemoveAll()
		}
		if err != nil {
			bindError(c, err)
			return
		}
		c.JSON(http.StatusOK, input)
	})
	r.POST("/twice", func(c *gin.Context) {
		var first struct {
			Name string `json:"name" binding:"required"`
		}
		var second struct {
			Age int `json:"age"`
		}
		if err := c.ShouldBindBodyWith(&first, binding.JSON); err != nil {
			bindError(c, err)
			return
		}
		if err := c.ShouldBindBodyWith(&second, binding.JSON); err != nil {
			bindError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"name": first.Name, "age": second.Age})
	})
	return r
}

func main() {
	if err := NewRouter().Run("127.0.0.1:8080"); err != nil {
		log.Fatal(err)
	}
}
