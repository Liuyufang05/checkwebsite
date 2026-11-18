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
        z += _sig(signals, "reputation", "Website nổi tiếng", "Website này nằm trong danh sách website phổ biến và được tin cậy.", -2.5, "good", "reputation")
    if free_hosting:
        _sig(signals, "free_hosting", "Dựng trên công cụ tạo website miễn phí", "Ai cũng có thể tạo website miễn phí tại đây, nên kẻ lừa đảo thường dùng.", 0.0, "warn", "url")

    # --- domain age ---------------------------------------------------------
    age = whois.get("age_days") if whois.get("available") else None
    if age is not None:
        if age < 30:
            z += _sig(signals, "domain_age", "Website hoàn toàn mới", f"Được tạo {age} ngày trước. Website lừa đảo thường mới vài ngày hoặc vài tuần.", 1.5, "bad", "whois")
        elif age < 180:
            z += _sig(signals, "domain_age", "Website tương đối mới", f"Được tạo {age} ngày trước.", 0.6, "warn", "whois")
        elif age >= 5 * 365:
            z += _sig(signals, "domain_age", "Website đã tồn tại nhiều năm", f"Được tạo cách đây {age // 365} năm. Website lừa đảo hiếm khi tồn tại lâu.", -0.8, "good", "whois")
        else:
            _sig(signals, "domain_age", "Tuổi website", f"Được tạo khoảng {age // 365} năm trước.", 0.0, "info", "whois")
    else:
        _sig(signals, "domain_age", "Không tìm thấy tuổi website", "Hồ sơ đăng ký công khai không cung cấp ngày tạo.", 0.0, "info", "whois")

    # --- TLS ------------------------------------------------------------------
    if scheme == "http" and not tls.get("available"):
        z += _sig(signals, "tls", "Không có ổ khóa bảo mật", "Website không dùng HTTPS, nên dữ liệu bạn nhập không được bảo vệ.", 0.5, "warn", "tls")
    elif tls.get("available"):
        if tls.get("expired") or tls.get("self_signed") or tls.get("verified") is False:
            why = "expired" if tls.get("expired") else "self-signed" if tls.get("self_signed") else (tls.get("verify_error") or "invalid")
            z += _sig(signals, "tls", "Ổ khóa bảo mật có vấn đề", f"Chứng chỉ của website {why}.", 1.0, "bad", "tls")
        else:
            z += _sig(signals, "tls", "Ổ khóa bảo mật hợp lệ", f"Được cấp bởi {tls.get('issuer') or 'một cơ quan chứng chỉ'}. (Website lừa đảo cũng có thể có.)", -0.2, "good", "tls")

    # --- redirects --------------------------------------------------------------
    if redirect_cross_domain:
        z += _sig(signals, "redirect", "Chuyển bạn sang website khác", "Liên kết âm thầm chuyển bạn đến một nơi khác.", 0.5, "warn", "fetch")
    if meta_refresh:
        z += _sig(signals, "meta_refresh", "Chuyển hướng ngay lập tức", "Trang nhảy sang địa chỉ khác ngay khi mở.", 0.3, "warn", "fetch")

    # --- page content -------------------------------------------------------------
    if html_feats:
        if html_feats.get("HasPasswordField") and html_feats.get("HasExternalFormSubmit"):
            z += _sig(signals, "cred_exfil", "Ô mật khẩu gửi dữ liệu sang website khác", "Nhập mật khẩu ở đây sẽ gửi dữ liệu đi nơi khác: thủ thuật lừa đảo kinh điển.", 1.2, "bad", "content")
        elif html_feats.get("HasPasswordField") and brand_outside_domain:
            z += _sig(signals, "brand_login", "Biểu mẫu đăng nhập giả mạo thương hiệu", "Địa chỉ dùng tên thương hiệu không sở hữu website này.", 0.8, "bad", "content")
        elif html_feats.get("HasPasswordField"):
            _sig(signals, "password", "Yêu cầu mật khẩu", "Bình thường với trang đăng nhập, nhưng hãy kiểm tra kỹ địa chỉ trước khi nhập.", 0.0, "info", "content")
    if fetch_error:
        _sig(signals, "unreachable", "Không thể mở trang", f"{fetch_error} Chúng tôi chỉ đánh giá theo địa chỉ.", 0.0, "info", "fetch")

    # --- threat intelligence -------------------------------------------------------
    hard_flag = False
    if gsb.get("status") == "ok" and gsb.get("flagged"):
        hard_flag = True
        z = max(z, 4.0)
        _sig(signals, "gsb", "Trong danh sách website nguy hiểm của Google", "Google Safe Browsing liệt kê đây là: " + (", ".join(gsb.get("threats", [])) or "nguy hiểm").replace("_", " ").lower() + ".", 4.0, "bad", "intel")
    elif gsb.get("status") == "ok":
        _sig(signals, "gsb", "Không trong danh sách website nguy hiểm của Google", "Google Safe Browsing không có hồ sơ về website này.", 0.0, "good", "intel")
    if vt.get("status") == "ok" and vt.get("known"):
        mal = vt.get("malicious", 0) + vt.get("suspicious", 0)
        if mal >= 3:
            z += _sig(signals, "vt", "Các công ty bảo mật đánh dấu trang này", f"{mal} trên {vt.get('engines')} công cụ quét VirusTotal nói đây là nguy hiểm.", 3.0, "bad", "intel")
        elif mal >= 1:
            z += _sig(signals, "vt", "Một vài công ty bảo mật đánh dấu trang này", f"{mal} trên {vt.get('engines')} công cụ quét VirusTotal nghi ngờ trang này.", 1.2, "warn", "intel")
        else:
            z += _sig(signals, "vt", "Các công ty bảo mật cho rằng an toàn", f"0 trên {vt.get('engines')} công cụ quét VirusTotal đánh dấu trang này.", -0.3, "good", "intel")

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
