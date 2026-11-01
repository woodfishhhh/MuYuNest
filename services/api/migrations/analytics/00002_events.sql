-- +goose Up
CREATE TABLE analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL,
    event_day TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL DEFAULT '',
    path TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    referrer_host TEXT NOT NULL DEFAULT '',
    session_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    browser TEXT NOT NULL,
    operating_system TEXT NOT NULL,
    device TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT '',
    timezone TEXT NOT NULL DEFAULT '',
    metric_name TEXT NOT NULL DEFAULT '',
    metric_value REAL,
    metric_rating TEXT NOT NULL DEFAULT '',
    data_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX analytics_events_day_type ON analytics_events(event_day, event_type);
CREATE INDEX analytics_events_session ON analytics_events(session_id, occurred_at);
CREATE INDEX analytics_events_path ON analytics_events(path, event_type);

-- +goose Down
DROP TABLE analytics_events;
