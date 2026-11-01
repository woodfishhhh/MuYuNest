package httpx

import (
	"context"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/analytics"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/api"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
)

type healthHandler struct {
	logger                     *slog.Logger
	mainDB, analyticsDB        *db.Store
	imageRoot, version, commit string
	analytics                  *analytics.Store
}

var _ api.StrictServerInterface = (*healthHandler)(nil)

func (h *healthHandler) GetHealth(ctx context.Context, _ api.GetHealthRequestObject) (api.GetHealthResponseObject, error) {
	// The generated Gin strict wrapper passes its context through unchanged.
	c := ctx.(*gin.Context)
	requestID := c.GetString("requestId")
	probeCtx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()
	unavailable := func(err error, message string) (api.GetHealthResponseObject, error) {
		h.logger.Error("readiness failed", "request_id", requestID, "error", err)
		var body api.ErrorJSONResponse
		body.Error.Code = "NOT_READY"
		body.Error.Message = message
		body.Error.RequestId = requestID
		return api.GetHealth503JSONResponse{ErrorJSONResponse: body}, nil
	}
	for _, store := range []*db.Store{h.mainDB, h.analyticsDB} {
		if err := store.Check(probeCtx); err != nil {
			return unavailable(err, "Database is unavailable")
		}
	}
	if err := checkDirectory(h.imageRoot); err != nil {
		return unavailable(err, "Image storage is unavailable")
	}
	return api.GetHealth200JSONResponse{Status: api.Ok, Version: h.version, Commit: h.commit}, nil
}
