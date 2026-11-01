import importlib.util
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


exporter = load_module("metrics_export", ROOT / "deploy/export-go-metrics.py")
legacy = load_module("legacy_metrics", ROOT / "server/visitor-counter.py")


class GoMetricsExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.main = self.root / "muyu.db"
        self.analytics = self.root / "analytics.db"
        self.output = self.root / "回滚 export"
        for path, migration in [(self.main, "muyu/00002_visitors.sql"),
                                (self.analytics, "analytics/00002_events.sql")]:
            sql = (ROOT / "services/api/migrations" / migration).read_text(encoding="utf-8")
            with closing(sqlite3.connect(path)) as connection:
                connection.executescript(sql.split("-- +goose Down")[0])
        with closing(sqlite3.connect(self.main)) as connection:
            connection.execute("UPDATE visitor_counter SET total=42 WHERE id=1")
            connection.execute("INSERT INTO visitors(visitor_id,first_seen_at) VALUES(?,'2026-11-01T12:00:00Z')", ("a" * 64,))
            connection.commit()

    def test_export_includes_wal_and_resumes_python_without_double_counting(self):
        with closing(sqlite3.connect(self.analytics)) as source:
            source.execute("PRAGMA journal_mode=WAL")
            for _ in range(3):
                source.execute("""INSERT INTO analytics_events
                    (occurred_at,event_day,event_type,path,session_id,visitor_id,browser,operating_system,device)
                    VALUES('2026-11-01T12:00:00.000+00:00','2026-11-01','pageview','/中文','s','v','Chrome','Linux','desktop')""")
            source.execute("DELETE FROM analytics_events WHERE id=3")
            source.commit()
            report = exporter.export_metrics(self.main, self.analytics, self.output)
            self.assertEqual(report, {"total": 42, "visitors": 1, "events": 2,
                                      "maxEventId": 2, "eventSequence": 3})
            with closing(sqlite3.connect(self.output / "analytics.sqlite3")) as restored:
                self.assertEqual(restored.execute("SELECT * FROM analytics_events").fetchall(),
                                 source.execute("SELECT * FROM analytics_events").fetchall())
        counter = legacy.JsonCounterStore(self.output / "visitor-count.json")
        self.assertEqual(counter.register("a" * 64), (42, False))
        self.assertEqual(counter.register("b" * 64), (43, True))
        analytics = legacy.AnalyticsStore(self.output / "analytics.sqlite3", b"test-secret")
        self.assertTrue(analytics.collect({"type": "pageview", "sessionId": "next"}, "127.0.0.1", "Chrome/140",
                                          datetime(2026, 11, 1, tzinfo=timezone.utc)))
        with closing(analytics._connect()) as connection:
            self.assertEqual(connection.execute("SELECT MAX(id) FROM analytics_events").fetchone()[0], 4)
        self.assertEqual(json.loads((self.output / "export-complete.json").read_text()), report)
        with self.assertRaises(FileExistsError):
            exporter.export_metrics(self.main, self.analytics, self.output)

    def test_failure_has_no_completion_marker_and_does_not_create_source(self):
        missing = self.root / "missing.db"
        with self.assertRaises(sqlite3.OperationalError):
            exporter.export_metrics(self.main, missing, self.output)
        self.assertFalse(missing.exists())
        self.assertFalse((self.output / "export-complete.json").exists())
        with closing(sqlite3.connect(self.main)) as source:
            self.assertEqual(source.execute("SELECT total FROM visitor_counter").fetchone()[0], 42)


if __name__ == "__main__":
    unittest.main()
