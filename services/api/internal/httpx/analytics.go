package httpx

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/analytics"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/api"
)

// These public legacy routes have different Origin rules from visitor registration.
func analyticsBoundary(c *gin.Context, origins []string) bool {
	path := c.Request.URL.Path
	if path != "/api/analytics/collect" && path != "/api/analytics/health" && path != "/api/analytics/summary" {
		return false
	}
	if c.Request.Method == http.MethodOptions && path == "/api/analytics/collect" {
		c.Header("Allow", "POST, OPTIONS")
		c.AbortWithStatus(http.StatusNoContent)
		return true
	}
	c.Header("Cache-Control", "no-store")
	if (c.Request.Method == http.MethodGet && path == "/api/analytics/collect") || (c.Request.Method == http.MethodPost && path != "/api/analytics/collect") || c.Request.Method == http.MethodOptions {
		c.Writer.Header().Del("Allow")
		Error(c, http.StatusNotFound, "NOT_FOUND", "not found")
		return true
	}
	if c.Request.Method == http.MethodGet && path == "/api/analytics/summary" {
		// Python parse_qs ignores blanks and uses the first remaining value.
		query := c.Request.URL.Query()
		days := "30"
		for _, value := range query["days"] {
			if value != "" {
				days = strings.TrimSpace(value)
				break
			}
		}
		number, err := strconv.Atoi(days)
		if err != nil {
			Error(c, http.StatusBadRequest, "INVALID_REQUEST", "invalid days")
			return true
		}
		query.Set("days", strconv.Itoa(number))
		c.Request.URL.RawQuery = query.Encode()
	}
	if c.Request.Method == http.MethodPost && path == "/api/analytics/collect" {
		if len(origins) > 0 && !slices.Contains(origins, c.GetHeader("Origin")) {
			Error(c, http.StatusForbidden, "AUTH_FORBIDDEN", "origin not allowed")
			return true
		}
		if c.Request.ContentLength <= 0 || c.Request.ContentLength > 16*1024 {
			Error(c, http.StatusRequestEntityTooLarge, "INVALID_BODY_SIZE", "invalid body size")
			return true
		}
		body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 16*1024))
		if err != nil || !utf8.Valid(body) || !json.Valid(body) {
			Error(c, http.StatusBadRequest, "INVALID_REQUEST", "invalid analytics payload")
			return true
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))
	}
	c.Next()
	return true
}

func (h *healthHandler) GetAnalyticsHealth(ctx context.Context, _ api.GetAnalyticsHealthRequestObject) (api.GetAnalyticsHealthResponseObject, error) {
	return api.GetAnalyticsHealth200JSONResponse{Ok: true, Storage: api.Sqlite}, nil
}

func (h *healthHandler) CollectAnalytics(ctx context.Context, request api.CollectAnalyticsRequestObject) (api.CollectAnalyticsResponseObject, error) {
	c := ctx.(*gin.Context)
	var payload any
	if err := json.Unmarshal(*request.Body, &payload); err != nil {
		return nil, err
	}
	// As in Python, the deployment proxy must overwrite X-Forwarded-For.
	ip := strings.TrimSpace(strings.SplitN(c.GetHeader("X-Forwarded-For"), ",", 2)[0])
	if ip == "" {
		ip = c.ClientIP()
	}
	accepted, err := h.analytics.Collect(c.Request.Context(), payload, ip, c.GetHeader("User-Agent"), time.Now().UTC())
	if errors.Is(err, analytics.ErrInvalidEvent) {
		var body api.ErrorJSONResponse
		body.Error.Code = "INVALID_REQUEST"
		body.Error.Message = "invalid analytics payload"
		body.Error.RequestId = c.GetString("requestId")
		return api.CollectAnalytics400JSONResponse{ErrorJSONResponse: body}, nil
	}
	if err != nil {
		return nil, err
	}
	return api.CollectAnalytics202JSONResponse{Accepted: accepted}, nil
}

type analyticsSummaryResponse struct{ analytics.Summary }

func (response analyticsSummaryResponse) VisitGetAnalyticsSummaryResponse(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(response.Summary)
}

func (h *healthHandler) GetAnalyticsSummary(ctx context.Context, request api.GetAnalyticsSummaryRequestObject) (api.GetAnalyticsSummaryResponseObject, error) {
	c := ctx.(*gin.Context)
	days := 30
	if request.Params.Days != nil {
		days = *request.Params.Days
	}
	summary, err := h.analytics.Summary(c.Request.Context(), days, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	return analyticsSummaryResponse{summary}, nil
}
