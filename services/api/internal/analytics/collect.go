package analytics

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/db/analyticssql"
)

const rawRetentionDays = 180
const timestampLayout = "2006-01-02T15:04:05.000-07:00"

var ErrInvalidEvent = errors.New("invalid analytics payload")
var botPattern = regexp.MustCompile(`(?i)bot|crawler|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit`)
var sessionPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]+$`)

type Store struct {
	db             *db.Store
	secret         []byte
	maintenance    sync.Mutex
	lastCleanupDay string
}

func New(database *db.Store, secret []byte) *Store { return &Store{db: database, secret: secret} }

func (s *Store) Collect(ctx context.Context, payload any, clientIP, userAgent string, now time.Time) (bool, error) {
	event, accepted, err := normalizeEvent(payload, clientIP, userAgent, now, s.secret)
	if err != nil || !accepted {
		return accepted, err
	}
	if err := analyticssql.New(s.db.Write).InsertEvent(ctx, event); err != nil {
		return false, err
	}
	s.maintenance.Lock()
	defer s.maintenance.Unlock()
	if s.lastCleanupDay != event.EventDay {
		cutoff := now.AddDate(0, 0, -rawRetentionDays).Format("2006-01-02")
		if err := analyticssql.New(s.db.Write).DeleteExpiredEvents(ctx, cutoff); err != nil {
			return false, err
		}
		s.lastCleanupDay = event.EventDay
	}
	return true, nil
}

func normalizeEvent(payload any, clientIP, userAgent string, now time.Time, secret []byte) (analyticssql.InsertEventParams, bool, error) {
	var event analyticssql.InsertEventParams
	input, ok := payload.(map[string]any)
	if !ok || input == nil {
		return event, false, fmt.Errorf("%w: payload must be an object", ErrInvalidEvent)
	}
	if botPattern.MatchString(userAgent) {
		return event, false, nil
	}
	event.EventType = clampText(input["type"], 24)
	switch event.EventType {
	case "event", "pageview", "performance":
	default:
		return event, false, fmt.Errorf("%w: unsupported event type", ErrInvalidEvent)
	}
	event.SessionID = clampText(input["sessionId"], 80)
	if !sessionPattern.MatchString(event.SessionID) {
		return event, false, fmt.Errorf("%w: invalid session id", ErrInvalidEvent)
	}
	event.EventName = clampText(input["name"], 80)
	if event.EventType != "pageview" && event.EventName == "" {
		return event, false, fmt.Errorf("%w: event name is required", ErrInvalidEvent)
	}
	rawData := input["data"]
	data, ok := rawData.(map[string]any)
	if emptyValue(rawData) {
		data = map[string]any{}
		ok = true
	}
	if !ok || len(data) > 16 {
		return event, false, fmt.Errorf("%w: event data must be a small object", ErrInvalidEvent)
	}
	cleanData := make(map[string]any)
	for key, value := range data {
		key = clampText(key, 48)
		if key == "" {
			continue
		}
		switch value := value.(type) {
		case string:
			cleanData[key] = clampText(value, 160)
		case bool, float64, json.Number:
			cleanData[key] = value
		}
	}
	if event.EventType == "performance" {
		event.MetricName = strings.ToUpper(clampText(cleanData["metric"], 16))
		switch event.MetricName {
		case "CLS", "FCP", "LCP", "TTFB":
		default:
			return event, false, fmt.Errorf("%w: unsupported performance metric", ErrInvalidEvent)
		}
		value, valid := metricNumber(cleanData["value"])
		if !valid || math.IsNaN(value) || value < 0 || value > 600000 {
			return event, false, fmt.Errorf("%w: invalid performance value", ErrInvalidEvent)
		}
		event.MetricValue = sql.NullFloat64{Float64: value, Valid: true}
		event.MetricRating = clampText(cleanData["rating"], 24)
	}
	encoded, err := json.Marshal(cleanData)
	if err != nil {
		return event, false, fmt.Errorf("%w: %v", ErrInvalidEvent, err)
	}
	event.DataJson = string(encoded)
	event.OccurredAt = now.Format(timestampLayout)
	event.EventDay = now.Format("2006-01-02")
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(event.EventDay + "|" + clientIP + "|" + userAgent))
	event.VisitorID = hex.EncodeToString(mac.Sum(nil))[:32]
	event.Browser, event.OperatingSystem, event.Device = parseUserAgent(userAgent)
	event.Path = clampText(input["path"], 512)
	if !strings.HasPrefix(event.Path, "/") {
		event.Path = "/"
	}
	if pos := strings.IndexAny(event.Path, "?#"); pos >= 0 {
		event.Path = event.Path[:pos]
	}
	event.Title = clampText(input["title"], 200)
	referrerText, _ := input["referrer"].(string)
	referrer, err := url.Parse(referrerText)
	if err == nil {
		event.ReferrerHost = clampText(strings.ToLower(referrer.Hostname()), 255)
	}
	event.Language = clampText(input["language"], 32)
	event.Timezone = clampText(input["timezone"], 64)
	return event, true, nil
}

func clampText(value any, limit int) string {
	text, ok := value.(string)
	if !ok {
		return ""
	}
	runes := []rune(strings.TrimSpace(text))
	if len(runes) > limit {
		runes = runes[:limit]
	}
	return string(runes)
}

func emptyValue(value any) bool {
	switch value := value.(type) {
	case nil:
		return true
	case bool:
		return !value
	case float64:
		return value == 0
	case string:
		return value == ""
	case []any:
		return len(value) == 0
	case map[string]any:
		return len(value) == 0
	}
	return false
}

func metricNumber(value any) (float64, bool) {
	switch value := value.(type) {
	case float64:
		return value, true
	case json.Number:
		number, err := value.Float64()
		return number, err == nil
	case bool:
		if value {
			return 1, true
		}
		return 0, true
	}
	return 0, false
}

func parseUserAgent(ua string) (browser, system, device string) {
	browser, system, device = "Other", "Other", "Desktop"
	switch {
	case strings.Contains(ua, "Edg/"):
		browser = "Edge"
	case strings.Contains(ua, "OPR/") || strings.Contains(ua, "Opera"):
		browser = "Opera"
	case strings.Contains(ua, "Firefox/"):
		browser = "Firefox"
	case strings.Contains(ua, "Chrome/") || strings.Contains(ua, "CriOS/"):
		browser = "Chrome"
	case strings.Contains(ua, "Safari/"):
		browser = "Safari"
	}
	switch {
	case strings.Contains(ua, "Windows"):
		system = "Windows"
	case strings.Contains(ua, "Android"):
		system = "Android"
	case strings.Contains(ua, "iPhone") || strings.Contains(ua, "iPad") || strings.Contains(ua, "iOS"):
		system = "iOS"
	case strings.Contains(ua, "Mac OS X") || strings.Contains(ua, "Macintosh"):
		system = "macOS"
	case strings.Contains(ua, "Linux"):
		system = "Linux"
	}
	switch {
	case strings.Contains(ua, "iPad") || strings.Contains(ua, "Tablet"):
		device = "Tablet"
	case strings.Contains(ua, "Mobile") || strings.Contains(ua, "iPhone") || strings.Contains(ua, "Android"):
		device = "Mobile"
	}
	return
}
