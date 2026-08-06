#!/usr/bin/env python3

import hashlib
import hmac
import json
import mimetypes
import os
import re
import sqlite3
import threading
from contextlib import closing
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


MAX_BODY_BYTES = 16 * 1024
RAW_EVENT_RETENTION_DAYS = 180
BOT_PATTERN = re.compile(
    r"bot|crawler|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit",
    re.IGNORECASE,
)


def utc_now():
    return datetime.now(timezone.utc)


def clamp_text(value, limit, default=""):
    if not isinstance(value, str):
        return default
    return value.strip()[:limit]


def clean_path(value):
    path = clamp_text(value, 512, "/")
    if not path.startswith("/"):
        path = "/"
    return path.split("?", 1)[0].split("#", 1)[0] or "/"


def referrer_host(value):
    try:
        return clamp_text(urlparse(value).hostname or "", 255)
    except ValueError:
        return ""


def parse_user_agent(user_agent):
    ua = user_agent or ""
    if "Edg/" in ua:
        browser = "Edge"
    elif "OPR/" in ua or "Opera" in ua:
        browser = "Opera"
    elif "Firefox/" in ua:
        browser = "Firefox"
    elif "Chrome/" in ua or "CriOS/" in ua:
        browser = "Chrome"
    elif "Safari/" in ua:
        browser = "Safari"
    else:
        browser = "Other"

    if "Windows" in ua:
        operating_system = "Windows"
    elif "Android" in ua:
        operating_system = "Android"
    elif "iPhone" in ua or "iPad" in ua or "iOS" in ua:
        operating_system = "iOS"
    elif "Mac OS X" in ua or "Macintosh" in ua:
        operating_system = "macOS"
    elif "Linux" in ua:
        operating_system = "Linux"
    else:
        operating_system = "Other"

    if "iPad" in ua or "Tablet" in ua:
        device = "Tablet"
    elif "Mobile" in ua or "iPhone" in ua or "Android" in ua:
        device = "Mobile"
    else:
        device = "Desktop"
    return browser, operating_system, device


class JsonCounterStore:
    def __init__(self, data_file):
        self.data_file = Path(data_file)
        self._lock = threading.Lock()
        self._ensure_file()

    def read_total(self):
        with self._lock:
            return self._read_payload()["total"]

    def increment(self):
        with self._lock:
            payload = self._read_payload()
            payload["total"] += 1
            self._write_payload(payload)
            return payload["total"]

    def _ensure_file(self):
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.data_file.exists():
            self._write_payload({"total": 0})

    def _read_payload(self):
        payload = json.loads(self.data_file.read_text(encoding="utf-8"))
        if not isinstance(payload, dict) or not isinstance(payload.get("total"), int):
            raise ValueError("visitor counter payload must be an object with integer total")
        return payload

    def _write_payload(self, payload):
        temp_file = self.data_file.with_suffix(f"{self.data_file.suffix}.tmp")
        temp_file.write_text(json.dumps(payload), encoding="utf-8")
        os.replace(temp_file, self.data_file)


