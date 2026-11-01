-- name: InsertEvent :exec
INSERT INTO analytics_events (
 occurred_at, event_day, event_type, event_name, path, title, referrer_host,
 session_id, visitor_id, browser, operating_system, device, language, timezone,
 metric_name, metric_value, metric_rating, data_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: DeleteExpiredEvents :exec
DELETE FROM analytics_events WHERE event_day < ?;

-- name: ListEvents :many
SELECT * FROM analytics_events ORDER BY id;
