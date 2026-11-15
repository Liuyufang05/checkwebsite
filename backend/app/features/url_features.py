"""URL lexical feature extractor.

This module is the single source of truth for URL features: the ML training
pipeline (``ml/prepare.py``) imports it to build the training matrix from the
dataset URLs, and the live scanner imports it to featurise a pasted URL. That
guarantees train/serve parity.

Canonicalisation
----------------
The public datasets carry strong *collection artefacts* (e.g. every legitimate
PhiUSIIL URL is ``https://www.<domain>`` with no path, and PhiUSIIL is fully
lower-cased while other sources are not). A model fed raw URLs learns
"has www + https + no path => legitimate", which is useless in the real world.
We therefore canonicalise every URL before computing features:

* lower-case everything,
* drop the scheme (TLS is checked live from the real certificate instead),
* drop a leading ``www.``,
* drop the fragment and a trailing ``/``.
"""

from __future__ import annotations

import ipaddress
import math
import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache

import tldextract

from .lists import (
    BRANDS,
    COMMON_FILE_EXT,
    FREE_HOSTING,
    SENSITIVE_WORDS,
    SUSPICIOUS_TLDS,
    URL_SHORTENERS,
)

# Offline public-suffix snapshot bundled with tldextract -> deterministic.
_EXTRACT = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)

_SCHEME_RE = re.compile(r"^[a-z][a-z0-9+.\-]*://")
_TOKEN_SPLIT_RE = re.compile(r"[^a-z0-9]+")
_HEX_RUN_RE = re.compile(r"[0-9a-f]{16,}")


@dataclass(frozen=True)
class ParsedURL:
    canonical: str
    authority: str
    host: str
    port: str
    path: str
    query: str
    subdomain: str
    domain: str
    suffix: str

    @property
    def registered_domain(self) -> str:
        return f"{self.domain}.{self.suffix}" if self.suffix else self.domain


def canonicalize(url: str) -> str:
    """Return the canonical form used for feature extraction."""
    u = (url or "").strip().lower()
    u = _SCHEME_RE.sub("", u)
    u = u.split("#", 1)[0]
    if u.startswith("www."):
        u = u[4:]
    while u.endswith("/"):
        u = u[:-1]
    return u


@lru_cache(maxsize=4096)
def parse(url: str) -> ParsedURL:
    canon = canonicalize(url)
    cut = len(canon)
    for ch in "/?":
        i = canon.find(ch)
        if i != -1:
            cut = min(cut, i)
    authority, rest = canon[:cut], canon[cut:]
    hostport = authority.rsplit("@", 1)[-1]
    host, port = hostport, ""
    if hostport.startswith("["):  # IPv6 literal
        end = hostport.find("]")
        host = hostport[1:end] if end != -1 else hostport
        port = hostport[end + 2:] if end != -1 and hostport[end + 1:end + 2] == ":" else ""
    elif ":" in hostport:
        host, port = hostport.rsplit(":", 1)
    if host.startswith("www."):
        host = host[4:]
    if "?" in rest:
        path, query = rest.split("?", 1)
    else:
        path, query = rest, ""
    ext = _EXTRACT(host)
    return ParsedURL(canon, authority, host, port, path, query, ext.subdomain, ext.domain, ext.suffix)


def _entropy(s: str) -> float:
    if not s:
        return 0.0
    counts = Counter(s)
    n = len(s)
    return -sum(c / n * math.log2(c / n) for c in counts.values())


def _is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        pass
    # Hex / octal / dword encoded IPv4 such as 0x7f000001 or 3232235777
    if re.fullmatch(r"0x[0-9a-f]{8}|\d{8,10}", host):
        return True
    return False


def _max_run(s: str) -> int:
    best = run = 0
    prev = ""
    for ch in s:
        run = run + 1 if ch == prev else 1
        prev = ch
        best = max(best, run)
    return best


