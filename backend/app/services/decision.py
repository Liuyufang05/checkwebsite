"""Transparent decision layer: fuses the ML probabilities with live evidence.

The ML models only see what they were trained on (URL text, page HTML). Live
evidence the datasets do not contain (domain age, certificate validity,
redirects, reputation, threat intel) is applied as explicit, documented
log-odds adjustments. Every adjustment is returned to the UI as a "signal",
so the final number is fully explainable.
"""

from __future__ import annotations

import math

THRESH_SUSPICIOUS = 0.40
THRESH_PHISHING = 0.75
W_URL, W_CONTENT = 0.6, 0.4


def _logit(p: float) -> float:
    p = min(max(p, 1e-3), 1 - 1e-3)
    return math.log(p / (1 - p))


def _sigmoid(z: float) -> float:
    return 1 / (1 + math.exp(-z))


def _sig(signals, sid, label, detail, impact, severity, source):
    signals.append({"id": sid, "label": label, "detail": detail, "impact": round(impact, 3), "severity": severity, "source": source})
    return impact


def decide(
    *,
    p_url: float,
    p_content: float | None,
    reputable: bool,
    free_hosting: bool,
    whois: dict,
    tls: dict,
    scheme: str,
    redirect_cross_domain: bool,
    meta_refresh: bool,
    html_feats: dict | None,
    brand_outside_domain: bool,
    fetch_error: str | None,
    gsb: dict,
    vt: dict,
) -> dict:
    signals: list[dict] = []
    blend = p_url if p_content is None else W_URL * p_url + W_CONTENT * p_content
    z = _logit(blend)

    # --- reputation -------------------------------------------------------
    if reputable and not free_hosting:
        z += _sig(signals, "reputation", "Well-known website", "This site is on our list of popular, trusted websites.", -2.5, "good", "reputation")
    if free_hosting:
        _sig(signals, "free_hosting", "Built on a free website maker", "Anyone can make a site here for free, which scammers often use.", 0.0, "warn", "url")

    # --- domain age ---------------------------------------------------------
    age = whois.get("age_days") if whois.get("available") else None
    if age is not None:
        if age < 30:
            z += _sig(signals, "domain_age", "Brand-new website", f"Created {age} days ago. Scam sites are usually only days or weeks old.", 1.5, "bad", "whois")
        elif age < 180:
            z += _sig(signals, "domain_age", "Fairly new website", f"Created {age} days ago.", 0.6, "warn", "whois")
        elif age >= 5 * 365:
            z += _sig(signals, "domain_age", "Website has been around for years", f"Created {age // 365} years ago. Scam sites rarely last this long.", -0.8, "good", "whois")
        else:
            _sig(signals, "domain_age", "Website age", f"Created about {age // 365} year(s) ago.", 0.0, "info", "whois")
    else:
        _sig(signals, "domain_age", "Couldn't find the website's age", "The public registration records didn't give a date.", 0.0, "info", "whois")

    # --- TLS ------------------------------------------------------------------
    if scheme == "http" and not tls.get("available"):
        z += _sig(signals, "tls", "No security padlock", "The site doesn't use HTTPS, so anything you type isn't protected.", 0.5, "warn", "tls")
    elif tls.get("available"):
        if tls.get("expired") or tls.get("self_signed") or tls.get("verified") is False:
            why = "expired" if tls.get("expired") else "self-signed" if tls.get("self_signed") else (tls.get("verify_error") or "invalid")
            z += _sig(signals, "tls", "Security padlock has a problem", f"The site's certificate is {why}.", 1.0, "bad", "tls")
        else:
            z += _sig(signals, "tls", "Security padlock is valid", f"Issued by {tls.get('issuer') or 'a certificate authority'}. (Scam sites can have one too.)", -0.2, "good", "tls")

    # --- redirects --------------------------------------------------------------
    if redirect_cross_domain:
        z += _sig(signals, "redirect", "Sends you to a different website", "The link quietly forwards you somewhere else.", 0.5, "warn", "fetch")
    if meta_refresh:
        z += _sig(signals, "meta_refresh", "Instantly redirects", "The page jumps to another address as soon as it opens.", 0.3, "warn", "fetch")

    # --- page content -------------------------------------------------------------
    if html_feats:
        if html_feats.get("HasPasswordField") and html_feats.get("HasExternalFormSubmit"):
            z += _sig(signals, "cred_exfil", "Password box sends to another website", "Typing your password here would send it somewhere else: a classic phishing trick.", 1.2, "bad", "content")
        elif html_feats.get("HasPasswordField") and brand_outside_domain:
            z += _sig(signals, "brand_login", "Login form pretending to be a brand", "The address uses a brand name that doesn't own this website.", 0.8, "bad", "content")
        elif html_feats.get("HasPasswordField"):
            _sig(signals, "password", "Asks for a password", "Normal for login pages, but double-check the address before typing.", 0.0, "info", "content")
    if fetch_error:
        _sig(signals, "unreachable", "Couldn't open the page", f"{fetch_error} We judged it by the address only.", 0.0, "info", "fetch")

    # --- threat intelligence -------------------------------------------------------
    hard_flag = False
    if gsb.get("status") == "ok" and gsb.get("flagged"):
        hard_flag = True
        z = max(z, 4.0)
        _sig(signals, "gsb", "On Google's list of dangerous sites", "Google Safe Browsing lists it as: " + (", ".join(gsb.get("threats", [])) or "dangerous").replace("_", " ").lower() + ".", 4.0, "bad", "intel")
    elif gsb.get("status") == "ok":
        _sig(signals, "gsb", "Not on Google's list of dangerous sites", "Google Safe Browsing has no record of it.", 0.0, "good", "intel")
    if vt.get("status") == "ok" and vt.get("known"):
        mal = vt.get("malicious", 0) + vt.get("suspicious", 0)
        if mal >= 3:
            z += _sig(signals, "vt", "Security companies flag it", f"{mal} of {vt.get('engines')} security scanners on VirusTotal say it's dangerous.", 3.0, "bad", "intel")
        elif mal >= 1:
            z += _sig(signals, "vt", "A few security companies flag it", f"{mal} of {vt.get('engines')} security scanners on VirusTotal are suspicious of it.", 1.2, "warn", "intel")
        else:
            z += _sig(signals, "vt", "Security companies say it's clean", f"0 of {vt.get('engines')} security scanners on VirusTotal flag it.", -0.3, "good", "intel")

    p = _sigmoid(z)
    verdict = "phishing" if (p >= THRESH_PHISHING or hard_flag) else "suspicious" if p >= THRESH_SUSPICIOUS else "legitimate"
    return {
        "verdict": verdict,
        "probability_phishing": round(p, 4),
        "risk_score": int(round(p * 100)),
        "confidence": round(max(p, 1 - p), 4),
        "ml": {"p_url": round(p_url, 4), "p_content": None if p_content is None else round(p_content, 4),
               "blend": round(blend, 4), "weights": {"url": W_URL, "content": W_CONTENT if p_content is not None else 0}},
        "thresholds": {"suspicious": THRESH_SUSPICIOUS, "phishing": THRESH_PHISHING},
        "signals": signals,
    }
