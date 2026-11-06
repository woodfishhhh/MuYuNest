import importlib.util
import json
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
        self.module = load_visitor_counter_module()
        self.server = self.module.create_server("127.0.0.1", 0, self.data_file)
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

    def request_json(self, path, method="GET"):
        request = urllib.request.Request(f"{self.base_url}{path}", method=method)
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
