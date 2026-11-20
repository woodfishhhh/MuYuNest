// Package obituary counts observed installations independently of blog visitors.
package obituary

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"slices"
	"time"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
)

var idPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)
var versionPattern = regexp.MustCompile(`^v?(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})(-(dev|(alpha|beta|rc)\.?[0-9]{1,4}))?$`)
var dimensions = []string{"version", "os", "arch", "language", "channel"}
var categories = map[string][]string{
	"os": {"windows", "darwin", "linux", "unknown"}, "arch": {"amd64", "arm64", "386", "arm", "unknown"},
	"language": {"en", "zh-CN", "unknown"}, "channel": {"scoop", "homebrew", "winget", "script", "other", "unknown"},
}

// Decode accepts exactly six unique, case-sensitive string fields and one JSON object.
func Decode(r io.Reader) (map[string]string, error) {
	d := json.NewDecoder(r)
	invalid := errors.New("invalid obituary report")
	if t, e := d.Token(); e != nil || t != json.Delim('{') {
		return nil, invalid
	}
	p := map[string]string{}
	for d.More() {
		t, e := d.Token()
		k, ok := t.(string)
		var v string
		if e != nil || !ok || p[k] != "" || d.Decode(&v) != nil {
			return nil, invalid
		}
		switch k {
		case "install_id":
			ok = idPattern.MatchString(v)
		case "version":
			ok = v == "unknown" || versionPattern.MatchString(v)
		default:
			ok = slices.Contains(categories[k], v)
		}
		if !ok {
			return nil, invalid
		}
		p[k] = v
	}
	if t, e := d.Token(); e != nil || t != json.Delim('}') || len(p) != 6 {
		return nil, invalid
	}
	if _, e := d.Token(); e != io.EOF {
		return nil, invalid
	}
	return p, nil
}

type Stats struct {
	DB  *db.Store
	Key []byte
}

func (s Stats) Record(ctx context.Context, p map[string]string, now time.Time) error {
	mac := hmac.New(sha256.New, s.Key)
	mac.Write([]byte(p["install_id"]))
	id := mac.Sum(nil)
	day := now.UTC().Format(time.DateOnly)
	tx, e := s.DB.Write.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	if _, e = tx.ExecContext(ctx, `INSERT INTO installs VALUES (?,?,?) ON CONFLICT(digest) DO UPDATE SET last_day=max(last_day,excluded.last_day),first_day=min(first_day,excluded.first_day)`, id, day, day); e != nil {
		return e
	}
	if _, e = tx.ExecContext(ctx, `INSERT OR REPLACE INTO activity VALUES (?,?,?,?,?,?,?)`, day, id, p["version"], p["os"], p["arch"], p["language"], p["channel"]); e != nil {
		return e
	}
	if _, e = tx.ExecContext(ctx, `INSERT INTO channel_totals VALUES (?,1) ON CONFLICT(channel) DO UPDATE SET reports=reports+1`, p["channel"]); e != nil {
		return e
	}
	return tx.Commit()
}

func (s Stats) Prune(ctx context.Context, now time.Time) error {
	_, e := s.DB.Write.ExecContext(ctx, `DELETE FROM activity WHERE day < ?`, now.UTC().AddDate(0, 0, -399).Format(time.DateOnly))
	return e
}

// Run retention even on days with no reports.
func (s Stats) Maintain(ctx context.Context, onError func(error)) {
	for {
		now := time.Now().UTC()
		if err := s.Prune(ctx, now); err != nil && ctx.Err() == nil {
			onError(err)
		}
		timer := time.NewTimer(time.Until(now.Truncate(24 * time.Hour).Add(24 * time.Hour)))
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}

type Day struct {
	Date  string `json:"date"`
	Count *int   `json:"count"`
}
type Summary struct {
	AsOf          string                    `json:"as_of"`
	Daily         []Day                     `json:"daily_active"`
	Weekly        int                       `json:"weekly_active"`
	Monthly       int                       `json:"monthly_active"`
	Installs      int                       `json:"cumulative_installs"`
	Distributions map[string]map[string]int `json:"distributions"`
	Channels      map[string]int            `json:"channel_reports"`
}

func counts(ctx context.Context, tx *sql.Tx, query string, args ...any) (map[string]int, error) {
	rows, e := tx.QueryContext(ctx, query, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var label string
		var count int
		if e := rows.Scan(&label, &count); e != nil {
			return nil, e
		}
		out[label] = count
	}
	return out, rows.Err()
}

func (s Stats) Summary(ctx context.Context, now time.Time) (Summary, error) {
	end := now.UTC().AddDate(0, 0, -1)
	date := func(offset int) string { return end.AddDate(0, 0, offset).Format(time.DateOnly) }
	out := Summary{AsOf: date(0), Distributions: map[string]map[string]int{}}
	tx, e := s.DB.Read.BeginTx(ctx, nil)
	if e != nil {
		return out, e
	}
	defer tx.Rollback()
	var first string
	if e = tx.QueryRowContext(ctx, `SELECT first_day,(SELECT count(*) FROM installs) FROM coverage`).Scan(&first, &out.Installs); e != nil {
		return out, e
	}
	daily, e := counts(ctx, tx, `SELECT day,count(*) FROM activity WHERE day BETWEEN ? AND ? GROUP BY day`, date(-89), date(0))
	if e != nil {
		return out, e
	}
	for i := -89; i <= 0; i++ {
		d := Day{Date: date(i)}
		if d.Date >= first {
			v := daily[d.Date]
			d.Count = &v
		}
		out.Daily = append(out.Daily, d)
	}
	if e = tx.QueryRowContext(ctx, `SELECT count(DISTINCT CASE WHEN day>=? THEN digest END),count(DISTINCT digest) FROM activity WHERE day BETWEEN ? AND ?`, date(-6), date(-29), date(0)).Scan(&out.Weekly, &out.Monthly); e != nil {
		return out, e
	}
	for _, col := range dimensions {
		// Column names are constants; each installation contributes its last observation in the window.
		query := `WITH latest AS (SELECT digest,max(day) AS day FROM activity WHERE day BETWEEN ? AND ? GROUP BY digest) SELECT ` + col + `,count(*) FROM activity JOIN latest USING(day,digest) GROUP BY ` + col
		out.Distributions[col], e = counts(ctx, tx, query, date(-29), date(0))
		if e != nil {
			return out, e
		}
	}
	out.Channels, e = counts(ctx, tx, `SELECT channel,reports FROM channel_totals`)
	return out, e
}
