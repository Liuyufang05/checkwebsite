"""Tiny in-memory TTL cache and sliding-window rate limiter."""

from __future__ import annotations

import threading
import time
from collections import OrderedDict, deque


class TTLCache:
    def __init__(self, ttl_s: int, max_items: int = 500):
        self.ttl = ttl_s
        self.max = max_items
        self._d: OrderedDict[str, tuple[float, object]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str):
        with self._lock:
            item = self._d.get(key)
            if not item:
                return None
            ts, val = item
            if time.monotonic() - ts > self.ttl:
                self._d.pop(key, None)
                return None
            self._d.move_to_end(key)
            return val

    def set(self, key: str, val) -> None:
        with self._lock:
            self._d[key] = (time.monotonic(), val)
            self._d.move_to_end(key)
            while len(self._d) > self.max:
                self._d.popitem(last=False)


class RateLimiter:
    def __init__(self, per_minute: int):
        self.limit = per_minute
        self._hits: dict[str, deque] = {}
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int]:
        """Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= self.limit:
                return False, int(60 - (now - q[0])) + 1
            q.append(now)
            if len(self._hits) > 10000:
                for k in [k for k, v in self._hits.items() if not v][:5000]:
                    self._hits.pop(k, None)
            return True, 0
