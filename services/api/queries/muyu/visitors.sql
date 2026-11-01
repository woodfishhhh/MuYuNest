-- name: VisitorTotal :one
SELECT total FROM visitor_counter WHERE id = 1;

-- name: RegisterVisitor :execrows
INSERT INTO visitors (visitor_id, first_seen_at)
VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(visitor_id) DO NOTHING;

-- name: IncrementVisitorTotal :exec
UPDATE visitor_counter SET total = total + 1 WHERE id = 1;

-- name: ListVisitorIDs :many
SELECT visitor_id FROM visitors ORDER BY visitor_id;

-- name: SetVisitorTotal :exec
UPDATE visitor_counter SET total = ? WHERE id = 1;
