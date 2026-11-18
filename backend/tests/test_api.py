import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import History
from app.main import create_app
from app.services.fetcher import SafeFetcher
from app.services.intel import Intel
from app.services.model import ModelRegistry
from app.services.scanner import Scanner


class StubBrowser:
    available = False
    error = "stub"

    async def capture(self, url, out_path):
        out_path.write_bytes(b"\xff\xd8\xff\xd9")  # minimal JPEG markers
        return {"ok": True, "final_url": url, "title": "Stub page", "html": "", "blocked_requests": 0}

    async def close(self):
        pass


async def fake_whois(domain):
    return {"available": True, "domain": domain, "age_days": 4 if "paypal" in domain else 8000, "created": None, "source": "test"}


async def fake_tls(target):
    return {"available": True, "verified": True, "issuer": "Test CA", "expired": False, "self_signed": False}


def gsb_handler(req):
    if "safebrowsing" in str(req.url):
        body = json.loads(req.content)
        flagged = any("paypal" in e["url"] for e in body["threatInfo"]["threatEntries"])
        return httpx.Response(200, json={"matches": [{"threatType": "SOCIAL_ENGINEERING"}]} if flagged else {})
    return httpx.Response(500)


@pytest.fixture
def client(tmp_path, model_dir, site_transport, resolver):
    reports = tmp_path / "reports"
    reports.mkdir()
    (reports / "results.json").write_text(json.dumps({"model_version": "vtest", "feature_sets": {}}))
    s = Settings(
        _env_file=None, models_dir=model_dir, reports_dir=reports, data_dir=tmp_path / "data",
        rate_limit_per_minute=5, google_safe_browsing_api_key="k", virustotal_api_key="", urlscan_api_key="",
    )
    (s.data_dir / "screenshots").mkdir(parents=True)
    reg = ModelRegistry(model_dir)
    reg.load()
    reg.reputable = frozenset({"example.com"})
    scanner = Scanner(
        s, reg, History(s.data_dir / "h.sqlite3"), StubBrowser(),
        fetcher=SafeFetcher(s, transport=site_transport, resolver=resolver),
        intel=Intel(s, transport=httpx.MockTransport(gsb_handler)),
        whois_fn=fake_whois, tls_fn=fake_tls, resolver=resolver,
    )
    with TestClient(create_app(s, scanner)) as c:
        yield c


def test_health(client):
    r = client.get("/api/health").json()
    assert r["status"] == "ok"
    assert r["model"]["version"] == "vtest"
    assert r["intel"] == {"google_safe_browsing": True, "virustotal": False, "urlscan": False}


def test_scan_legit(client):
    r = client.post("/api/scan", json={"url": "https://example.com/"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["verdict"] in {"legitimate", "suspicious", "phishing"}
    assert 0 <= d["probability_phishing"] <= 1 and 0 <= d["risk_score"] <= 100
    assert d["reputable_domain"] is True and d["verdict"] == "legitimate"
    assert d["features"]["content_source"] == "static"
    assert d["features"]["content"]["HasTitle"] == 1
    assert d["redirect_chain"][0]["status"] == 200
    assert d["intel"]["virustotal"]["status"] == "not_configured"
    assert d["intel"]["google_safe_browsing"]["flagged"] is False
    assert d["screenshot_url"].startswith("/api/screenshots/")
    assert isinstance(d["explanations"]["url"], list)
    shot = client.get(d["screenshot_url"])
    assert shot.status_code == 200 and shot.headers["content-type"] == "image/jpeg"


def test_scan_phishing_signals(client):
    d = client.post("/api/scan", json={"url": "https://login-paypal-secure.example.com/login"}).json()
    ids = {s["id"] for s in d["signals"]}
    assert d["verdict"] == "phishing"
    assert "gsb" in ids and "domain_age" in ids and "cred_exfil" in ids
    assert d["features"]["content"]["HasPasswordField"] == 1


def test_scan_rejects_unsafe(client):
    for url in ["http://127.0.0.1/", "http://169.254.169.254/latest", "ftp://example.com", "http://internal.example.net/", ""]:
        r = client.post("/api/scan", json={"url": url})
        assert r.status_code in (400, 422), url
    r = client.post("/api/scan", json={"url": "http://10.0.0.1/"})
    assert r.json()["code"] == "invalid_url"


def test_cache_history_and_rate_limit(client):
    first = client.post("/api/scan", json={"url": "https://example.com/"}).json()
    second = client.post("/api/scan", json={"url": "https://example.com/"}).json()
    assert second["cached"] is True and second["id"] == first["id"]
    items = client.get("/api/history").json()["items"]
    assert items and items[0]["url"] == "https://example.com/"
    assert client.get(f"/api/history/{first['id']}").json()["id"] == first["id"]
    assert client.get("/api/history/" + "0" * 32).status_code == 404
    codes = [client.post("/api/scan", json={"url": "https://example.com/"}).status_code for _ in range(6)]
    assert 429 in codes


def test_models_and_bad_paths(client):
    assert client.get("/api/models").json()["model_version"] == "vtest"
    assert client.get("/api/eda").status_code == 404
    assert client.get("/api/screenshots/../../etc/passwd").status_code in (400, 404)
    assert client.get("/api/screenshots/nothex.jpg").status_code == 400
    assert client.get("/api/intel/urlscan/not-a-uuid").status_code == 400
    assert client.get("/api/figures/..%2Fsecret.png").status_code in (400, 404)


def test_model_not_ready(tmp_path, resolver):
    s = Settings(_env_file=None, models_dir=tmp_path / "none", data_dir=tmp_path / "d", reports_dir=tmp_path)
    (s.data_dir / "screenshots").mkdir(parents=True)
    reg = ModelRegistry(s.models_dir)
    reg.load()
    sc = Scanner(s, reg, History(s.data_dir / "h.db"), StubBrowser(), resolver=resolver)
    with TestClient(create_app(s, sc)) as c:
        assert c.get("/api/health").json()["status"] == "degraded"
        r = c.post("/api/scan", json={"url": "https://example.com/"})
        assert r.status_code == 503 and r.json()["code"] == "model_not_ready"


def test_model_explanations_can_be_disabled(model_dir):
    registry = ModelRegistry(model_dir, explanations_enabled=False)
    registry.load()
    registry.warmup()

    features = {name: 0.0 for name in registry.bundles["url"]["features"]}
    assert registry.explain("url", features) == []
    assert registry._explainers == {}
