package main

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

func Trace(name string, output io.Writer) gin.HandlerFunc {
	logger := log.New(output, "", 0)
	return func(c *gin.Context) {
		logger.Printf("%s.before", name)
		c.Next()
		logger.Printf("%s.after status=%d", name, c.Writer.Status())
	}
}

func Auth(token string) gin.HandlerFunc {
	return func(c *gin.Context) {
		want := "Bearer " + token
		if subtle.ConstantTimeCompare([]byte(c.GetHeader("Authorization")), []byte(want)) != 1 {
			c.Header("WWW-Authenticate", `Bearer realm="gin-basics"`)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "凭证缺失或无效"})
			return
		}
		// 固定身份只用于演示认证结果如何传给后续处理器。
		c.Set("user_id", "demo-user")
		c.Next()
	}
}

func NewRouter(token string, output io.Writer) (*gin.Engine, error) {
	if strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("DEMO_API_TOKEN must not be empty")
	}
	r := gin.New()
	r.Use(gin.Recovery(), Trace("global", output))
	if err := r.SetTrustedProxies(nil); err != nil {
		return nil, err
	}
	r.HandleMethodNotAllowed = true
	r.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "请求方法不支持"})
	})
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	api := r.Group("/api", Trace("group", output), Auth(token))
	api.GET("/me", func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "身份上下文缺失"})
			return
		}
		log.New(output, "", 0).Print("handler")
		c.JSON(http.StatusOK, gin.H{"user_id": userID, "client_ip": c.ClientIP()})
	})
	return r, nil
}

func main() {
	router, err := NewRouter(os.Getenv("DEMO_API_TOKEN"), os.Stdout)
	if err != nil {
		log.Fatal(err)
	}
	server := &http.Server{
		Addr: "127.0.0.1:8080", Handler: router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	stop, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	serveErr := make(chan error, 1)
	go func() { serveErr <- server.ListenAndServe() }()
	select {
	case err := <-serveErr:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
		return
	case <-stop.Done():
	}
	ctx, finish := context.WithTimeout(context.Background(), 5*time.Second)
	defer finish()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown: %v", err)
		_ = server.Close()
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		log.Printf("server exit: %v", err)
	}
}
