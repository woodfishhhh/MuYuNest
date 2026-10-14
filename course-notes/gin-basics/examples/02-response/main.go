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
