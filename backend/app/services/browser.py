"""Headless Chromium (Playwright) for screenshots and JS-rendered HTML.

Hardening:
* every request the page makes (documents, scripts, images, XHR, redirects)
  passes through a route handler that applies the SSRF guard;
* downloads are refused, service workers blocked, permissions denied,
  ``file://`` and other non-web schemes aborted;
* a fresh incognito context per scan, closed afterwards;
* hard navigation timeout and concurrency limit;
* in Docker the browser runs as a non-root user in a container with no host
  mounts (models are mounted read-only).
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from ..config import Settings
from ..security.ssrf import UnsafeURLError, check_url

log = logging.getLogger("phishguard.browser")


class Browser:
    def __init__(self, settings: Settings):
        self.s = settings
        self._pw = None
        self._browser = None
        self._lock = asyncio.Lock()
        self._sem = asyncio.Semaphore(2)
        self.available: bool | None = None
        self.error: str | None = None

    async def _ensure(self):
        async with self._lock:
            if self._browser is not None and self._browser.is_connected():
                return self._browser
            try:
                from playwright.async_api import async_playwright

                self._pw = await async_playwright().start()
                self._browser = await self._pw.chromium.launch(
                    headless=True,
                    chromium_sandbox=self.s.browser_sandbox,
                    args=[
                        "--disable-dev-shm-usage", "--disable-extensions", "--disable-background-networking",
                        "--disable-sync", "--disable-default-apps", "--no-first-run", "--mute-audio",
                        "--disable-features=DownloadBubble,DownloadBubbleV2",
                    ],
                )
                self.available = True
                self.error = None
            except Exception as exc:  # noqa: BLE001
                self.available = False
                self.error = f"{type(exc).__name__}: {exc}"[:300]
                log.warning("Playwright unavailable: %s", self.error)
                return None
            return self._browser

    async def close(self):
        try:
            if self._browser:
                await self._browser.close()
            if self._pw:
                await self._pw.stop()
        except Exception:  # noqa: BLE001
            pass

    async def _guard(self, route):
        url = route.request.url
        if url.startswith(("data:", "blob:", "about:")):
            return await route.continue_()
        try:
            await asyncio.to_thread(check_url, url, allow_private=self.s.allow_private_targets)
        except UnsafeURLError:
            self._blocked += 1
            return await route.abort("blockedbyclient")
        except Exception:  # noqa: BLE001
            return await route.abort("failed")
        return await route.continue_()

    async def capture(self, url: str, out_path: Path) -> dict:
        if not self.s.screenshot_enabled:
            return {"ok": False, "error": "Screenshots disabled."}
        browser = await self._ensure()
        if browser is None:
            return {"ok": False, "error": "Headless browser not available on this machine (it is included in the Docker image)."}
        async with self._sem:
            self._blocked = 0
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 800}, user_agent=self.s.user_agent, accept_downloads=False,
                service_workers="block", java_script_enabled=True, ignore_https_errors=True, bypass_csp=False,
                permissions=[],
            )
            try:
                await ctx.route("**/*", self._guard)
                page = await ctx.new_page()
                page.on("download", lambda d: asyncio.ensure_future(d.cancel()))
                page.on("dialog", lambda d: asyncio.ensure_future(d.dismiss()))
                timeout = int(self.s.screenshot_timeout_s * 1000)
                resp = None
                try:
                    resp = await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
                    try:
                        await page.wait_for_load_state("networkidle", timeout=3500)
                    except Exception:  # noqa: BLE001
                        pass
                except Exception as exc:  # noqa: BLE001
                    if page.url in ("about:blank", ""):
                        return {"ok": False, "error": f"Navigation failed: {type(exc).__name__}", "blocked_requests": self._blocked}
                await page.screenshot(path=str(out_path), type="jpeg", quality=70, full_page=False, timeout=timeout)
                html = await page.content()
                return {
                    "ok": True, "final_url": page.url, "title": (await page.title())[:200],
                    "status": resp.status if resp else None, "html": html, "blocked_requests": self._blocked,
                }
            except Exception as exc:  # noqa: BLE001
                return {"ok": False, "error": f"Screenshot failed: {type(exc).__name__}", "blocked_requests": self._blocked}
            finally:
                await ctx.close()
