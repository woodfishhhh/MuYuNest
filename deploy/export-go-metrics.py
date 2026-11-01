#!/usr/bin/env python3
"""Export stopped Go metrics databases into a new Python-compatible directory."""

import argparse
import json
import sqlite3
from contextlib import closing
from pathlib import Path


def open_source(path):
    return sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True)


def export_metrics(main_path, analytics_path, output_path):
    output = Path(output_path)
    # Exclusive directory creation prevents replacing either live data or a backup.
    output.mkdir(mode=0o700)
    with closing(open_source(main_path)) as main:
        main.execute("BEGIN")
        row = main.execute("SELECT total FROM visitor_counter WHERE id=1").fetchone()
        if row is None or not isinstance(row[0], int) or row[0] < 0:
            raise ValueError("invalid visitor counter")
        visitors = [row[0] for row in main.execute("SELECT visitor_id FROM visitors ORDER BY visitor_id")]
        snapshot = {"total": row[0], "visitors": visitors}
        main.commit()
    with (output / "visitor-count.json").open("x", encoding="utf-8") as target:
        json.dump(snapshot, target, ensure_ascii=True)
        target.write("\n")
    with closing(open_source(analytics_path)) as source:
        with closing(sqlite3.connect(output / "analytics.sqlite3")) as target:
            # SQLite's backup API includes committed WAL pages; raw file copy does not.
            source.backup(target)
            check = target.execute("PRAGMA quick_check").fetchone()[0]
            if check != "ok":
                raise ValueError("analytics backup integrity check failed")
            events, max_id = target.execute(
                "SELECT COUNT(*),COALESCE(MAX(id),0) FROM analytics_events"
            ).fetchone()
            sequence = target.execute(
                "SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name='analytics_events'),0)"
            ).fetchone()[0]
    report = {
        "total": snapshot["total"],
        "visitors": len(visitors),
        "events": events,
        "maxEventId": max_id,
        "eventSequence": sequence,
    }
    # Written last: a partial directory without this file must never be installed.
    with (output / "export-complete.json").open("x", encoding="utf-8") as target:
        json.dump(report, target)
        target.write("\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, help="Go muyu.db; stop writers first")
    parser.add_argument("--analytics", required=True, help="Go analytics.db; stop writers first")
    parser.add_argument("--output", required=True, help="new directory; must not already exist")
    args = parser.parse_args()
    print(json.dumps(export_metrics(args.database, args.analytics, args.output)))


if __name__ == "__main__":
    main()
