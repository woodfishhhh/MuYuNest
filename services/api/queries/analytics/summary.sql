-- name: SummaryTotals :one
SELECT CAST(COALESCE(SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END), 0) AS INTEGER) AS pageviews,
 COUNT(DISTINCT CASE WHEN event_type = 'pageview' THEN visitor_id END) AS visitors,
 COUNT(DISTINCT CASE WHEN event_type = 'pageview' THEN session_id END) AS sessions,
 CAST(COALESCE(SUM(CASE WHEN event_type = 'event' THEN 1 ELSE 0 END), 0) AS INTEGER) AS events
FROM analytics_events WHERE event_day >= ?;

-- name: SummarySessions :many
SELECT session_id, COUNT(*) AS pageviews,
 CAST(COALESCE((julianday(MAX(occurred_at)) - julianday(MIN(occurred_at))) * 86400, 0) AS REAL) AS duration
FROM analytics_events WHERE event_day >= ? AND event_type = 'pageview'
GROUP BY session_id;

-- name: ActiveVisitors :one
SELECT COUNT(DISTINCT visitor_id) FROM analytics_events WHERE occurred_at >= ?;

-- name: SummaryDays :many
SELECT event_day AS label, COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors
FROM analytics_events WHERE event_day >= ? AND event_type = 'pageview'
GROUP BY event_day ORDER BY event_day;

-- name: SummaryGroup :many
WITH selected AS (
 SELECT CASE CAST(sqlc.arg(dimension) AS TEXT)
 WHEN 'path' THEN path WHEN 'referrer_host' THEN referrer_host
 WHEN 'device' THEN device WHEN 'browser' THEN browser
 WHEN 'operating_system' THEN operating_system WHEN 'language' THEN language
 WHEN 'timezone' THEN timezone WHEN 'event_name' THEN event_name ELSE '' END AS label
 FROM analytics_events WHERE event_day >= sqlc.arg(start_day) AND event_type = sqlc.arg(event_type)
)
SELECT CAST(label AS TEXT) AS label, COUNT(*) AS value FROM selected
WHERE CAST(sqlc.arg(exclude_empty) AS INTEGER) = 0 OR label <> ''
GROUP BY label ORDER BY value DESC, label LIMIT 12;

-- name: SummaryVitals :many
SELECT metric_name AS name, CAST(ROUND(AVG(metric_value), 2) AS REAL) AS average,
 COUNT(*) AS samples,
 CAST(SUM(metric_rating = 'good') AS INTEGER) AS good,
 CAST(SUM(metric_rating = 'needs-improvement') AS INTEGER) AS "needsImprovement",
 CAST(SUM(metric_rating = 'poor') AS INTEGER) AS poor
FROM analytics_events WHERE event_day >= ? AND event_type = 'performance'
GROUP BY metric_name ORDER BY metric_name;