class AnalyticsStore:
    def __init__(self, data_file, secret):
        self.data_file = Path(data_file)
        self.secret = secret if isinstance(secret, bytes) else str(secret).encode("utf-8")
        self._maintenance_lock = threading.Lock()
        self._last_cleanup_day = None
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self):
        connection = sqlite3.connect(self.data_file, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=NORMAL")
        return connection

    def _initialize(self):
        with closing(self._connect()) as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS analytics_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    occurred_at TEXT NOT NULL,
                    event_day TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    event_name TEXT NOT NULL DEFAULT '',
                    path TEXT NOT NULL,
                    title TEXT NOT NULL DEFAULT '',
                    referrer_host TEXT NOT NULL DEFAULT '',
                    session_id TEXT NOT NULL,
                    visitor_id TEXT NOT NULL,
                    browser TEXT NOT NULL,
                    operating_system TEXT NOT NULL,
                    device TEXT NOT NULL,
                    language TEXT NOT NULL DEFAULT '',
                    timezone TEXT NOT NULL DEFAULT '',
                    metric_name TEXT NOT NULL DEFAULT '',
                    metric_value REAL,
                    metric_rating TEXT NOT NULL DEFAULT '',
                    data_json TEXT NOT NULL DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS analytics_events_day_type
                    ON analytics_events(event_day, event_type);
                CREATE INDEX IF NOT EXISTS analytics_events_session
                    ON analytics_events(session_id, occurred_at);
                CREATE INDEX IF NOT EXISTS analytics_events_path
                    ON analytics_events(path, event_type);
                """
            )
            connection.commit()

    def collect(self, payload, client_ip, user_agent, now=None):
        if not isinstance(payload, dict):
            raise ValueError("payload must be an object")
        if BOT_PATTERN.search(user_agent or ""):
            return False

        event_type = clamp_text(payload.get("type"), 24)
        if event_type not in {"event", "pageview", "performance"}:
            raise ValueError("unsupported event type")

        session_id = clamp_text(payload.get("sessionId"), 80)
        if not session_id or not re.fullmatch(r"[A-Za-z0-9._:-]+", session_id):
            raise ValueError("invalid session id")

        event_name = clamp_text(payload.get("name"), 80)
        if event_type != "pageview" and not event_name:
            raise ValueError("event name is required")

        data = payload.get("data") or {}
        if not isinstance(data, dict) or len(data) > 16:
            raise ValueError("event data must be a small object")
        clean_data = {}
        for key, value in data.items():
            key = clamp_text(key, 48)
            if not key or not isinstance(value, (bool, int, float, str)):
                continue
            clean_data[key] = clamp_text(value, 160) if isinstance(value, str) else value

        metric_name = ""
        metric_value = None
        metric_rating = ""
        if event_type == "performance":
            metric_name = clamp_text(clean_data.get("metric"), 16).upper()
            if metric_name not in {"CLS", "FCP", "LCP", "TTFB"}:
                raise ValueError("unsupported performance metric")
            value = clean_data.get("value")
            if not isinstance(value, (int, float)) or not 0 <= float(value) <= 600000:
                raise ValueError("invalid performance value")
            metric_value = float(value)
            metric_rating = clamp_text(clean_data.get("rating"), 24)

        now = now or utc_now()
        occurred_at = now.isoformat(timespec="milliseconds")
        event_day = now.date().isoformat()
        identity = f"{event_day}|{client_ip}|{user_agent}".encode("utf-8", errors="replace")
        visitor_id = hmac.new(self.secret, identity, hashlib.sha256).hexdigest()[:32]
        browser, operating_system, device = parse_user_agent(user_agent)

        with closing(self._connect()) as connection:
            connection.execute(
                """
                INSERT INTO analytics_events (
                    occurred_at, event_day, event_type, event_name, path, title,
                    referrer_host, session_id, visitor_id, browser, operating_system,
                    device, language, timezone, metric_name, metric_value,
                    metric_rating, data_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    occurred_at,
                    event_day,
                    event_type,
                    event_name,
                    clean_path(payload.get("path")),
                    clamp_text(payload.get("title"), 200),
                    referrer_host(payload.get("referrer")),
                    session_id,
                    visitor_id,
                    browser,
                    operating_system,
                    device,
                    clamp_text(payload.get("language"), 32),
                    clamp_text(payload.get("timezone"), 64),
                    metric_name,
                    metric_value,
                    metric_rating,
                    json.dumps(clean_data, ensure_ascii=True, separators=(",", ":")),
                ),
            )
            connection.commit()
        self._cleanup_if_due(now)
        return True

    def _cleanup_if_due(self, now):
        day = now.date().isoformat()
        if self._last_cleanup_day == day:
            return
        with self._maintenance_lock:
            if self._last_cleanup_day == day:
                return
            cutoff = (now.date() - timedelta(days=RAW_EVENT_RETENTION_DAYS)).isoformat()
            with closing(self._connect()) as connection:
                connection.execute("DELETE FROM analytics_events WHERE event_day < ?", (cutoff,))
                connection.commit()
            self._last_cleanup_day = day

    def summary(self, days):
        days = max(1, min(int(days), 365))
        today = utc_now().date()
        start_day = (today - timedelta(days=days - 1)).isoformat()
        active_since = (utc_now() - timedelta(minutes=30)).isoformat(timespec="milliseconds")
        with closing(self._connect()) as connection:
            totals = connection.execute(
                """
                SELECT
                    SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
                    COUNT(DISTINCT CASE WHEN event_type = 'pageview' THEN visitor_id END) AS visitors,
                    COUNT(DISTINCT CASE WHEN event_type = 'pageview' THEN session_id END) AS sessions,
                    SUM(CASE WHEN event_type = 'event' THEN 1 ELSE 0 END) AS events
                FROM analytics_events WHERE event_day >= ?
                """,
                (start_day,),
            ).fetchone()
            session_rows = connection.execute(
                """
                SELECT session_id, COUNT(*) AS pageviews,
                       (julianday(MAX(occurred_at)) - julianday(MIN(occurred_at))) * 86400 AS duration
                FROM analytics_events
                WHERE event_day >= ? AND event_type = 'pageview'
                GROUP BY session_id
                """,
                (start_day,),
            ).fetchall()
            active = connection.execute(
                "SELECT COUNT(DISTINCT visitor_id) FROM analytics_events WHERE occurred_at >= ?",
                (active_since,),
            ).fetchone()[0]

            time_rows = connection.execute(
                """
                SELECT event_day AS label, COUNT(*) AS pageviews,
                       COUNT(DISTINCT visitor_id) AS visitors
                FROM analytics_events
                WHERE event_day >= ? AND event_type = 'pageview'
                GROUP BY event_day ORDER BY event_day
                """,
                (start_day,),
            ).fetchall()

            result = {
                "rangeDays": days,
                "generatedAt": utc_now().isoformat(timespec="seconds"),
                "totals": {
                    "pageviews": totals["pageviews"] or 0,
                    "visitors": totals["visitors"] or 0,
                    "sessions": totals["sessions"] or 0,
                    "events": totals["events"] or 0,
                    "activeVisitors30m": active or 0,
                    "bounceRate": round(
                        100 * sum(row["pageviews"] == 1 for row in session_rows) / len(session_rows), 1
                    ) if session_rows else 0,
                    "avgSessionSeconds": round(
                        sum(max(row["duration"] or 0, 0) for row in session_rows) / len(session_rows)
                    ) if session_rows else 0,
                },
                "timeSeries": self._fill_time_series(today, days, time_rows),
                "topPages": self._group(connection, "path", start_day, "event_type = 'pageview'"),
                "referrers": self._group(
                    connection,
                    "referrer_host",
                    start_day,
                    "event_type = 'pageview' AND referrer_host <> ''",
                ),
                "devices": self._group(connection, "device", start_day, "event_type = 'pageview'"),
                "browsers": self._group(connection, "browser", start_day, "event_type = 'pageview'"),
                "operatingSystems": self._group(
                    connection, "operating_system", start_day, "event_type = 'pageview'"
                ),
                "languages": self._group(
                    connection, "language", start_day, "event_type = 'pageview' AND language <> ''"
                ),
                "timezones": self._group(
                    connection, "timezone", start_day, "event_type = 'pageview' AND timezone <> ''"
                ),
                "customEvents": self._group(
                    connection, "event_name", start_day, "event_type = 'event'"
                ),
                "webVitals": [dict(row) for row in connection.execute(
                    """
                    SELECT metric_name AS name, ROUND(AVG(metric_value), 2) AS average,
                           COUNT(*) AS samples,
                           SUM(metric_rating = 'good') AS good,
                           SUM(metric_rating = 'needs-improvement') AS needsImprovement,
                           SUM(metric_rating = 'poor') AS poor
                    FROM analytics_events
                    WHERE event_day >= ? AND event_type = 'performance'
                    GROUP BY metric_name ORDER BY metric_name
                    """,
                    (start_day,),
                ).fetchall()],
            }
        return result

    @staticmethod
    def _group(connection, column, start_day, where_clause):
        allowed_columns = {
            "browser", "device", "event_name", "language", "operating_system",
            "path", "referrer_host", "timezone",
        }
        if column not in allowed_columns:
            raise ValueError("unsupported analytics grouping")
        rows = connection.execute(
            f"""SELECT {column} AS label, COUNT(*) AS value
                FROM analytics_events WHERE event_day >= ? AND {where_clause}
                GROUP BY {column} ORDER BY value DESC, label LIMIT 12""",
            (start_day,),
        ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def _fill_time_series(today, days, rows):
        by_day = {row["label"]: dict(row) for row in rows}
        result = []
        for offset in range(days - 1, -1, -1):
            label = (today - timedelta(days=offset)).isoformat()
            result.append(by_day.get(label, {"label": label, "pageviews": 0, "visitors": 0}))
        return result


class VisitorCounterHandler(BaseHTTPRequestHandler):
    server_version = "WoodfishMetrics/2.0"

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/visitor-count":
            self._send_json(HTTPStatus.OK, {"total": self.server.counter_store.read_total()})
            return
        if parsed.path == "/api/visitor-count/visit":
            self._send_json(HTTPStatus.METHOD_NOT_ALLOWED, {"error": "method not allowed"})
            return
        if parsed.path == "/api/analytics/health":
            self._send_json(HTTPStatus.OK, {"ok": True, "storage": "sqlite"})
            return
        if parsed.path == "/api/analytics/summary":
            try:
                days = int(parse_qs(parsed.query).get("days", ["30"])[0])
                self._send_json(HTTPStatus.OK, self.server.analytics_store.summary(days))
            except (TypeError, ValueError):
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid days"})
            return
        if parsed.path == "/analytics" or parsed.path.startswith("/analytics/"):
            self._serve_dashboard(parsed.path)
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/visitor-count/visit":
            total = self.server.counter_store.increment()
            self._send_json(HTTPStatus.OK, {"total": total, "counted": True})
            return
        if parsed.path == "/api/visitor-count":
            self._send_json(HTTPStatus.METHOD_NOT_ALLOWED, {"error": "method not allowed"})
            return
        if parsed.path == "/api/analytics/collect":
            self._collect_analytics()
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_OPTIONS(self):
        if urlparse(self.path).path == "/api/analytics/collect":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Allow", "POST, OPTIONS")
            self.end_headers()
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def _collect_analytics(self):
        origin = self.headers.get("Origin", "")
        if self.server.allowed_origin and origin != self.server.allowed_origin:
            self._send_json(HTTPStatus.FORBIDDEN, {"error": "origin not allowed"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            self._send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "invalid body size"})
            return
        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            forwarded = self.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
            client_ip = forwarded or self.client_address[0]
            counted = self.server.analytics_store.collect(
                payload,
                client_ip,
                self.headers.get("User-Agent", ""),
            )
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid analytics payload"})
            return
        self._send_json(HTTPStatus.ACCEPTED, {"accepted": counted})

    def _serve_dashboard(self, request_path):
        dashboard_dir = self.server.dashboard_dir
        if not dashboard_dir:
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "dashboard not installed"})
            return
        relative = "index.html" if request_path in {"/analytics", "/analytics/"} else request_path[11:]
        candidate = (dashboard_dir / relative).resolve()
        try:
            candidate.relative_to(dashboard_dir.resolve())
        except ValueError:
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        if not candidate.is_file():
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        body = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def read_secret(secret_file):
    path = Path(secret_file)
    if path.exists():
        return path.read_bytes().strip()
    return os.environ.get("VISITOR_ANALYTICS_SECRET", "development-only-secret").encode("utf-8")


