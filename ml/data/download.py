"""Download the datasets used by the project.

Each dataset has an official primary source (UCI ML Repository) and a public
GitHub mirror used as a fallback when the primary is unreachable (UCI has
frequent outages and some networks block it). Mirror files are verified by
SHA-256; primary downloads are verified by shape and column names.

Usage:  python ml/data/download.py [--force]
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import RAW_DIR  # noqa: E402

UCI_COLUMNS = [
    "having_IP_Address", "URL_Length", "Shortining_Service", "having_At_Symbol",
    "double_slash_redirecting", "Prefix_Suffix", "having_Sub_Domain",
    "SSLfinal_State", "Domain_registeration_length", "Favicon", "port",
    "HTTPS_token", "Request_URL", "URL_of_Anchor", "Links_in_tags", "SFH",
    "Submitting_to_email", "Abnormal_URL", "Redirect", "on_mouseover",
    "RightClick", "popUpWidnow", "Iframe", "age_of_domain", "DNSRecord",
    "web_traffic", "Page_Rank", "Google_Index", "Links_pointing_to_page",
    "Statistical_report", "Result",
]

DATASETS = {
    "uci_phishing_websites": {
        "file": "uci_phishing_websites.csv",
        "description": "UCI Phishing Websites (Mohammad, Thabtah & McCluskey, 2012) - 11,055 rows x 30 ternary features",
        "primary": "https://archive.ics.uci.edu/static/public/327/phishing+websites.zip",
        "mirror": "https://raw.githubusercontent.com/Arkit003/NetworkSecurity/main/network_data/phisingData.csv",
        "mirror_sha256": "e20bf913b6c2e669f4e875e5d223be2542cc7c79a7b62d284ae9d9627c3d9678",
        "rows": 11055,
        "license": "CC BY 4.0",
    },
    "phiusiil": {
        "file": "phiusiil.csv",
        "description": "PhiUSIIL Phishing URL Dataset (Prasad & Chandra, 2024) - 235,795 URLs with URL + HTML features",
        "primary": "https://archive.ics.uci.edu/static/public/967/phiusiil+phishing+url+dataset.zip",
        "mirror": "https://raw.githubusercontent.com/elaaatif/DATA-MINING-PhiUSIIL-Phishing-URL/main/PhiUSIIL_Phishing_URL_Dataset.csv",
        "mirror_sha256": "8e7e0331987e0f4dee0ca29df3b04e1913c19f2d60802c9a929c3e02aed2ff9a",
        "rows": 235795,
        "license": "CC BY 4.0",
    },
    "url_paths_benign_malicious": {
        "file": "url_paths.csv",
        "description": "420k labelled URLs with full paths (faizann24, 2016) - adds legitimate deep links that PhiUSIIL lacks",
        "primary": "https://raw.githubusercontent.com/faizann24/Using-machine-learning-to-detect-malicious-URLs/master/data/data.csv",
        "mirror": None,
        "mirror_sha256": "3243f054f5205e352f7a9adc2d7b993d516acd4ad17cb032b91c989138e34808",
        "rows": 420464,
        "license": "Public GitHub repository (research use)",
    },
}

TIMEOUT = 120
HEADERS = {"User-Agent": "phishing-detector-research/1.0 (+https://github.com/demonmj/phishing-detector)"}


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _get(url: str) -> bytes:
    r = requests.get(url, timeout=TIMEOUT, headers=HEADERS)
    r.raise_for_status()
    return r.content


def _parse_arff(text: str) -> pd.DataFrame:
    rows, in_data = [], False
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("%"):
            continue
        if s.lower() == "@data":
            in_data = True
            continue
        if in_data:
            rows.append([int(v) for v in s.split(",")])
    return pd.DataFrame(rows, columns=UCI_COLUMNS)


def _from_primary(name: str, blob: bytes) -> pd.DataFrame:
    if name == "uci_phishing_websites":
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            arff = next(n for n in z.namelist() if n.lower().endswith(".arff"))
            return _parse_arff(z.read(arff).decode("utf-8", "replace"))
    if name == "phiusiil":
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            csv = next(n for n in z.namelist() if n.lower().endswith(".csv"))
            return pd.read_csv(io.BytesIO(z.read(csv)), encoding="utf-8-sig")
    return pd.read_csv(io.BytesIO(blob))


def fetch(name: str, spec: dict, force: bool = False) -> dict:
    out = RAW_DIR / spec["file"]
    if out.exists() and not force:
        print(f"[skip] {name}: {out.name} already present")
        return {"name": name, "file": out.name, "source": "cached", "sha256": _sha256(out.read_bytes())}

    source = None
    df = None
    try:
        print(f"[get ] {name}: primary {spec['primary']}")
        blob = _get(spec["primary"])
        if spec["mirror"] is None:
            if _sha256(blob) != spec["mirror_sha256"]:
                raise ValueError("checksum mismatch")
            out.write_bytes(blob)
            return {"name": name, "file": out.name, "source": spec["primary"], "sha256": _sha256(blob)}
        df = _from_primary(name, blob)
        source = spec["primary"]
    except Exception as exc:  # noqa: BLE001 - fall through to mirror
        print(f"[warn] primary failed for {name}: {exc}")
        if not spec["mirror"]:
            raise
        print(f"[get ] {name}: mirror {spec['mirror']}")
        blob = _get(spec["mirror"])
        digest = _sha256(blob)
        if digest != spec["mirror_sha256"]:
            raise RuntimeError(f"{name}: mirror checksum mismatch ({digest})") from exc
        out.write_bytes(blob)
        return {"name": name, "file": out.name, "source": spec["mirror"], "sha256": digest}

    if len(df) != spec["rows"]:
        raise RuntimeError(f"{name}: expected {spec['rows']} rows, got {len(df)}")
    df.to_csv(out, index=False)
    return {"name": name, "file": out.name, "source": source, "sha256": _sha256(out.read_bytes())}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--force", action="store_true", help="re-download even if files exist")
    args = ap.parse_args()
    manifest = []
    for name, spec in DATASETS.items():
        info = fetch(name, spec, args.force)
        info.update({k: spec[k] for k in ("description", "license", "rows")})
        manifest.append(info)
    (RAW_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"[done] {len(manifest)} datasets in {RAW_DIR}")


if __name__ == "__main__":
    main()
