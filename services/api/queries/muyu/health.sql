-- name: ReadHealthProbe :one
SELECT checked_at FROM health_probe WHERE id = 1;

-- name: WriteHealthProbe :exec
UPDATE health_probe SET checked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