def create_server(
    host,
    port,
    data_file,
    analytics_data_file=None,
    analytics_secret=b"test-secret",
    dashboard_dir=None,
    allowed_origin="",
):
    server = ThreadingHTTPServer((host, port), VisitorCounterHandler)
    server.counter_store = JsonCounterStore(data_file)
    analytics_file = analytics_data_file or Path(data_file).with_name("analytics.sqlite3")
    server.analytics_store = AnalyticsStore(analytics_file, analytics_secret)
    server.dashboard_dir = Path(dashboard_dir) if dashboard_dir else None
    server.allowed_origin = allowed_origin
    return server


def main():
    host = os.environ.get("VISITOR_COUNTER_HOST", "127.0.0.1")
    port = int(os.environ.get("VISITOR_COUNTER_PORT", "3011"))
    data_file = os.environ.get(
        "VISITOR_COUNTER_DATA_FILE",
        "/opt/blog-stack/services/visitor-counter/data/visitor-count.json",
    )
    analytics_data_file = os.environ.get(
        "VISITOR_ANALYTICS_DATA_FILE",
        "/opt/blog-stack/services/visitor-counter/data/analytics.sqlite3",
    )
    secret_file = os.environ.get("VISITOR_ANALYTICS_SECRET_FILE", "/etc/woodfish/analytics-secret")
    dashboard_dir = os.environ.get(
        "VISITOR_ANALYTICS_DASHBOARD_DIR",
        "/opt/blog-stack/services/visitor-counter/dashboard",
    )
    allowed_origin = os.environ.get("VISITOR_ANALYTICS_ALLOWED_ORIGIN", "")
    server = create_server(
        host,
        port,
        data_file,
        analytics_data_file,
        read_secret(secret_file),
        dashboard_dir,
        allowed_origin,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
