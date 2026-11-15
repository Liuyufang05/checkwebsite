import pytest

from app.config import Settings
from app.security.ssrf import UnsafeURLError, check_url, is_public_ip, normalize_user_url
from app.services.fetcher import SafeFetcher


@pytest.mark.parametrize("ip", [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1",
    "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "224.0.0.1", "203.0.113.5", "255.255.255.255",
])
def test_private_and_reserved_ips_are_not_public(ip):
    assert not is_public_ip(ip)


@pytest.mark.parametrize("ip", ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])
def test_public_ips(ip):
    assert is_public_ip(ip)


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/", "http://localhost:8000/", "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/", "http://10.0.0.1/", "http://metadata.google.internal/", "http://printer.local/",
    "http://internal.example.net/", "http://rebind.example.org/", "http://evil.test/",
    "ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)", "http://user:pass@example.com/",
    "http://example.com:22/", "http://unknown-host.invalid/",
])
def test_check_url_blocks(url, resolver):
    with pytest.raises(UnsafeURLError):
        check_url(url, resolver=resolver)


def test_check_url_allows_public(resolver):
    t = check_url("https://example.com/path", resolver=resolver)
    assert t.ips == ("93.184.216.34",) and t.port == 443 and t.host == "example.com"


def test_normalize_user_url():
    assert normalize_user_url("  example.com/x ") == "http://example.com/x"
    assert normalize_user_url("HTTPS://Example.com/a#frag") == "https://Example.com/a"
    for bad in ["", "ftp://x.com", "http:// space.com", "a" * 3000, "http:///nohost"]:
        with pytest.raises(UnsafeURLError):
            normalize_user_url(bad)


def _fetcher(transport, resolver, **kw):
    s = Settings(_env_file=None, max_response_bytes=10_000, **kw)
    return SafeFetcher(s, transport=transport, resolver=resolver)


async def test_fetch_ok_and_pinning(site_transport, resolver):
    seen = []

    import httpx

    def handler(req):
        seen.append((str(req.url), req.headers.get("host")))
        return site_transport.handler(req)

    f = _fetcher(httpx.MockTransport(handler), resolver)
    r = await f.fetch("http://example.com/")
    assert r.ok and r.status == 200 and "<title>Example</title>" in r.html
    # connection pinned to the vetted IP, original Host header preserved
    assert seen[0] == ("http://93.184.216.34/", "example.com")


async def test_redirect_to_private_is_blocked(site_transport, resolver):
    r = await _fetcher(site_transport, resolver).fetch("http://example.com/redirect-internal")
    assert r.blocked and "private" in r.error
    assert r.chain[0].status == 302


async def test_redirect_followed_and_recorded(site_transport, resolver):
    r = await _fetcher(site_transport, resolver).fetch("http://example.com/redirect-good")
    assert r.ok and [h.status for h in r.chain] == [301, 200] and r.final_url == "http://example.com/"


async def test_redirect_limit(site_transport, resolver):
    r = await _fetcher(site_transport, resolver, max_redirects=3).fetch("http://example.com/loop")
    assert r.error and "Too many redirects" in r.error and len(r.chain) == 4


async def test_size_limit_truncates(site_transport, resolver):
    r = await _fetcher(site_transport, resolver).fetch("http://example.com/big")
    assert r.truncated and r.bytes_read == 10_000


async def test_binary_download_not_read(site_transport, resolver):
    r = await _fetcher(site_transport, resolver).fetch("http://example.com/file.exe")
    assert r.ok and r.html == "" and r.bytes_read == 0 and r.content_type == "application/octet-stream"


async def test_meta_refresh_followed(site_transport, resolver):
    r = await _fetcher(site_transport, resolver).fetch("http://example.com/meta")
    assert r.ok and r.final_url == "http://example.com/login"
    assert [h.kind for h in r.chain] == ["http", "meta-refresh", "http"]


async def test_robots(site_transport, resolver):
    assert await _fetcher(site_transport, resolver).robots_exists("http://example.com/x") is True
