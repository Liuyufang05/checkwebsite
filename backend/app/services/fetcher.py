"""Safe HTTP fetcher.

* Follows redirects manually (HTTP 3xx and short <meta refresh>) so that every
  hop is re-validated by the SSRF guard.
* Pins each connection to the IP that passed the SSRF check (prevents DNS
  rebinding) while keeping the original Host header and TLS SNI.
* Streams the body and stops at ``max_response_bytes``; only text/HTML bodies
  are decoded. Nothing is ever written to disk or executed.
"""

from __future__ import annotations

import re
import ssl
import time
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

from ..config import Settings
from ..security.ssrf import SafeTarget, UnsafeURLError, check_url

_META_REFRESH_RE = re.compile(
    r"""<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']?\s*(\d+)\s*;\s*url\s*=\s*['"]?([^"'>\s]+)""",
    re.I,
)
HTML_TYPES = ("text/html", "application/xhtml+xml", "text/plain", "")


@dataclass
class Hop:
    url: str
    status: int | None
    ip: str | None
    kind: str = "http"  # http | meta-refresh

    def as_dict(self) -> dict:
        return {"url": self.url, "status": self.status, "ip": self.ip, "kind": self.kind}


@dataclass
class FetchResult:
    requested_url: str
    final_url: str
    status: int | None = None
    content_type: str = ""
    html: str = ""
    bytes_read: int = 0
    truncated: bool = False
    chain: list[Hop] = field(default_factory=list)
    tls_verified: bool | None = None
    tls_error: str | None = None
    server: str | None = None
    elapsed_ms: int = 0
    error: str | None = None
    blocked: bool = False

    @property
    def ok(self) -> bool:
        return self.error is None and self.status is not None


def _pinned_url(target: SafeTarget, url: str) -> tuple[str, dict, dict]:
    parts = urlsplit(url)
    ip = target.ips[0]
    host_for_url = f"[{ip}]" if ":" in ip else ip
    default = 443 if target.scheme == "https" else 80
    netloc = host_for_url if target.port == default else f"{host_for_url}:{target.port}"
    pinned = urlunsplit((target.scheme, netloc, parts.path or "/", parts.query, ""))
    host_header = target.host if target.port == default else f"{target.host}:{target.port}"
    ext = {"sni_hostname": target.host} if target.scheme == "https" else {}
    return pinned, {"Host": host_header}, ext


class SafeFetcher:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None, resolver=None):
        self.s = settings
        self.transport = transport
        self.resolver = resolver

    def _check(self, url: str) -> SafeTarget:
        kw = {"allow_private": self.s.allow_private_targets}
        if self.resolver:
            kw["resolver"] = self.resolver
        return check_url(url, **kw)

    def _client(self, verify: bool) -> httpx.AsyncClient:
        timeout = httpx.Timeout(self.s.fetch_timeout_s, connect=self.s.connect_timeout_s)
        kw = {"timeout": timeout, "follow_redirects": False, "verify": verify, "trust_env": False}
        if self.transport is not None:
            kw["transport"] = self.transport
        return httpx.AsyncClient(**kw)

    async def _one(self, client: httpx.AsyncClient, target: SafeTarget, url: str):
        pinned, headers, ext = _pinned_url(target, url)
        headers.update({
            "User-Agent": self.s.user_agent,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
            "Accept-Language": "en-US,en;q=0.8",
        })
        req = client.build_request("GET", pinned, headers=headers, extensions=ext)
        resp = await client.send(req, stream=True)
        try:
            ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
            body = bytearray()
            truncated = False
            if resp.status_code < 300 or resp.status_code >= 400:
                if ctype in HTML_TYPES or ctype.startswith("text/"):
                    chunks = resp.aiter_bytes()
                    try:
                        async for chunk in chunks:
                            body.extend(chunk)
                            if len(body) > self.s.max_response_bytes:
                                truncated = True
                                del body[self.s.max_response_bytes:]
                                break
                    finally:
                        await chunks.aclose()
            return resp, ctype, bytes(body), truncated
        finally:
            await resp.aclose()

    async def fetch(self, url: str) -> FetchResult:
        start = time.perf_counter()
        res = FetchResult(requested_url=url, final_url=url)
        verify = True
        current = url
        try:
            async with self._client(True) as strict, self._client(False) as lax:
                for _ in range(self.s.max_redirects + 1):
                    target = self._check(current)
                    client = strict if verify else lax
                    try:
                        resp, ctype, body, truncated = await self._one(client, target, current)
                        if target.scheme == "https" and res.tls_verified is None:
                            res.tls_verified = verify
                    except (httpx.ConnectError, ssl.SSLError) as exc:
                        msg = str(exc)
                        if target.scheme == "https" and verify and ("CERTIFICATE" in msg.upper() or "SSL" in msg.upper()):
                            # Record the TLS problem, then fetch anyway for analysis.
                            res.tls_verified = False
                            res.tls_error = msg[:300]
                            verify = False
                            resp, ctype, body, truncated = await self._one(lax, target, current)
                        else:
                            raise
                    res.chain.append(Hop(current, resp.status_code, target.ips[0]))
                    res.status = resp.status_code
                    res.server = resp.headers.get("server")
                    if resp.status_code in (301, 302, 303, 307, 308) and resp.headers.get("location"):
                        current = urljoin(current, resp.headers["location"])
                        continue
                    res.final_url = current
                    res.content_type = ctype
                    res.bytes_read = len(body)
                    res.truncated = truncated
                    if body:
                        enc = resp.encoding or "utf-8"
                        try:
                            res.html = body.decode(enc, errors="replace")
                        except LookupError:
                            res.html = body.decode("utf-8", errors="replace")
                    m = _META_REFRESH_RE.search(res.html[:20000]) if res.html else None
                    if m and int(m.group(1)) <= 5:
                        nxt = urljoin(current, m.group(2))
                        if nxt != current and urlsplit(nxt).scheme in ("http", "https"):
                            res.chain.append(Hop(nxt, None, None, kind="meta-refresh"))
                            current = nxt
                            res.html = ""
                            continue
                    break
                else:
                    res.error = f"Too many redirects (>{self.s.max_redirects})."
        except UnsafeURLError as exc:
            res.error = str(exc)
            res.blocked = True
        except httpx.TimeoutException:
            res.error = "The site did not respond in time."
        except httpx.HTTPError as exc:
            res.error = f"Could not connect: {type(exc).__name__}"
        except Exception as exc:  # noqa: BLE001
            res.error = f"Fetch failed: {type(exc).__name__}"
        res.elapsed_ms = int((time.perf_counter() - start) * 1000)
        return res

    async def robots_exists(self, url: str) -> bool:
        parts = urlsplit(url)
        robots = urlunsplit((parts.scheme, parts.netloc, "/robots.txt", "", ""))
        try:
            target = self._check(robots)
            async with self._client(False) as client:
                resp, ctype, body, _ = await self._one(client, target, robots)
            return resp.status_code == 200 and bool(body.strip()) and b"<html" not in body[:500].lower()
        except Exception:  # noqa: BLE001
            return False
