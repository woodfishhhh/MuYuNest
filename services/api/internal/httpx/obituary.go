package httpx

import (
	"bytes"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/obituary"
)

func RegisterObituary(r *gin.Engine, s obituary.Stats) {
	r.POST("/api/obituary/ping", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		if c.ContentType() != "application/json" {
			c.Status(http.StatusUnsupportedMediaType)
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 1024))
		if err != nil {
			c.Status(http.StatusRequestEntityTooLarge)
			return
		}
		p, err := obituary.Decode(bytes.NewReader(body))
		if err != nil {
			c.Status(http.StatusBadRequest)
			return
		}
		if err = s.Record(c.Request.Context(), p, time.Now()); err != nil {
			c.Status(http.StatusServiceUnavailable)
			return
		}
		c.Status(http.StatusNoContent)
	})
	r.GET("/analytics/api/obituary/summary", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		summary, err := s.Summary(c.Request.Context(), time.Now())
		if err != nil {
			c.Status(http.StatusServiceUnavailable)
			return
		}
		c.JSON(http.StatusOK, summary)
	})
}
