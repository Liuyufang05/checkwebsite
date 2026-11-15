"""SQLite scan history (thread-safe, WAL mode)."""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    created_utc TEXT NOT NULL,
    url TEXT NOT NULL,
    final_url TEXT,
    domain TEXT,
    verdict TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    p_url REAL,
    p_content REAL,
    has_screenshot INTEGER DEFAULT 0,
    result_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_utc DESC);
"""


class History:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    def add(self, r: dict) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO scans VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (r["id"], r["created_utc"], r["url"], r.get("final_url"), r.get("domain"), r["verdict"],
                 r["risk_score"], r["ml"]["p_url"], r["ml"]["p_content"], int(bool(r.get("screenshot_url"))),
                 json.dumps(r)),
            )
            self._conn.commit()

    def recent(self, limit: int = 20) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT id, created_utc, url, final_url, domain, verdict, risk_score, p_url, p_content, has_screenshot "
                "FROM scans ORDER BY created_utc DESC LIMIT ?", (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get(self, scan_id: str) -> dict | None:
        with self._lock:
            row = self._conn.execute("SELECT result_json FROM scans WHERE id=?", (scan_id,)).fetchone()
        return json.loads(row["result_json"]) if row else None

    def stats(self) -> dict:
        with self._lock:
            rows = self._conn.execute("SELECT verdict, COUNT(*) c FROM scans GROUP BY verdict").fetchall()
        return {r["verdict"]: r["c"] for r in rows}

    def prune(self, keep: int) -> None:
        with self._lock:
            self._conn.execute(
                "DELETE FROM scans WHERE id NOT IN (SELECT id FROM scans ORDER BY created_utc DESC LIMIT ?)", (keep,)
            )
            self._conn.commit()
