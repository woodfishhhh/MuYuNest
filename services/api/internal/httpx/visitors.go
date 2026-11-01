package httpx

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/api"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/visitors"
)

const visitorCookie = "woodfish_visitor"

var visitorIDPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)

func (h *healthHandler) GetVisitorCount(ctx context.Context, _ api.GetVisitorCountRequestObject) (api.GetVisitorCountResponseObject, error) {
	c := ctx.(*gin.Context)
	total, err := visitors.New(h.mainDB).Total(c.Request.Context())
	if err != nil {
		return nil, err
	}
	return api.GetVisitorCount200JSONResponse{Total: total}, nil
}

func (h *healthHandler) RegisterVisit(ctx context.Context, _ api.RegisterVisitRequestObject) (api.RegisterVisitResponseObject, error) {
	c := ctx.(*gin.Context)
	headerID := c.GetHeader("X-Visitor-ID")
	// A malformed supplied header is rejected even if a valid cookie exists.
	if headerID != "" && !visitorIDPattern.MatchString(headerID) {
		var body api.ErrorJSONResponse
		body.Error.Code = "INVALID_VISITOR_ID"
		body.Error.Message = "invalid visitor id"
		body.Error.RequestId = c.GetString("requestId")
		return api.RegisterVisit400JSONResponse{ErrorJSONResponse: body}, nil
	}
	id := headerID
	if cookie, err := c.Request.Cookie(visitorCookie); err == nil && visitorIDPattern.MatchString(cookie.Value) {
		id = cookie.Value
	}
	if id == "" {
		var random [16]byte
		if _, err := rand.Read(random[:]); err != nil {
			return nil, err
		}
		id = hex.EncodeToString(random[:])
	}
	digest := sha256.Sum256([]byte(id))
	result, err := visitors.New(h.mainDB).Register(c.Request.Context(), hex.EncodeToString(digest[:]), c.GetHeader("X-Visitor-Counted") == "1")
	if err != nil {
		return nil, err
	}
	cookie := (&http.Cookie{Name: visitorCookie, Value: id, Path: "/", MaxAge: 31536000,
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: c.GetHeader("X-Forwarded-Proto") == "https"}).String()
	var response api.RegisterVisit200JSONResponse
	response.Body.Total = result.Total
	response.Body.Counted = result.Counted
	response.Headers.SetCookie = &cookie
	return response, nil
}
