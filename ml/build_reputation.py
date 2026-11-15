"""Build the domain-reputation allow-list used by the live decision layer.

Source: registered domains of PhiUSIIL *legitimate* URLs (top sites crawled
from Open PageRank) plus official domains of commonly impersonated brands.
Removed: free-hosting/shortener domains (anyone can publish there) and any
domain that appears as phishing/malicious in *any* dataset we use.

This list is NOT a model feature (that would leak the label); it is only a
transparent risk dampener in the scanner, shown to the user as a signal.
"""

from __future__ import annotations

import gzip

import pandas as pd

from config import BACKEND_DIR, RAW_DIR

from app.features import parse  # noqa: E402
from app.features.lists import FREE_HOSTING, URL_SHORTENERS  # noqa: E402

OFFICIAL = """
google.com youtube.com gmail.com google.co.in microsoft.com live.com outlook.com office.com office365.com
microsoftonline.com bing.com apple.com icloud.com amazon.com amazon.in amazon.co.uk aws.amazon.com
paypal.com netflix.com facebook.com instagram.com whatsapp.com meta.com linkedin.com twitter.com x.com
github.com gitlab.com stackoverflow.com wikipedia.org reddit.com yahoo.com dropbox.com adobe.com
docusign.com ebay.com coinbase.com binance.com metamask.io dhl.com fedex.com ups.com usps.com
chase.com wellsfargo.com bankofamerica.com citi.com hsbc.com barclays.co.uk santander.com
onlinesbi.sbi sbi.co.in hdfcbank.com icicibank.com paytm.com phonepe.com airtel.in jio.com
flipkart.com irctc.co.in gov.in nic.in python.org npmjs.com pypi.org cloudflare.com vercel.com
netlify.com openai.com anthropic.com claude.ai zoom.us slack.com notion.so spotify.com steamcommunity.com
steampowered.com roblox.com discord.com twitch.tv bbc.com bbc.co.uk nytimes.com cnn.com
""".split()


def main() -> None:
    phi = pd.read_csv(RAW_DIR / "phiusiil.csv", encoding="utf-8-sig", usecols=["URL", "label"])
    fz = pd.read_csv(RAW_DIR / "url_paths.csv")
    reg = lambda u: parse(str(u)).registered_domain  # noqa: E731
    legit = set(phi.loc[phi.label == 1, "URL"].map(reg))
    bad = set(phi.loc[phi.label == 0, "URL"].map(reg)) | set(fz.loc[fz.label == "bad", "url"].map(reg))
    blocked = set(FREE_HOSTING) | set(URL_SHORTENERS)
    rep = {d for d in legit if d and "." in d and d not in bad and d not in blocked}
    rep |= set(OFFICIAL)
    out = BACKEND_DIR / "app" / "data" / "reputable_domains.txt.gz"
    out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        fh.write("\n".join(sorted(rep)))
    print(f"[reputation] {len(rep)} domains ({len(legit & bad)} dropped for appearing as phishing) -> {out}")


if __name__ == "__main__":
    main()
