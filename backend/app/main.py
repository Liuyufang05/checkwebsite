"""PhishGuard API - FastAPI application."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from .config import Settings, get_settings
from .db import History
from .security.ssrf import UnsafeURLError
from .services.browser import Browser
from .services.intel import Intel
from .services.limits import RateLimiter
from .services.model import ModelRegistry
from .services.scanner import ModelNotReady, Scanner

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("phishguard")
STARTED = time.time()
_ID_RE = re.compile(r"^[0-9a-f]{32}$")
_UUID_RE = re.compile(r"^[0-9a-f\-]{36}$")


class ScanRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048, examples=["https://example.com/login"])
    use_cache: bool = True


def _cleanup_screenshots(folder: Path, keep: int = 300) -> None:
    files = sorted(folder.glob("*.jpg"), key=lambda p: p.stat().st_mtime, reverse=True)
    for f in files[keep:]:
        f.unlink(missing_ok=True)


def create_app(settings: Settings | None = None, scanner: Scanner | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if scanner is None:
            registry = ModelRegistry(settings.models_dir, explanations_enabled=settings.explanations_enabled)
            registry.load()
            history = History(settings.data_dir / "history.sqlite3")
            browser = Browser(settings)
            app.state.scanner = Scanner(settings, registry, history, browser)
        else:
            app.state.scanner = scanner
        _cleanup_screenshots(settings.data_dir / "screenshots")
        if scanner is None:
            asyncio.get_running_loop().run_in_executor(None, app.state.scanner.registry.warmup)
        for w in app.state.scanner.registry.warnings:
            log.warning(w)
        yield
        await app.state.scanner.browser.close()

    app = FastAPI(
        title="PhishGuard - Phishing Website Detection API",
        version="1.0.0",
        description="Comparative ML framework for robust phishing website detection. "
        "POST a URL to /api/scan to get a verdict, probability, explanations and live evidence.",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=False,
        allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
    )
    limiter = RateLimiter(settings.rate_limit_per_minute)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "no-referrer"
        return resp

    def client_ip(request: Request) -> str:
        if settings.trust_proxy_headers:
            fwd = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            if fwd:
                return fwd
        return request.client.host if request.client else "unknown"

    def sc(request: Request) -> Scanner:
        return request.app.state.scanner

    def read_report(name: str) -> dict:
        path = settings.reports_dir / name
        if not path.exists():
            raise HTTPException(404, f"{name} not found - run the training pipeline first (scripts/train.ps1).")
        return json.loads(path.read_text(encoding="utf-8"))

    # ------------------------------------------------------------------ routes
    @app.get("/api/health", tags=["meta"])
    async def health(request: Request):
        s = sc(request)
        return {
            "status": "ok" if s.registry.ready else "degraded",
            "uptime_s": int(time.time() - STARTED),
            "model": s.registry.info(),
            "browser": {"available": s.browser.available, "error": s.browser.error, "enabled": settings.screenshot_enabled},
            "intel": s.intel.configured(),
            "history": s.history.stats(),
        }

    @app.post("/api/scan", tags=["scan"])
    async def scan(body: ScanRequest, request: Request):
        allowed, retry = limiter.check(client_ip(request))
        if not allowed:
            return JSONResponse(
                {"detail": f"Rate limit exceeded ({settings.rate_limit_per_minute} scans/minute). Try again in {retry}s.", "code": "rate_limited"},
                status_code=429, headers={"Retry-After": str(retry)},
            )
        try:
            return await sc(request).scan(body.url, use_cache=body.use_cache)
        except UnsafeURLError as exc:
            return JSONResponse({"detail": str(exc), "code": "invalid_url"}, status_code=400)
        except ModelNotReady as exc:
            return JSONResponse({"detail": f"Model not ready: {exc}", "code": "model_not_ready"}, status_code=503)

    @app.get("/api/models", tags=["models"])
    async def models():
        return read_report("results.json")

    @app.get("/api/eda", tags=["models"])
    async def eda():
        return read_report("eda.json")

    @app.get("/api/history", tags=["scan"])
    async def history(request: Request, limit: int = Query(20, ge=1, le=200)):
        return {"items": sc(request).history.recent(limit)}

    @app.get("/api/history/{scan_id}", tags=["scan"])
    async def history_item(scan_id: str, request: Request):
        if not _ID_RE.match(scan_id):
            raise HTTPException(400, "Invalid scan id.")
        item = sc(request).history.get(scan_id)
        if not item:
            raise HTTPException(404, "Scan not found.")
        return item

    @app.get("/api/intel/urlscan/{scan_uuid}", tags=["scan"])
    async def urlscan_result(scan_uuid: str, request: Request):
        if not _UUID_RE.match(scan_uuid):
            raise HTTPException(400, "Invalid urlscan uuid.")
        return await sc(request).intel.urlscan_result(scan_uuid)

    @app.get("/api/screenshots/{name}", tags=["scan"])
    async def screenshot(name: str):
        if not name.endswith(".jpg") or not _ID_RE.match(name[:-4]):
            raise HTTPException(400, "Invalid screenshot name.")
        path = settings.data_dir / "screenshots" / name
        if not path.exists():
            raise HTTPException(404, "Screenshot not found.")
        return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})

    @app.get("/api/figures/{name}", tags=["models"])
    async def figure(name: str):
        if not re.fullmatch(r"[a-z0-9_]+\.png", name):
            raise HTTPException(400, "Invalid figure name.")
        path = settings.reports_dir / "figures" / name
        if not path.exists():
            raise HTTPException(404, "Figure not found.")
        return FileResponse(path, media_type="image/png")

    return app


app = create_app()
