"""Third-party threat intelligence (all optional).

Every provider returns a dict with a ``status`` of:
``not_configured`` | ``ok`` | ``pending`` | ``rate_limited`` | ``error``.
A missing API key never breaks a scan.

Privacy: VirusTotal submissions and URLScan scans share the URL with that
service. URLScan scans use ``unlisted`` visibility by default.
"""

from __future__ import annotations

import base64
import hashlib

import httpx

from ..config import Settings

GSB_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
VT_BASE = "https://www.virustotal.com/api/v3"
URLSCAN_BASE = "https://urlscan.io/api/v1"


class Intel:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self.s = settings
        self.transport = transport

    def _client(self, **kw) -> httpx.AsyncClient:
        if self.transport is not None:
            kw["transport"] = self.transport
        return httpx.AsyncClient(timeout=self.s.intel_timeout_s, **kw)

    def configured(self) -> dict[str, bool]:
        return {
            "google_safe_browsing": bool(self.s.google_safe_browsing_api_key),
            "virustotal": bool(self.s.virustotal_api_key),
            "urlscan": bool(self.s.urlscan_api_key),
        }

    # ------------------------------------------------------------------ Google Safe Browsing
    async def safe_browsing(self, urls: list[str]) -> dict:
        if not self.s.google_safe_browsing_api_key:
            return {"status": "not_configured"}
        body = {
            "client": {"clientId": "phishguard-detector", "clientVersion": "1.0"},
            "threatInfo": {
                "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": u} for u in dict.fromkeys(urls)],
            },
        }
        try:
            async with self._client() as c:
                r = await c.post(GSB_URL, params={"key": self.s.google_safe_browsing_api_key}, json=body)
            if r.status_code == 429:
                return {"status": "rate_limited"}
            if r.status_code != 200:
                return {"status": "error", "error": f"HTTP {r.status_code}: {r.text[:160]}"}
            matches = r.json().get("matches", [])
            return {
                "status": "ok",
                "flagged": bool(matches),
                "threats": sorted({m.get("threatType", "UNKNOWN") for m in matches}),
            }
        except httpx.HTTPError as exc:
            return {"status": "error", "error": type(exc).__name__}

    # ------------------------------------------------------------------ VirusTotal
    @staticmethod
    def vt_id(url: str) -> str:
        return base64.urlsafe_b64encode(url.encode()).decode().strip("=")

    async def virustotal(self, url: str, submit_if_unknown: bool = True) -> dict:
        if not self.s.virustotal_api_key:
            return {"status": "not_configured"}
        headers = {"x-apikey": self.s.virustotal_api_key, "accept": "application/json"}
        permalink = f"https://www.virustotal.com/gui/url/{hashlib.sha256(url.encode()).hexdigest()}"
        try:
            async with self._client(headers=headers) as c:
                r = await c.get(f"{VT_BASE}/urls/{self.vt_id(url)}")
                if r.status_code == 429:
                    return {"status": "rate_limited", "permalink": permalink}
                if r.status_code == 404:
                    if not submit_if_unknown:
                        return {"status": "ok", "known": False, "permalink": permalink}
                    s = await c.post(f"{VT_BASE}/urls", data={"url": url})
                    if s.status_code == 429:
                        return {"status": "rate_limited", "permalink": permalink}
                    return {"status": "pending", "known": False, "permalink": permalink,
                            "message": "VirusTotal chưa có URL này nên đã gửi yêu cầu quét; kết quả xuất hiện sau khoảng 1 phút."}
                if r.status_code != 200:
                    return {"status": "error", "error": f"HTTP {r.status_code}"}
            attrs = r.json().get("data", {}).get("attributes", {})
            stats = attrs.get("last_analysis_stats", {})
            total = sum(int(v) for v in stats.values()) if stats else 0
            return {
                "status": "ok",
                "known": True,
                "malicious": int(stats.get("malicious", 0)),
                "suspicious": int(stats.get("suspicious", 0)),
                "harmless": int(stats.get("harmless", 0)),
                "undetected": int(stats.get("undetected", 0)),
                "engines": total,
                "reputation": attrs.get("reputation"),
                "last_analysis_date": attrs.get("last_analysis_date"),
                "categories": sorted(set((attrs.get("categories") or {}).values()))[:6],
                "permalink": permalink,
            }
        except httpx.HTTPError as exc:
            return {"status": "error", "error": type(exc).__name__}

    # ------------------------------------------------------------------ URLScan.io
    async def urlscan_submit(self, url: str) -> dict:
        if not self.s.urlscan_api_key:
            return {"status": "not_configured"}
        headers = {"API-Key": self.s.urlscan_api_key, "Content-Type": "application/json"}
        try:
            async with self._client(headers=headers) as c:
                r = await c.post(f"{URLSCAN_BASE}/scan/", json={"url": url, "visibility": self.s.urlscan_visibility})
            if r.status_code == 429:
                return {"status": "rate_limited"}
            if r.status_code not in (200, 201):
                msg = r.json().get("message") if r.headers.get("content-type", "").startswith("application/json") else r.text[:160]
                return {"status": "error", "error": f"HTTP {r.status_code}: {msg}"}
            data = r.json()
            uuid = data.get("uuid")
            return {
                "status": "pending",
                "uuid": uuid,
                "report_url": data.get("result") or f"https://urlscan.io/result/{uuid}/",
                "screenshot_url": f"https://urlscan.io/screenshots/{uuid}.png",
                "message": "Scan queued at urlscan.io; the verdict is usually ready in 10-30 seconds.",
            }
        except httpx.HTTPError as exc:
            return {"status": "error", "error": type(exc).__name__}

    async def urlscan_result(self, uuid: str) -> dict:
        if not self.s.urlscan_api_key:
            return {"status": "not_configured"}
        try:
            async with self._client(headers={"API-Key": self.s.urlscan_api_key}) as c:
                r = await c.get(f"{URLSCAN_BASE}/result/{uuid}/")
            if r.status_code == 404:
                return {"status": "pending", "uuid": uuid}
            if r.status_code != 200:
                return {"status": "error", "error": f"HTTP {r.status_code}"}
            data = r.json()
            overall = data.get("verdicts", {}).get("overall", {})
            page = data.get("page", {})
            return {
                "status": "ok",
                "uuid": uuid,
                "malicious": bool(overall.get("malicious")),
                "score": overall.get("score"),
                "categories": overall.get("categories", []),
                "brands": [b.get("name") for b in overall.get("brands", []) if isinstance(b, dict)][:5],
                "page_ip": page.get("ip"),
                "page_country": page.get("country"),
                "page_server": page.get("server"),
                "report_url": f"https://urlscan.io/result/{uuid}/",
                "screenshot_url": f"https://urlscan.io/screenshots/{uuid}.png",
            }
        except httpx.HTTPError as exc:
            return {"status": "error", "error": type(exc).__name__}
