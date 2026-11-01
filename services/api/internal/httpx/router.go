package httpx

import (
	"crypto/rand"
	"log/slog"
	"net/http"
	"os"
	"runtime/debug"
	"slices"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/analytics"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/api"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
)

func Error(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": code, "message": message, "requestId": c.GetString("requestId")}})
}

func New(logger *slog.Logger, origins []string, mainDB, analyticsDB *db.Store, imageRoot, version, commit string, analyticsSecret []byte) *gin.Engine {
	r := gin.New()
	r.HandleMethodNotAllowed = true
	// Public proxies must be configured explicitly when deployment is wired up.
	r.SetTrustedProxies(nil)
	r.Use(func(c *gin.Context) {
		id := rand.Text()
		c.Set("requestId", id)
		c.Header("X-Request-ID", id)
		started := time.Now()
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("request panic", "request_id", id, "panic", recovered, "stack", string(debug.Stack()))
				Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error")
			}
			logger.Info("request", "request_id", id, "method", c.Request.Method, "path", c.Request.URL.Path, "status", c.Writer.Status(), "duration_ms", time.Since(started).Milliseconds())
		}()
		c.Next()
	})
	r.Use(func(c *gin.Context) {
		if analyticsBoundary(c, origins) {
			return
		}
		if c.Request.URL.Path == "/api/visitor-count" || c.Request.URL.Path == "/api/visitor-count/visit" {
			c.Header("Cache-Control", "no-store")
			if c.Request.Method == http.MethodOptions {
				Error(c, http.StatusNotFound, "NOT_FOUND", "not found")
				return
			}
			// Legacy reads and wrong-method responses do not require an Origin.
			if c.Request.Method != http.MethodPost || c.Request.URL.Path != "/api/visitor-count/visit" {
				c.Next()
				return
			}
		}
		origin := c.GetHeader("Origin")
		c.Header("Vary", "Origin")
		if origin != "" {
			if !slices.Contains(origins, origin) {
				Error(c, http.StatusForbidden, "AUTH_FORBIDDEN", "origin not allowed")
				return
			}
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Expose-Headers", "X-Request-ID, X-Visitor-Counted, ETag")
		}
		if c.Request.Method == http.MethodOptions {
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Visitor-ID, X-Visitor-Counted")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})
	serverError := func(c *gin.Context, err error) {
		logger.Error("API handler failed", "request_id", c.GetString("requestId"), "error", err)
		Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error")
	}
	api.RegisterHandlersWithOptions(r, api.NewStrictHandlerWithOptions(&healthHandler{logger, mainDB, analyticsDB, imageRoot, version, commit, analytics.New(analyticsDB, analyticsSecret)}, nil, api.StrictGinServerOptions{
		HandlerErrorFunc: serverError, ResponseErrorHandlerFunc: serverError,
		RequestErrorHandlerFunc: func(c *gin.Context, err error) { Error(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error()) },
	}), api.GinServerOptions{ErrorHandler: func(c *gin.Context, err error, status int) { Error(c, status, "INVALID_REQUEST", err.Error()) }})
	r.NoMethod(func(c *gin.Context) {
		Error(c, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
	})
	r.NoRoute(func(c *gin.Context) { Error(c, http.StatusNotFound, "NOT_FOUND", "Route not found") })
	return r
}

func checkDirectory(path string) error {
	f, err := os.CreateTemp(path, ".health-*")
	if err != nil {
		return err
	}
	name := f.Name()
	if err = f.Close(); err != nil {
		os.Remove(name)
		return err
	}
	return os.Remove(name)
}
