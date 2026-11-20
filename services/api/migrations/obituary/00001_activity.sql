-- +goose Up
CREATE TABLE coverage (first_day TEXT NOT NULL);
INSERT INTO coverage VALUES (date('now'));
CREATE TABLE installs (digest BLOB PRIMARY KEY, first_day TEXT NOT NULL, last_day TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE activity (
    day TEXT NOT NULL, digest BLOB NOT NULL REFERENCES installs(digest),
    version TEXT NOT NULL, os TEXT NOT NULL, arch TEXT NOT NULL, language TEXT NOT NULL, channel TEXT NOT NULL,
    PRIMARY KEY(day,digest)
) WITHOUT ROWID;
CREATE TABLE channel_totals (channel TEXT PRIMARY KEY, reports INTEGER NOT NULL) WITHOUT ROWID;
