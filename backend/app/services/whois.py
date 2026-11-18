"""Domain age via RDAP (no API key) with a python-whois fallback."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx

RDAP_BOOTSTRAP = "https://rdap.org/domain/{domain}"


def _parse_date(v) -> datetime | None:
    if isinstance(v, list):
        v = [x for x in v if x]
        v = min(v) if v else None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%d"):
            try:
                d = datetime.strptime(v, fmt)
                return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        try:
            d = datetime.fromisoformat(v.replace("Z", "+00:00"))
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _result(domain, created, expires, registrar, source) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "available": created is not None,
        "domain": domain,
        "created": created.isoformat() if created else None,
        "expires": expires.isoformat() if expires else None,
        "age_days": (now - created).days if created else None,
        "registrar": registrar,
        "source": source,
    }


async def rdap_lookup(domain: str, timeout: float, transport=None) -> dict | None:
    kw = {"timeout": timeout, "follow_redirects": True, "headers": {"Accept": "application/rdap+json"}}
    if transport:
        kw["transport"] = transport
    async with httpx.AsyncClient(**kw) as client:
        r = await client.get(RDAP_BOOTSTRAP.format(domain=domain))
        if r.status_code != 200:
            return None
        data = r.json()
    created = expires = None
    for ev in data.get("events", []):
        action = ev.get("eventAction", "")
        if action == "registration":
            created = _parse_date(ev.get("eventDate"))
        elif action == "expiration":
            expires = _parse_date(ev.get("eventDate"))
    registrar = None
    for ent in data.get("entities", []):
        if "registrar" in ent.get("roles", []):
            vcard = ent.get("vcardArray", [None, []])[1]
            for item in vcard:
                if item and item[0] == "fn":
                    registrar = item[3]
    return _result(domain, created, expires, registrar, "rdap")


def _whois_sync(domain: str) -> dict | None:
    import whois  # python-whois

    w = whois.whois(domain)
    created = _parse_date(w.get("creation_date"))
    expires = _parse_date(w.get("expiration_date"))
    reg = w.get("registrar")
    return _result(domain, created, expires, reg if isinstance(reg, str) else None, "whois")


async def domain_age(domain: str, timeout: float = 6.0, transport=None) -> dict:
    if not domain or "." not in domain:
        return {"available": False, "domain": domain, "error": "Không có tên miền có thể đăng ký (địa chỉ IP hoặc tên nội bộ)."}
    try:
        r = await asyncio.wait_for(rdap_lookup(domain, timeout, transport), timeout + 1)
        if r and r["available"]:
            return r
    except Exception:  # noqa: BLE001 - fall back to WHOIS
        pass
    if transport is not None:  # tests: no real WHOIS
        return {"available": False, "domain": domain, "error": "RDAP không trả về ngày đăng ký."}
    try:
        r = await asyncio.wait_for(asyncio.to_thread(_whois_sync, domain), timeout)
        if r:
            return r
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "domain": domain, "error": f"Tra cứu WHOIS thất bại: {type(exc).__name__}"}
    return {"available": False, "domain": domain, "error": "Không tìm thấy ngày đăng ký."}
