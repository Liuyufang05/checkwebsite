"""Runtime settings, loaded from environment variables / backend/.env."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    # --- threat intel (all optional) ---
    google_safe_browsing_api_key: str = ""
    virustotal_api_key: str = ""
    urlscan_api_key: str = ""
    urlscan_visibility: str = "unlisted"  # public | unlisted | private

    # --- paths ---
    models_dir: Path = BACKEND_DIR.parent / "ml" / "models"
    reports_dir: Path = BACKEND_DIR.parent / "ml" / "reports"
    data_dir: Path = BACKEND_DIR / "data"

    # --- scanner limits ---
    fetch_timeout_s: float = 10.0
    connect_timeout_s: float = 5.0
    max_redirects: int = 5
    max_response_bytes: int = 3_000_000
    screenshot_enabled: bool = True
    explanations_enabled: bool = True
    screenshot_timeout_s: float = 15.0
    browser_sandbox: bool = False  # set true if the host kernel allows Chromium's sandbox in the container
    whois_timeout_s: float = 6.0
    intel_timeout_s: float = 8.0
    total_scan_budget_s: float = 40.0

    # --- service ---
    cors_origins: str = "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173"
    rate_limit_per_minute: int = 10
    trust_proxy_headers: bool = False  # true behind the bundled nginx (docker-compose)
    cache_ttl_s: int = 900
    history_limit: int = 200
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/130.0 Safari/537.36 PhishGuardScanner/1.0"
    )
    # Testing only: allow private targets (never enable in production).
    allow_private_targets: bool = False

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.data_dir.mkdir(parents=True, exist_ok=True)
    (s.data_dir / "screenshots").mkdir(parents=True, exist_ok=True)
    return s
