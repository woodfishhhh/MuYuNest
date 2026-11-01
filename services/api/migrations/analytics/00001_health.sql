-- +goose Up
CREATE TABLE health_probe (id INTEGER PRIMARY KEY CHECK (id = 1), checked_at TEXT NOT NULL);
INSERT INTO health_probe VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- +goose Down
DROP TABLE health_probe;
