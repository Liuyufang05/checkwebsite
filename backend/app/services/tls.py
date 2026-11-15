"""TLS certificate inspection (connects to the SSRF-vetted IP with SNI)."""

from __future__ import annotations

import asyncio
import socket
import ssl
from datetime import datetime, timezone

from cryptography import x509
from cryptography.x509.oid import ExtensionOID, NameOID

from ..security.ssrf import SafeTarget


def _name(n: x509.Name, oid) -> str | None:
    attrs = n.get_attributes_for_oid(oid)
    return attrs[0].value if attrs else None


def _grab(ip: str, host: str, port: int, timeout: float) -> tuple[bytes | None, str | None, str | None]:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with socket.create_connection((ip, port), timeout=timeout) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as tls:
            return tls.getpeercert(binary_form=True), tls.version(), tls.cipher()[0] if tls.cipher() else None


def _verify(ip: str, host: str, port: int, timeout: float) -> tuple[bool, str | None]:
    ctx = ssl.create_default_context()
    try:
        with socket.create_connection((ip, port), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=host):
                return True, None
    except ssl.SSLCertVerificationError as exc:
        return False, exc.verify_message or str(exc)
    except (ssl.SSLError, OSError) as exc:
        return False, str(exc)[:200]


def inspect_sync(target: SafeTarget, timeout: float = 5.0) -> dict:
    port = target.port if target.scheme == "https" else 443
    ip = target.ips[0]
    try:
        der, proto, cipher = _grab(ip, target.host, port, timeout)
    except (OSError, ssl.SSLError) as exc:
        return {"available": False, "error": f"No TLS on port {port}: {type(exc).__name__}"}
    verified, verify_error = _verify(ip, target.host, port, timeout)
    cert = x509.load_der_x509_certificate(der)
    now = datetime.now(timezone.utc)
    nb, na = cert.not_valid_before_utc, cert.not_valid_after_utc
    try:
        sans = cert.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME).value.get_values_for_type(x509.DNSName)
    except x509.ExtensionNotFound:
        sans = []
    issuer_org = _name(cert.issuer, NameOID.ORGANIZATION_NAME) or _name(cert.issuer, NameOID.COMMON_NAME)
    return {
        "available": True,
        "verified": verified,
        "verify_error": verify_error,
        "protocol": proto,
        "cipher": cipher,
        "subject_cn": _name(cert.subject, NameOID.COMMON_NAME),
        "issuer": issuer_org,
        "self_signed": cert.issuer == cert.subject,
        "not_before": nb.isoformat(),
        "not_after": na.isoformat(),
        "days_remaining": (na - now).days,
        "cert_age_days": (now - nb).days,
        "expired": now > na,
        "san_count": len(sans),
        "sans_sample": sans[:8],
        "free_ca": bool(issuer_org and any(k in issuer_org.lower() for k in ("let's encrypt", "zerossl", "cloudflare", "google trust"))),
    }


async def inspect(target: SafeTarget, timeout: float = 5.0) -> dict:
    try:
        return await asyncio.wait_for(asyncio.to_thread(inspect_sync, target, timeout), timeout * 2 + 1)
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "error": f"TLS inspection failed: {type(exc).__name__}"}
