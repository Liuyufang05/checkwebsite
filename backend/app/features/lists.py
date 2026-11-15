"""Static keyword / domain lists used by the feature extractors.

These lists are part of the *feature definition*: changing them changes the
features, so the model must be retrained afterwards (the model metadata stores
a hash of this module's lists to detect drift).
"""

from __future__ import annotations

import hashlib
import json

# Brands that are frequently impersonated in phishing campaigns.
BRANDS: tuple[str, ...] = (
    "paypal", "apple", "icloud", "microsoft", "office365", "office", "outlook",
    "hotmail", "live", "onedrive", "sharepoint", "google", "gmail", "amazon",
    "netflix", "facebook", "instagram", "whatsapp", "meta", "metamask",
    "coinbase", "binance", "blockchain", "trustwallet", "ledger", "dhl", "fedex",
    "usps", "ups", "chase", "wellsfargo", "bankofamerica", "citi", "hsbc",
    "barclays", "santander", "ebay", "adobe", "dropbox", "docusign", "linkedin",
    "twitter", "steam", "roblox", "yahoo", "aol", "att", "verizon", "irs",
    "sbi", "hdfc", "icici", "paytm", "phonepe", "airtel", "jio",
)

# Words that commonly appear in credential-harvesting URLs.
SENSITIVE_WORDS: tuple[str, ...] = (
    "login", "log-in", "signin", "sign-in", "logon", "verify", "verification",
    "secure", "security", "account", "update", "confirm", "password", "passwd",
    "banking", "wallet", "webscr", "ebayisapi", "suspend", "unlock", "billing",
    "invoice", "recover", "auth", "authenticate", "validation", "support",
    "customer", "service", "free", "bonus", "claim", "gift", "prize", "seed",
)

# TLDs with historically high abuse rates (Spamhaus / Interisle reports).
SUSPICIOUS_TLDS: frozenset[str] = frozenset({
    "tk", "ml", "ga", "cf", "gq", "xyz", "top", "work", "click", "link", "zip",
    "mov", "country", "kim", "loan", "men", "date", "racing", "review", "stream",
    "download", "gdn", "bid", "win", "party", "trade", "science", "accountant",
    "cricket", "faith", "icu", "cyou", "buzz", "rest", "fit", "monster", "sbs",
    "cfd", "quest", "support", "live", "online", "site", "website", "space",
    "shop", "store", "fun", "host", "pw", "cc", "su", "ws",
})

URL_SHORTENERS: frozenset[str] = frozenset({
    "bit.ly", "goo.gl", "tinyurl.com", "t.co", "ow.ly", "is.gd", "buff.ly",
    "adf.ly", "bit.do", "cutt.ly", "shorturl.at", "rebrand.ly", "rb.gy",
    "tiny.cc", "lnkd.in", "s.id", "v.gd", "qr.ae", "t.ly", "x.co", "trib.al",
    "shorte.st", "bl.ink", "short.io", "soo.gd", "clck.ru", "u.to", "tr.im",
})

# Registered domains of free hosting / site builders / gateways that phishers
# abuse because they come with valid TLS and a "clean" domain reputation.
FREE_HOSTING: frozenset[str] = frozenset({
    "firebaseapp.com", "web.app", "weebly.com", "weeblysite.com", "wixsite.com",
    "godaddysites.com", "000webhostapp.com", "repl.co", "replit.dev",
    "glitch.me", "surge.sh", "netlify.app", "vercel.app", "pages.dev",
    "workers.dev", "herokuapp.com", "github.io", "gitlab.io", "blogspot.com",
    "wordpress.com", "sites.google.com", "appspot.com", "azurewebsites.net",
    "web.core.windows.net", "ipfs.io", "cf-ipfs.com", "infura-ipfs.io",
    "dweb.link", "fleek.co", "ngrok.io", "ngrok-free.app", "duckdns.org",
    "servehumour.com", "hopto.org", "zapto.org", "sytes.net", "ddns.net",
    "webflow.io", "square.site", "mystrikingly.com", "jimdosite.com",
    "yolasite.com", "carrd.co", "framer.app", "my.canva.site", "notion.site",
    "typedream.app", "r2.dev", "amplifyapp.com", "onrender.com", "fly.dev",
})

SOCIAL_NETWORKS: tuple[str, ...] = (
    "facebook.com", "twitter.com", "x.com", "instagram.com", "linkedin.com",
    "youtube.com", "pinterest.com", "tiktok.com", "reddit.com", "tumblr.com",
    "vk.com", "t.me", "telegram.me", "whatsapp.com",
)

BANK_WORDS: tuple[str, ...] = ("bank", "banking", "account number", "routing number", "iban", "swift code", "netbanking")
PAY_WORDS: tuple[str, ...] = ("pay", "payment", "credit card", "debit card", "card number", "cvv", "billing", "checkout", "upi")
CRYPTO_WORDS: tuple[str, ...] = ("crypto", "bitcoin", "btc", "ethereum", "wallet", "seed phrase", "recovery phrase", "metamask", "usdt", "airdrop")

COMMON_FILE_EXT: tuple[str, ...] = (".php", ".html", ".htm", ".asp", ".aspx", ".jsp", ".cgi", ".exe", ".zip", ".js")


def lists_fingerprint() -> str:
    """Stable hash of all lists, stored in model metadata to detect drift."""
    payload = json.dumps(
        [
            sorted(BRANDS), sorted(SENSITIVE_WORDS), sorted(SUSPICIOUS_TLDS),
            sorted(URL_SHORTENERS), sorted(FREE_HOSTING), sorted(SOCIAL_NETWORKS),
            sorted(BANK_WORDS), sorted(PAY_WORDS), sorted(CRYPTO_WORDS),
            sorted(COMMON_FILE_EXT),
        ]
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:16]
