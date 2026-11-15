"""HTML content feature extractor.

Re-implements the subset of PhiUSIIL HTML columns whose definitions are
unambiguous (Prasad & Chandra, 2024). The training pipeline uses the dataset's
columns directly; the live scanner computes the same columns from the raw HTML
it downloads with this module. Column names intentionally match PhiUSIIL.

Columns that cannot be reproduced faithfully are excluded from the model:
``URLSimilarityIndex`` (relies on the authors' private reference list and is a
near-perfect label leak), ``TLDLegitimateProb``/``URLCharProb`` (corpus
statistics), ``DomainTitleMatchScore``/``URLTitleMatchScore`` (the dataset's
``Title`` column is often a mangled domain string, so the score is not
reproducible) and ``NoOfURLRedirect``/``NoOfSelfRedirect`` (undocumented).
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .lists import BANK_WORDS, CRYPTO_WORDS, PAY_WORDS, SOCIAL_NETWORKS
from .url_features import parse

HTML_FEATURE_NAMES: tuple[str, ...] = (
    "LineOfCode", "LargestLineLength", "HasTitle", "HasFavicon", "Robots",
    "IsResponsive", "HasDescription", "NoOfPopup", "NoOfiFrame",
    "HasExternalFormSubmit", "HasSocialNet", "HasSubmitButton",
    "HasHiddenFields", "HasPasswordField", "Bank", "Pay", "Crypto",
    "HasCopyrightInfo", "NoOfImage", "NoOfCSS", "NoOfJS", "NoOfSelfRef",
    "NoOfEmptyRef", "NoOfExternalRef",
)

_WINDOW_OPEN_RE = re.compile(r"window\.open\s*\(")
_EMPTY_HREF = {"", "#", "#!", "/#", "javascript:void(0)", "javascript:void(0);", "javascript:;", "javascript:"}


def _word_hit(text: str, words: tuple[str, ...]) -> int:
    for w in words:
        if re.search(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", text):
            return 1
    return 0


def _registered(url: str) -> str:
    return parse(url).registered_domain


def extract_html_features(html: str, page_url: str, robots_exists: bool = False) -> dict[str, float]:
    """Compute PhiUSIIL-compatible HTML features from raw HTML."""
    html = html or ""
    lines = html.splitlines() or [""]
    soup = BeautifulSoup(html, "lxml") if html.strip() else BeautifulSoup("", "lxml")
    page_reg = _registered(page_url)

    title = soup.title.get_text(strip=True) if soup.title else ""
    text = (soup.get_text(" ", strip=True) + " " + title).lower()

    favicon = any(
        "icon" in " ".join(link.get("rel") or []).lower() for link in soup.find_all("link")
    )
    viewport = soup.find("meta", attrs={"name": re.compile("^viewport$", re.I)}) is not None
    description = soup.find("meta", attrs={"name": re.compile("^description$", re.I)}) is not None

    scripts = soup.find_all("script")
    script_text = " ".join(s.get_text() for s in scripts)
    inline_handlers = " ".join(
        str(v) for tag in soup.find_all(True) for k, v in tag.attrs.items() if k.startswith("on")
    )
    popups = len(_WINDOW_OPEN_RE.findall(script_text + " " + inline_handlers))

    ext_form = 0
    for form in soup.find_all("form"):
        action = (form.get("action") or "").strip()
        if action.lower().startswith(("http://", "https://", "//")):
            target = urljoin(page_url, action)
            if _registered(target) and _registered(target) != page_reg:
                ext_form = 1
                break

    inputs = soup.find_all("input")
    input_types = [(i.get("type") or "text").lower() for i in inputs]
    submit = "submit" in input_types or "image" in input_types or any(
        (b.get("type") or "submit").lower() == "submit" for b in soup.find_all("button")
    )

    self_ref = empty_ref = ext_ref = 0
    social = 0
    for a in soup.find_all("a"):
        href = (a.get("href") or "").strip()
        h = href.lower()
        if h in _EMPTY_HREF or h.startswith("javascript:"):
            empty_ref += 1
            continue
        if h.startswith(("mailto:", "tel:", "sms:")):
            continue
        absolute = urljoin(page_url, href)
        reg = _registered(absolute)
        if any(s in absolute.lower() for s in SOCIAL_NETWORKS):
            social = 1
        if h.startswith(("http://", "https://", "//")) and reg and reg != page_reg:
            ext_ref += 1
        else:
            self_ref += 1

    css = sum(
        1 for link in soup.find_all("link") if "stylesheet" in " ".join(link.get("rel") or []).lower()
    ) + len(soup.find_all("style"))

    feats = {
        "LineOfCode": len(lines) if html else 0,
        "LargestLineLength": max(len(line) for line in lines),
        "HasTitle": int(bool(title)),
        "HasFavicon": int(favicon),
        "Robots": int(bool(robots_exists)),
        "IsResponsive": int(viewport),
        "HasDescription": int(description),
        "NoOfPopup": popups,
        "NoOfiFrame": len(soup.find_all("iframe")),
        "HasExternalFormSubmit": ext_form,
        "HasSocialNet": social,
        "HasSubmitButton": int(submit),
        "HasHiddenFields": int("hidden" in input_types),
        "HasPasswordField": int("password" in input_types),
        "Bank": _word_hit(text, BANK_WORDS),
        "Pay": _word_hit(text, PAY_WORDS),
        "Crypto": _word_hit(text, CRYPTO_WORDS),
        "HasCopyrightInfo": int("©" in text or "&copy;" in html.lower() or "copyright" in text),
        "NoOfImage": len(soup.find_all("img")),
        "NoOfCSS": css,
        "NoOfJS": len(scripts),
        "NoOfSelfRef": self_ref,
        "NoOfEmptyRef": empty_ref,
        "NoOfExternalRef": ext_ref,
    }
    return {k: float(feats[k]) for k in HTML_FEATURE_NAMES}
