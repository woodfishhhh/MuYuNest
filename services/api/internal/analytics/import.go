package analytics

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"slices"
	"strings"
)

const eventColumns = "id,occurred_at,event_day,event_type,event_name,path,title,referrer_host,session_id,visitor_id,browser,operating_system,device,language,timezone,metric_name,metric_value,metric_rating,data_json"

type LegacyReport struct {
	Events   int64 `json:"events"`
	MaxID    int64 `json:"maxId"`
	Sequence int64 `json:"sequence"`
}

type ImportReport struct {
	LegacyReport
	Added int64 `json:"added"`
}

func legacyURI(path string) (string, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	normalized := filepath.ToSlash(absolute)
	if filepath.VolumeName(absolute) != "" {
		normalized = "/" + normalized
	}
	return (&url.URL{Scheme: "file", Path: normalized, RawQuery: "mode=ro"}).String(), nil
}

// InspectLegacy never creates or migrates the source database.
func InspectLegacy(ctx context.Context, path string) (LegacyReport, error) {
	uri, err := legacyURI(path)
	if err != nil {
		return LegacyReport{}, err
	}
	source, err := sql.Open("sqlite", uri)
	if err != nil {
		return LegacyReport{}, err
	}
	defer source.Close()
	rows, err := source.QueryContext(ctx, "SELECT * FROM analytics_events LIMIT 0")
	if err != nil {
		return LegacyReport{}, err
	}
	columns, err := rows.Columns()
	closeErr := rows.Close()
	if err != nil || closeErr != nil {
		return LegacyReport{}, errors.Join(err, closeErr)
	}
	if !slices.Equal(columns, strings.Split(eventColumns, ",")) {
		return LegacyReport{}, fmt.Errorf("legacy analytics schema does not match the supported event table")
	}
	var report LegacyReport
	err = source.QueryRowContext(ctx, `SELECT COUNT(*),COALESCE(MAX(id),0),
 COALESCE((SELECT seq FROM sqlite_sequence WHERE name='analytics_events'),0) FROM analytics_events`).Scan(&report.Events, &report.MaxID, &report.Sequence)
	return report, err
}

// ImportLegacy preserves event IDs and the AUTOINCREMENT high-water mark.
// Repeated imports may extend the same snapshot, but never overwrite divergent rows.
func (s *Store) ImportLegacy(ctx context.Context, path string) (report ImportReport, err error) {
	uri, err := legacyURI(path)
	if err != nil {
		return report, err
	}
	connection, err := s.db.Write.Conn(ctx)
	if err != nil {
		return report, err
	}
	defer connection.Close()
	if _, err = connection.ExecContext(ctx, "ATTACH DATABASE ? AS legacy", uri); err != nil {
		return report, err
	}
	defer func() {
		_, detachErr := connection.ExecContext(context.Background(), "DETACH DATABASE legacy")
		err = errors.Join(err, detachErr)
	}()
	tx, err := connection.BeginTx(ctx, nil)
	if err != nil {
		return report, err
	}
	defer tx.Rollback()
	err = tx.QueryRowContext(ctx, `SELECT COUNT(*),COALESCE(MAX(id),0),
 COALESCE((SELECT seq FROM legacy.sqlite_sequence WHERE name='analytics_events'),0) FROM legacy.analytics_events`).Scan(&report.Events, &report.MaxID, &report.Sequence)
	if err != nil {
		return report, err
	}
	var mismatches, sequence int64
	err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM (SELECT "+eventColumns+" FROM main.analytics_events EXCEPT SELECT "+eventColumns+" FROM legacy.analytics_events)").Scan(&mismatches)
	if err != nil {
		return report, err
	}
	if mismatches != 0 {
		return report, fmt.Errorf("target contains %d events missing or different in the source; reconcile before importing", mismatches)
	}
	err = tx.QueryRowContext(ctx, "SELECT COALESCE((SELECT seq FROM main.sqlite_sequence WHERE name='analytics_events'),0)").Scan(&sequence)
	if err != nil {
		return report, err
	}
	if sequence > report.Sequence {
		return report, fmt.Errorf("target sequence %d is ahead of source %d", sequence, report.Sequence)
	}
	result, err := tx.ExecContext(ctx, "INSERT INTO main.analytics_events ("+eventColumns+") SELECT "+eventColumns+" FROM legacy.analytics_events WHERE id NOT IN (SELECT id FROM main.analytics_events)")
	if err != nil {
		return report, err
	}
	report.Added, err = result.RowsAffected()
	if err != nil {
		return report, err
	}
	_, err = tx.ExecContext(ctx, "UPDATE main.sqlite_sequence SET seq=? WHERE name='analytics_events'", report.Sequence)
	if err != nil {
		return report, err
	}
	_, err = tx.ExecContext(ctx, "INSERT INTO main.sqlite_sequence(name,seq) SELECT 'analytics_events',? WHERE NOT EXISTS (SELECT 1 FROM main.sqlite_sequence WHERE name='analytics_events')", report.Sequence)
	if err != nil {
		return report, err
	}
	err = tx.Commit()
	return report, err
}
