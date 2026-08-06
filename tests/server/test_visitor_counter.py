import importlib.util
import json
import sqlite3
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "server" / "visitor-counter.py"


def load_visitor_counter_module():
    spec = importlib.util.spec_from_file_location("visitor_counter", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load visitor counter module from {MODULE_PATH}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class VisitorCounterServerTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_file = Path(self.temp_dir.name) / "visitor-count.json"
        self.analytics_file = Path(self.temp_dir.name) / "analytics.sqlite3"
        self.module = load_visitor_counter_module()
        self.server = self.module.create_server(
            "127.0.0.1",
            0,
            self.data_file,
            self.analytics_file,
            b"test-analytics-secret",
            REPO_ROOT / "server" / "analytics-dashboard",
            "https://blog.woodfish.site",
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.server.server_address
        self.base_url = f"http://{host}:{port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp_dir.cleanup()

    def test_initializes_missing_data_file_with_zero_total(self):
        response = self.request_json("/api/visitor-count")

        self.assertEqual(response, {"total": 0})
        self.assertTrue(self.data_file.exists())
        self.assertEqual(json.loads(self.data_file.read_text(encoding="utf-8")), {"total": 0})

    def test_returns_current_total_without_incrementing_for_get(self):
        self.data_file.write_text(json.dumps({"total": 7}), encoding="utf-8")

        response = self.request_json("/api/visitor-count")

        self.assertEqual(response, {"total": 7})
        self.assertEqual(json.loads(self.data_file.read_text(encoding="utf-8")), {"total": 7})

    def test_increments_total_for_post_visit(self):
        self.data_file.write_text(json.dumps({"total": 9}), encoding="utf-8")

        response = self.request_json("/api/visitor-count/visit", method="POST")

        self.assertEqual(response, {"total": 10, "counted": True})
        self.assertEqual(json.loads(self.data_file.read_text(encoding="utf-8")), {"total": 10})

    def test_returns_404_for_unknown_paths(self):
        with self.assertRaises(urllib.error.HTTPError) as error_context:
            self.request_json("/api/unknown")

        self.assertEqual(error_context.exception.code, 404)
        error_context.exception.close()

    def test_returns_405_for_unsupported_methods(self):
        with self.assertRaises(urllib.error.HTTPError) as error_context:
            self.request_json("/api/visitor-count/visit", method="GET")

        self.assertEqual(error_context.exception.code, 405)
        error_context.exception.close()

    def test_collects_privacy_safe_pageviews_and_summarizes_them(self):
        payload = {
            "type": "pageview",
            "path": "/works/?token=secret#orbit",
            "title": "Works",
            "referrer": "https://example.com/private/path?q=secret",
            "sessionId": "session-1",
            "language": "zh-CN",
            "timezone": "Asia/Shanghai",
        }
        response = self.request_json(
            "/api/analytics/collect",
            method="POST",
            payload=payload,
            headers={
                "Origin": "https://blog.woodfish.site",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36",
                "X-Forwarded-For": "203.0.113.42",
            },
        )

        self.assertEqual(response, {"accepted": True})
        summary = self.request_json("/api/analytics/summary?days=30")
        self.assertEqual(summary["totals"]["pageviews"], 1)
        self.assertEqual(summary["totals"]["visitors"], 1)
        self.assertEqual(summary["topPages"], [{"label": "/works/", "value": 1}])
        self.assertEqual(summary["referrers"], [{"label": "example.com", "value": 1}])
        self.assertEqual(summary["devices"], [{"label": "Desktop", "value": 1}])

        connection = sqlite3.connect(self.analytics_file)
        try:
            row = connection.execute(
                "SELECT path, referrer_host, visitor_id, browser, operating_system FROM analytics_events"
            ).fetchone()
        finally:
            connection.close()
        self.assertEqual(row[0], "/works/")
        self.assertEqual(row[1], "example.com")
        self.assertEqual(len(row[2]), 32)
        self.assertEqual(row[3:], ("Chrome", "Windows"))
        database_bytes = self.analytics_file.read_bytes()
        self.assertNotIn(b"203.0.113.42", database_bytes)
        self.assertNotIn(b"Mozilla/5.0", database_bytes)
        self.assertNotIn(b"private/path", database_bytes)

    def test_deduplicates_daily_visitors_but_keeps_pageviews(self):
        headers = {
            "Origin": "https://blog.woodfish.site",
            "User-Agent": "Mozilla/5.0 Firefox/129.0",
            "X-Forwarded-For": "198.51.100.8",
        }
        for path in ("/", "/author/"):
            self.request_json(
                "/api/analytics/collect",
                method="POST",
                payload={"type": "pageview", "path": path, "sessionId": "same-session"},
                headers=headers,
            )

        totals = self.request_json("/api/analytics/summary?days=7")["totals"]
        self.assertEqual(totals["pageviews"], 2)
        self.assertEqual(totals["visitors"], 1)
        self.assertEqual(totals["sessions"], 1)
        self.assertEqual(totals["bounceRate"], 0)

    def test_collects_custom_events_and_web_vitals(self):
        headers = {
            "Origin": "https://blog.woodfish.site",
            "User-Agent": "Mozilla/5.0 (iPhone) Mobile Safari/604.1",
        }
        self.request_json(
            "/api/analytics/collect",
            method="POST",
            payload={
                "type": "event",
                "name": "works-outbound",
                "path": "/works/",
                "sessionId": "event-session",
                "data": {"action": "live", "project": "blog"},
            },
            headers=headers,
        )
        self.request_json(
            "/api/analytics/collect",
            method="POST",
            payload={
                "type": "performance",
                "name": "web-vital",
                "path": "/works/",
                "sessionId": "event-session",
                "data": {"metric": "LCP", "rating": "good", "value": 1234.5},
            },
            headers=headers,
        )

        summary = self.request_json("/api/analytics/summary?days=7")
        self.assertEqual(summary["customEvents"], [{"label": "works-outbound", "value": 1}])
        self.assertEqual(summary["webVitals"][0]["name"], "LCP")
        self.assertEqual(summary["webVitals"][0]["average"], 1234.5)

    def test_rejects_foreign_origins_and_ignores_bots(self):
        payload = {"type": "pageview", "path": "/", "sessionId": "session-1"}
        with self.assertRaises(urllib.error.HTTPError) as error_context:
            self.request_json(
                "/api/analytics/collect",
                method="POST",
                payload=payload,
                headers={"Origin": "https://evil.example"},
            )
        self.assertEqual(error_context.exception.code, 403)
        error_context.exception.close()

        response = self.request_json(
            "/api/analytics/collect",
            method="POST",
            payload=payload,
            headers={
                "Origin": "https://blog.woodfish.site",
                "User-Agent": "Googlebot/2.1",
            },
        )
        self.assertEqual(response, {"accepted": False})
        self.assertEqual(self.request_json("/api/analytics/summary?days=7")["totals"]["pageviews"], 0)

    def test_serves_dashboard_assets_and_health(self):
        health = self.request_json("/api/analytics/health")
        self.assertEqual(health, {"ok": True, "storage": "sqlite"})
        with urllib.request.urlopen(f"{self.base_url}/analytics/", timeout=5) as response:
            body = response.read().decode("utf-8")
            self.assertEqual(response.status, 200)
            self.assertIn("WoodFish Analytics", body)

    def request_json(self, path, method="GET", payload=None, headers=None):
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request_headers = dict(headers or {})
        if body is not None:
            request_headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=body,
            headers=request_headers,
            method=method,
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
