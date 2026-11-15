import json

import httpx

from app.config import Settings
from app.services.decision import decide
from app.services.intel import Intel


def _intel(handler, **keys):
    return Intel(Settings(_env_file=None, **keys), transport=httpx.MockTransport(handler))


async def test_not_configured():
    i = Intel(Settings(_env_file=None, google_safe_browsing_api_key="", virustotal_api_key="", urlscan_api_key=""))
    assert (await i.safe_browsing(["http://x.com"]))["status"] == "not_configured"
    assert (await i.virustotal("http://x.com"))["status"] == "not_configured"
    assert (await i.urlscan_submit("http://x.com"))["status"] == "not_configured"
    assert i.configured() == {"google_safe_browsing": False, "virustotal": False, "urlscan": False}


async def test_safe_browsing_match():
    def h(req):
        assert req.url.params["key"] == "k"
        body = json.loads(req.content)
        assert body["threatInfo"]["threatEntries"][0]["url"] == "http://bad.com/"
        return httpx.Response(200, json={"matches": [{"threatType": "SOCIAL_ENGINEERING"}]})

    r = await _intel(h, google_safe_browsing_api_key="k").safe_browsing(["http://bad.com/"])
    assert r == {"status": "ok", "flagged": True, "threats": ["SOCIAL_ENGINEERING"]}


async def test_safe_browsing_clean_and_errors():
    r = await _intel(lambda q: httpx.Response(200, json={}), google_safe_browsing_api_key="k").safe_browsing(["http://a.com"])
    assert r["flagged"] is False
    r = await _intel(lambda q: httpx.Response(429), google_safe_browsing_api_key="k").safe_browsing(["http://a.com"])
    assert r["status"] == "rate_limited"
    r = await _intel(lambda q: httpx.Response(400, text="API key not valid"), google_safe_browsing_api_key="k").safe_browsing(["http://a.com"])
    assert r["status"] == "error" and "400" in r["error"]


async def test_virustotal_known():
    def h(req):
        assert req.headers["x-apikey"] == "vt"
        assert req.url.path.endswith(Intel.vt_id("http://bad.com/"))
        return httpx.Response(200, json={"data": {"attributes": {
            "last_analysis_stats": {"malicious": 7, "suspicious": 1, "harmless": 60, "undetected": 20, "timeout": 0},
            "reputation": -12, "categories": {"a": "phishing"}}}})

    r = await _intel(h, virustotal_api_key="vt").virustotal("http://bad.com/")
    assert r["status"] == "ok" and r["malicious"] == 7 and r["engines"] == 88 and r["categories"] == ["phishing"]


async def test_virustotal_unknown_submits():
    calls = []

    def h(req):
        calls.append(req.method)
        if req.method == "GET":
            return httpx.Response(404, json={"error": {"code": "NotFoundError"}})
        return httpx.Response(200, json={"data": {"id": "u-123"}})

    r = await _intel(h, virustotal_api_key="vt").virustotal("http://new.com/")
    assert r["status"] == "pending" and calls == ["GET", "POST"]


async def test_urlscan_submit_and_result():
    def h(req):
        assert req.headers["API-Key"] == "us"
        if req.method == "POST":
            assert json.loads(req.content)["visibility"] == "unlisted"
            return httpx.Response(200, json={"uuid": "0e5a0c3c-1111-2222-3333-444455556666", "result": "https://urlscan.io/result/x/"})
        return httpx.Response(200, json={"verdicts": {"overall": {"malicious": True, "score": 100, "categories": ["phishing"],
                                                                  "brands": [{"name": "PayPal"}]}}, "page": {"ip": "1.2.3.4", "country": "US"}})

    i = _intel(h, urlscan_api_key="us")
    s = await i.urlscan_submit("http://x.com")
    assert s["status"] == "pending" and s["uuid"].startswith("0e5a")
    r = await i.urlscan_result(s["uuid"])
    assert r["status"] == "ok" and r["malicious"] and r["brands"] == ["PayPal"]


BASE = dict(reputable=False, free_hosting=False, whois={"available": False}, tls={"available": True, "verified": True, "issuer": "CA"},
            scheme="https", redirect_cross_domain=False, meta_refresh=False, html_feats=None, brand_outside_domain=False,
            fetch_error=None, gsb={"status": "not_configured"}, vt={"status": "not_configured"})


def test_decision_thresholds():
    assert decide(p_url=0.05, p_content=None, **BASE)["verdict"] == "legitimate"
    assert decide(p_url=0.6, p_content=None, **BASE)["verdict"] == "suspicious"
    assert decide(p_url=0.97, p_content=0.9, **BASE)["verdict"] == "phishing"


def test_safe_browsing_overrides():
    d = decide(p_url=0.02, p_content=0.01, **{**BASE, "gsb": {"status": "ok", "flagged": True, "threats": ["SOCIAL_ENGINEERING"]}})
    assert d["verdict"] == "phishing" and any(s["id"] == "gsb" for s in d["signals"])


def test_reputation_and_age_dampen():
    risky = decide(p_url=0.8, p_content=None, **BASE)
    calm = decide(p_url=0.8, p_content=None, **{**BASE, "reputable": True, "whois": {"available": True, "age_days": 9000}})
    assert calm["probability_phishing"] < risky["probability_phishing"]
    assert calm["verdict"] == "legitimate"


def test_new_domain_and_bad_cert_raise_risk():
    base = decide(p_url=0.3, p_content=None, **BASE)
    worse = decide(p_url=0.3, p_content=None, **{**BASE, "whois": {"available": True, "age_days": 3},
                                                  "tls": {"available": True, "verified": False, "verify_error": "self-signed"}})
    assert worse["probability_phishing"] > base["probability_phishing"]
    assert {s["id"] for s in worse["signals"]} >= {"domain_age", "tls"}


def test_credential_exfil_signal():
    d = decide(p_url=0.3, p_content=0.5, **{**BASE, "html_feats": {"HasPasswordField": 1, "HasExternalFormSubmit": 1}})
    assert any(s["id"] == "cred_exfil" and s["impact"] > 0 for s in d["signals"])
