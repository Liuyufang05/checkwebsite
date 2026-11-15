"""Server-side request forgery (SSRF) protection.

Every outbound request made on behalf of a user goes through these checks:

1. Only ``http``/``https`` schemes, no credentials in the URL, sane length.
2. The hostname is resolved and *every* resolved address must be public
   (no private, loopback, link-local, multicast, reserved, CGNAT, or IPv4-mapped
   private IPv6). Cloud metadata endpoints are therefore unreachable.
3. The check is repeated for every redirect hop (the fetcher follows
   redirects manually) and for every sub-request the headless browser makes.
4. The connection is pinned to the vetted IP to defeat DNS-rebinding between
   the check and the connect (see ``fetcher.py``).
"""

from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {None, 80, 443, 8080, 8443}
MAX_URL_LENGTH = 2048
BLOCKED_HOSTNAMES = {"localhost", "localhost.localdomain", "metadata.google.internal", "metadata", "instance-data"}
_CGNAT = ipaddress.ip_network("100.64.0.0/10")


class UnsafeURLError(ValueError):
    """Raised when a URL is not allowed to be fetched."""


@dataclass(frozen=True)
class SafeTarget:
    url: str
    scheme: str
    host: str
    port: int
    ips: tuple[str, ...]


def is_public_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    if isinstance(addr, ipaddress.IPv6Address) and addr.sixtofour:
        addr = addr.sixtofour
    return not (
        addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_multicast
        or addr.is_reserved or addr.is_unspecified or (addr.version == 4 and addr in _CGNAT)
        or not addr.is_global
    )


def normalize_user_url(raw: str) -> str:
    """Trim, add a default scheme and reject obviously bad input."""
    url = (raw or "").strip()
    if not url:
        raise UnsafeURLError("Please enter a URL.")
    if len(url) > MAX_URL_LENGTH:
        raise UnsafeURLError("URL is too long (max 2048 characters).")
    if any(c in url for c in ("\n", "\r", "\t", " ")):
        raise UnsafeURLError("URL must not contain whitespace.")
    if "://" not in url:
        url = "http://" + url
    parts = urlsplit(url)
    if parts.scheme.lower() not in ALLOWED_SCHEMES:
        raise UnsafeURLError("Only http:// and https:// URLs can be scanned.")
    if not parts.hostname:
        raise UnsafeURLError("URL has no hostname.")
    return urlunsplit((parts.scheme.lower(), parts.netloc, parts.path, parts.query, ""))


def resolve(host: str, port: int) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise UnsafeURLError(f"Could not resolve host '{host}'.") from exc
    return sorted({info[4][0] for info in infos})


def check_url(url: str, *, allow_private: bool = False, resolver=resolve) -> SafeTarget:
    """Validate scheme/host/port and resolve DNS; raise UnsafeURLError if unsafe."""
    parts = urlsplit(url)
    scheme = (parts.scheme or "").lower()
    if scheme not in ALLOWED_SCHEMES:
        raise UnsafeURLError("Only http:// and https:// URLs can be scanned.")
    if parts.username or parts.password:
        raise UnsafeURLError("URLs with embedded credentials are not allowed.")
    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise UnsafeURLError("URL has no hostname.")
    try:
        port = parts.port
    except ValueError as exc:
        raise UnsafeURLError("Invalid port.") from exc
    if port not in ALLOWED_PORTS and not allow_private:
        raise UnsafeURLError(f"Port {port} is not allowed (80, 443, 8080, 8443 only).")
    if not allow_private and (host in BLOCKED_HOSTNAMES or host.endswith((".local", ".internal", ".localhost"))):
        raise UnsafeURLError("Internal hostnames are not allowed.")
    port = port or (443 if scheme == "https" else 80)

    try:
        literal = ipaddress.ip_address(host)
        ips = [str(literal)]
    except ValueError:
        ips = resolver(host, port)
    if not ips:
        raise UnsafeURLError(f"Could not resolve host '{host}'.")
    if not allow_private:
        bad = [ip for ip in ips if not is_public_ip(ip)]
        if bad:
            raise UnsafeURLError("This URL resolves to a private or reserved network address and was blocked.")
    return SafeTarget(url=url, scheme=scheme, host=host, port=port, ips=tuple(ips))
