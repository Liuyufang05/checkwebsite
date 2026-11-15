"""Human-readable names for features (used in explanations and the UI)."""

DESCRIPTIONS: dict[str, str] = {
    # URL lexical
    "url_length": "URL length", "host_length": "Hostname length", "path_length": "Path length",
    "query_length": "Query-string length", "num_path_segments": "Number of path segments",
    "max_path_segment_length": "Longest path segment", "num_subdomains": "Number of subdomains",
    "sld_length": "Domain-name length", "tld_length": "TLD length", "is_ip_host": "Host is a raw IP address",
    "has_port": "Explicit port in URL", "has_at_symbol": "'@' symbol in URL", "num_dots_host": "Dots in hostname",
    "num_hyphens_host": "Hyphens in hostname", "num_hyphens_url": "Hyphens in URL", "num_underscores": "Underscores in URL",
    "num_slashes": "Slashes in URL", "has_double_slash_in_path": "'//' inside the path", "num_equals": "'=' characters",
    "num_question": "'?' characters", "num_ampersand": "'&' characters", "num_percent": "Percent-encoded characters",
    "num_tilde": "'~' characters", "num_digits_url": "Digits in URL", "digit_ratio_url": "Digit ratio of URL",
    "num_digits_host": "Digits in hostname", "letter_ratio_url": "Letter ratio of URL", "host_entropy": "Hostname randomness (entropy)",
    "url_entropy": "URL randomness (entropy)", "longest_token_length": "Longest word/token", "num_host_tokens": "Words in hostname",
    "has_punycode": "Punycode (look-alike characters)", "sensitive_word_count": "Sensitive words (login, verify, account...)",
    "brand_outside_domain": "Brand name outside the real domain", "brand_in_domain_not_exact": "Brand name embedded in a different domain",
    "is_shortener": "URL shortener", "is_free_hosting": "Free hosting / site-builder domain", "suspicious_tld": "High-abuse TLD",
    "has_file_extension": "Path ends in a script/file extension", "has_php": "PHP script in path", "http_token_in_url": "'http' text inside host/path",
    "embedded_url": "Another URL embedded in the path/query", "max_char_repeat": "Longest repeated character run",
    "num_hex_runs": "Long hex strings (tracking/obfuscation)",
    # HTML content (PhiUSIIL names)
    "LineOfCode": "Lines of HTML", "LargestLineLength": "Longest HTML line", "HasTitle": "Page has a <title>",
    "HasFavicon": "Page has a favicon", "Robots": "Site has robots.txt", "IsResponsive": "Responsive (viewport meta)",
    "HasDescription": "Has meta description", "NoOfPopup": "Pop-up windows (window.open)", "NoOfiFrame": "Number of iframes",
    "HasExternalFormSubmit": "Form submits to another domain", "HasSocialNet": "Links to social networks",
    "HasSubmitButton": "Has a submit button", "HasHiddenFields": "Hidden form fields", "HasPasswordField": "Password field",
    "Bank": "Banking keywords", "Pay": "Payment keywords", "Crypto": "Crypto-wallet keywords",
    "HasCopyrightInfo": "Copyright notice", "NoOfImage": "Number of images", "NoOfCSS": "Number of stylesheets",
    "NoOfJS": "Number of scripts", "NoOfSelfRef": "Links to the same site", "NoOfEmptyRef": "Empty links (#)",
    "NoOfExternalRef": "Links to other sites",
}


def describe(feature: str) -> str:
    return DESCRIPTIONS.get(feature, feature)
