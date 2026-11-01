-- name: VisitorTotal :one
SELECT total FROM visitor_counter WHERE id = 1;

-- name: RegisterVisitor :execrows
INSERT INTO visitors (visitor_id, first_seen_at)
VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(visitor_id) DO NOTHING;

-- name: IncrementVisitorTotal :exec
UPDATE visitor_counter SET total = total + 1 WHERE id = 1;
