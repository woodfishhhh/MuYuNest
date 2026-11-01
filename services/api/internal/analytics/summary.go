package analytics

import (
	"context"
	"math"
	"strconv"
	"time"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db/analyticssql"
)

type Totals struct {
	analyticssql.SummaryTotalsRow
	ActiveVisitors30m int64   `json:"activeVisitors30m"`
	BounceRate        float64 `json:"bounceRate"`
	AvgSessionSeconds int64   `json:"avgSessionSeconds"`
}

type Summary struct {
	RangeDays        int                             `json:"rangeDays"`
	GeneratedAt      string                          `json:"generatedAt"`
	Totals           Totals                          `json:"totals"`
	TimeSeries       []analyticssql.SummaryDaysRow   `json:"timeSeries"`
	TopPages         []analyticssql.SummaryGroupRow  `json:"topPages"`
	Referrers        []analyticssql.SummaryGroupRow  `json:"referrers"`
	Devices          []analyticssql.SummaryGroupRow  `json:"devices"`
	Browsers         []analyticssql.SummaryGroupRow  `json:"browsers"`
	OperatingSystems []analyticssql.SummaryGroupRow  `json:"operatingSystems"`
	Languages        []analyticssql.SummaryGroupRow  `json:"languages"`
	Timezones        []analyticssql.SummaryGroupRow  `json:"timezones"`
	CustomEvents     []analyticssql.SummaryGroupRow  `json:"customEvents"`
	WebVitals        []analyticssql.SummaryVitalsRow `json:"webVitals"`
}

func (s *Store) Summary(ctx context.Context, days int, now time.Time) (Summary, error) {
	days = max(1, min(days, 365))
	result := Summary{RangeDays: days, GeneratedAt: now.Format("2006-01-02T15:04:05-07:00"), TimeSeries: make([]analyticssql.SummaryDaysRow, 0, days)}
	start := now.AddDate(0, 0, 1-days).Format("2006-01-02")
	queries := analyticssql.New(s.db.Read)
	totals, err := queries.SummaryTotals(ctx, start)
	if err != nil {
		return Summary{}, err
	}
	result.Totals.SummaryTotalsRow = totals
	result.Totals.ActiveVisitors30m, err = queries.ActiveVisitors(ctx, now.Add(-30*time.Minute).Format(timestampLayout))
	if err != nil {
		return Summary{}, err
	}
	sessions, err := queries.SummarySessions(ctx, start)
	if err != nil {
		return Summary{}, err
	}
	if len(sessions) > 0 {
		bounces := 0
		duration := 0.0
		for _, session := range sessions {
			if session.Pageviews == 1 {
				bounces++
			}
			duration += math.Max(session.Duration, 0)
		}
		// Decimal formatting rounds the binary float like Python round(value, 1),
		// avoiding the extra rounding introduced by multiplying by ten first.
		rate := 100 * float64(bounces) / float64(len(sessions))
		result.Totals.BounceRate, _ = strconv.ParseFloat(strconv.FormatFloat(rate, 'f', 1, 64), 64)
		result.Totals.AvgSessionSeconds = int64(math.RoundToEven(duration / float64(len(sessions))))
	}
	dates, err := queries.SummaryDays(ctx, start)
	if err != nil {
		return Summary{}, err
	}
	byDay := make(map[string]analyticssql.SummaryDaysRow, len(dates))
	for _, day := range dates {
		byDay[day.Label] = day
	}
	for offset := days - 1; offset >= 0; offset-- {
		label := now.AddDate(0, 0, -offset).Format("2006-01-02")
		day := byDay[label]
		day.Label = label
		result.TimeSeries = append(result.TimeSeries, day)
	}
	groups := []struct {
		dimension, eventType string
		excludeEmpty         int64
		target               *[]analyticssql.SummaryGroupRow
	}{
		{"path", "pageview", 0, &result.TopPages}, {"referrer_host", "pageview", 1, &result.Referrers},
		{"device", "pageview", 0, &result.Devices}, {"browser", "pageview", 0, &result.Browsers},
		{"operating_system", "pageview", 0, &result.OperatingSystems}, {"language", "pageview", 1, &result.Languages},
		{"timezone", "pageview", 1, &result.Timezones}, {"event_name", "event", 0, &result.CustomEvents},
	}
	for _, group := range groups {
		*group.target, err = queries.SummaryGroup(ctx, analyticssql.SummaryGroupParams{Dimension: group.dimension, EventType: group.eventType, ExcludeEmpty: group.excludeEmpty, StartDay: start})
		if err != nil {
			return Summary{}, err
		}
	}
	result.WebVitals, err = queries.SummaryVitals(ctx, start)
	if err != nil {
		return Summary{}, err
	}
	return result, nil
}
