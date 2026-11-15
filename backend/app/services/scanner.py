"""Scan orchestration: validate -> fetch + intel in parallel -> features ->
models -> decision layer -> screenshot -> persist."""

from __future__ import annotations

import asyncio
import time
import uuid
from datetime import datetime, timezone

from ..config import Settings
from ..db import History
from ..features import extract_html_features, extract_url_features, parse
from ..security.ssrf import UnsafeURLError, check_url, normalize_user_url
from .browser import Browser
from .decision import decide
from .fetcher import SafeFetcher
from .intel import Intel
from .limits import TTLCache
from .model import ModelRegistry
from .tls import inspect as tls_inspect
from .whois import domain_age


class ModelNotReady(RuntimeError):
    pass


class Scanner:
    def __init__(self, settings: Settings, registry: ModelRegistry, history: History, browser: Browser,
                 fetcher: SafeFetcher | None = None, intel: Intel | None = None, whois_fn=None, tls_fn=None, resolver=None):
        self.s = settings
        self.registry = registry
        self.history = history
        self.browser = browser
        self.fetcher = fetcher or SafeFetcher(settings)
        self.intel = intel or Intel(settings)
        self.whois_fn = whois_fn or (lambda d: domain_age(d, settings.whois_timeout_s))
        self.tls_fn = tls_fn or (lambda t: tls_inspect(t, settings.connect_timeout_s))
        self.resolver = resolver
        self.cache = TTLCache(settings.cache_ttl_s)

    def _check(self, url: str):
        kw = {"allow_private": self.s.allow_private_targets}
        if self.resolver:
            kw["resolver"] = self.resolver
        return check_url(url, **kw)

    async def scan(self, raw_url: str, use_cache: bool = True) -> dict:
        if not self.registry.ready:
            raise ModelNotReady("; ".join(self.registry.warnings) or "Model not loaded.")
        url = normalize_user_url(raw_url)
        target = await asyncio.to_thread(self._check, url)  # raises UnsafeURLError
        if use_cache and (hit := self.cache.get(url)):
            return {**hit, "cached": True}

        t0 = time.perf_counter()
        timings: dict[str, int] = {}
        scan_id = uuid.uuid4().hex
        p = parse(url)
        reg = p.registered_domain

        async def timed(name, coro):
            s = time.perf_counter()
            try:
                return await coro
            finally:
                timings[name] = int((time.perf_counter() - s) * 1000)

        empty = {"available": False}
        fetch_t = asyncio.create_task(timed("fetch", self.fetcher.fetch(url)))
        tls_t = asyncio.create_task(timed("tls", self.tls_fn(target))) if target.scheme == "https" else None
        whois_t = asyncio.create_task(timed("whois", self.whois_fn(reg)))
        gsb_t = asyncio.create_task(timed("safe_browsing", self.intel.safe_browsing([url])))
        vt_t = asyncio.create_task(timed("virustotal", self.intel.virustotal(url)))
        us_t = asyncio.create_task(timed("urlscan", self.intel.urlscan_submit(url)))

        fetch = await fetch_t
        final_url = fetch.final_url if fetch.ok else url
        shot_path = self.s.data_dir / "screenshots" / f"{scan_id}.jpg"
        robots_t = asyncio.create_task(timed("robots", self.fetcher.robots_exists(final_url))) if fetch.ok else None
        shot_t = asyncio.create_task(timed("screenshot", self.browser.capture(final_url, shot_path)))

        budget = max(5.0, self.s.total_scan_budget_s - (time.perf_counter() - t0))
        pending = [t for t in (tls_t, whois_t, gsb_t, vt_t, us_t, robots_t, shot_t) if t is not None]
        done, not_done = await asyncio.wait(pending, timeout=budget)
        for t in not_done:
            t.cancel()

        def res(task, default):
            if task is None or task not in done or task.cancelled() or task.exception():
                return default
            return task.result()

        tls = res(tls_t, {"available": False, "error": "Plain HTTP (no TLS)." if target.scheme == "http" else "TLS check timed out."})
        whois = res(whois_t, {"available": False, "domain": reg, "error": "Domain-age lookup timed out."})
        gsb = res(gsb_t, {"status": "error", "error": "timeout"})
        vt = res(vt_t, {"status": "error", "error": "timeout"})
        us = res(us_t, {"status": "error", "error": "timeout"})
        robots = res(robots_t, False)
        shot = res(shot_t, {"ok": False, "error": "Screenshot timed out."})

        # ---------------------------------------------------------------- features + models
        url_feats = extract_url_features(url)
        p_url = self.registry.predict("url", url_feats)
        expl_url = self.registry.explain("url", url_feats)
        final_reg = parse(final_url).registered_domain
        cross = bool(final_reg and reg and final_reg != reg)
        p_url_final = None
        if cross:
            p_url_final = self.registry.predict("url", extract_url_features(final_url))
            p_url = max(p_url, p_url_final)

        html, content_source = "", None
        if fetch.html and len(fetch.html) >= 200:
            html, content_source = fetch.html, "static"
        elif shot.get("ok") and shot.get("html"):
            html, content_source = shot["html"], "rendered"
        html_feats, p_content, expl_content = None, None, []
        if html and "content" in self.registry.bundles:
            html_feats = extract_html_features(html, final_url, robots_exists=robots)
            p_content = self.registry.predict("content", html_feats)
            expl_content = self.registry.explain("content", html_feats)

        free_hosting = bool(url_feats["is_free_hosting"])
        decision = decide(
            p_url=p_url, p_content=p_content, reputable=reg in self.registry.reputable, free_hosting=free_hosting,
            whois=whois, tls=tls, scheme=target.scheme, redirect_cross_domain=cross,
            meta_refresh=any(h.kind == "meta-refresh" for h in fetch.chain), html_feats=html_feats,
            brand_outside_domain=bool(url_feats["brand_outside_domain"]),
            fetch_error=fetch.error, gsb=gsb, vt=vt,
        )

        timings["total"] = int((time.perf_counter() - t0) * 1000)
        result = {
            "id": scan_id,
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "url": url,
            "final_url": final_url,
            "host": p.host,
            "domain": reg,
            **decision,
            "explanations": {"url": expl_url, "content": expl_content},
            "features": {"url": url_feats, "content": html_feats, "content_source": content_source},
            "p_url_final": p_url_final,
            "redirect_chain": [h.as_dict() for h in fetch.chain],
            "fetch": {
                "ok": fetch.ok, "status": fetch.status, "content_type": fetch.content_type, "bytes": fetch.bytes_read,
                "truncated": fetch.truncated, "elapsed_ms": fetch.elapsed_ms, "error": fetch.error,
                "server": fetch.server, "tls_verified": fetch.tls_verified, "robots_txt": robots,
            },
            "tls": tls,
            "whois": whois,
            "reputable_domain": reg in self.registry.reputable,
            "intel": {"google_safe_browsing": gsb, "virustotal": vt, "urlscan": us},
            "screenshot_url": f"/api/screenshots/{scan_id}.jpg" if shot.get("ok") else None,
            "screenshot_error": None if shot.get("ok") else shot.get("error"),
            "page_title": shot.get("title"),
            "blocked_subrequests": shot.get("blocked_requests", 0),
            "model": {"version": self.registry.version, **{f"{k}_model": b["name"] for k, b in self.registry.bundles.items()}},
            "timings_ms": timings,
            "cached": False,
        }
        self.cache.set(url, result)
        await asyncio.to_thread(self.history.add, result)
        await asyncio.to_thread(self.history.prune, self.s.history_limit)
        return result


__all__ = ["ModelNotReady", "Scanner", "UnsafeURLError"]