URL_FEATURE_NAMES: tuple[str, ...] = (
    "url_length", "host_length", "path_length", "query_length",
    "num_path_segments", "max_path_segment_length", "num_subdomains",
    "sld_length", "tld_length", "is_ip_host", "has_port", "has_at_symbol",
    "num_dots_host", "num_hyphens_host", "num_hyphens_url", "num_underscores",
    "num_slashes", "has_double_slash_in_path", "num_equals", "num_question",
    "num_ampersand", "num_percent", "num_tilde", "num_digits_url",
    "digit_ratio_url", "num_digits_host", "letter_ratio_url", "host_entropy",
    "url_entropy", "longest_token_length", "num_host_tokens", "has_punycode",
    "sensitive_word_count", "brand_outside_domain", "brand_in_domain_not_exact",
    "is_shortener", "is_free_hosting", "suspicious_tld", "has_file_extension",
    "has_php", "http_token_in_url", "embedded_url", "max_char_repeat",
    "num_hex_runs",
)


def extract_url_features(url: str) -> dict[str, float]:
    """Compute the URL lexical feature vector (ordered as URL_FEATURE_NAMES)."""
    p = parse(url)
    c = p.canonical
    host = p.host
    path, query = p.path, p.query
    segments = [s for s in path.split("/") if s]
    tokens = [t for t in _TOKEN_SPLIT_RE.split(c) if t]
    host_tokens = [t for t in re.split(r"[.\-]", host) if t]
    reg = p.registered_domain
    outside = f"{p.subdomain} {path} {query}"

    n = max(len(c), 1)
    digits = sum(ch.isdigit() for ch in c)
    letters = sum(ch.isalpha() for ch in c)

    brand_outside = int(any(b in outside for b in BRANDS if len(b) >= 4) and not any(b == p.domain for b in BRANDS))
    brand_in_domain = int(any(b in p.domain and b != p.domain for b in BRANDS if len(b) >= 4))

    feats = {
        "url_length": len(c),
        "host_length": len(host),
        "path_length": len(path),
        "query_length": len(query),
        "num_path_segments": len(segments),
        "max_path_segment_length": max((len(s) for s in segments), default=0),
        "num_subdomains": len([s for s in p.subdomain.split(".") if s]),
        "sld_length": len(p.domain),
        "tld_length": len(p.suffix),
        "is_ip_host": int(_is_ip(host)),
        "has_port": int(bool(p.port)),
        "has_at_symbol": int("@" in c),
        "num_dots_host": host.count("."),
        "num_hyphens_host": host.count("-"),
        "num_hyphens_url": c.count("-"),
        "num_underscores": c.count("_"),
        "num_slashes": c.count("/"),
        "has_double_slash_in_path": int("//" in path),
        "num_equals": c.count("="),
        "num_question": c.count("?"),
        "num_ampersand": c.count("&"),
        "num_percent": c.count("%"),
        "num_tilde": c.count("~"),
        "num_digits_url": digits,
        "digit_ratio_url": round(digits / n, 6),
        "num_digits_host": sum(ch.isdigit() for ch in host),
        "letter_ratio_url": round(letters / n, 6),
        "host_entropy": round(_entropy(host), 6),
        "url_entropy": round(_entropy(c), 6),
        "longest_token_length": max((len(t) for t in tokens), default=0),
        "num_host_tokens": len(host_tokens),
        "has_punycode": int("xn--" in host),
        "sensitive_word_count": sum(c.count(w) for w in SENSITIVE_WORDS),
        "brand_outside_domain": brand_outside,
        "brand_in_domain_not_exact": brand_in_domain,
        "is_shortener": int(host in URL_SHORTENERS or reg in URL_SHORTENERS),
        "is_free_hosting": int(reg in FREE_HOSTING or any(host.endswith("." + f) or host == f for f in FREE_HOSTING)),
        "suspicious_tld": int(p.suffix.split(".")[-1] in SUSPICIOUS_TLDS),
        "has_file_extension": int(any(path.endswith(e) for e in COMMON_FILE_EXT)),
        "has_php": int(".php" in path),
        "http_token_in_url": int("http" in host or "http" in path or "http" in query),
        "embedded_url": int("www." in path or "www." in query or "://" in path or "://" in query or "%3a%2f%2f" in c),
        "max_char_repeat": _max_run(c),
        "num_hex_runs": len(_HEX_RUN_RE.findall(c)),
    }
    return {k: float(feats[k]) for k in URL_FEATURE_NAMES}


def url_feature_vector(url: str) -> list[float]:
    f = extract_url_features(url)
    return [f[k] for k in URL_FEATURE_NAMES]
