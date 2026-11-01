-- +goose Up
CREATE TABLE visitor_counter (id INTEGER PRIMARY KEY CHECK (id = 1), total INTEGER NOT NULL);
INSERT INTO visitor_counter (id, total) VALUES (1, 0);
CREATE TABLE visitors (visitor_id TEXT PRIMARY KEY, first_seen_at TEXT NOT NULL);

-- +goose Down
DROP TABLE visitors;
DROP TABLE visitor_counter;
