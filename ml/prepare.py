"""Clean the raw datasets and build the three feature tables.

Outputs (ml/data/processed/):
  uci.parquet      - UCI Phishing Websites, 30 ternary features (comparison set)
  url.parquet      - live URL lexical features recomputed from dataset URLs
  content.parquet  - PhiUSIIL HTML content features reproducible live

Label convention everywhere: 1 = phishing, 0 = legitimate.
"""

from __future__ import annotations

import json
import time

import numpy as np
import pandas as pd

from config import CONTENT_SAMPLE, PROCESSED_DIR, RAW_DIR, SEED, URL_SAMPLE_PER_SOURCE

from app.features import HTML_FEATURE_NAMES, URL_FEATURE_NAMES, canonicalize, extract_url_features, parse  # noqa: E402


def build_uci() -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / "uci_phishing_websites.csv")
    n0 = len(df)
    df = df.dropna()
    df["label"] = (df.pop("Result") == -1).astype(int)  # -1 = phishing in UCI
    dups = int(df.duplicated().sum())
    # Exact duplicate rows are common in UCI (ternary features). We keep them for
    # the canonical benchmark but report the count; train.py checks leakage.
    print(f"[uci] rows={n0} duplicates={dups} phishing_rate={df.label.mean():.3f}")
    return df.reset_index(drop=True)


def _sample_balanced(df: pd.DataFrame, per_source: int, rng: np.random.Generator) -> pd.DataFrame:
    half = per_source // 2
    parts = []
    for lab in (0, 1):
        sub = df[df.label == lab]
        take = min(half, len(sub))
        parts.append(sub.sample(n=take, random_state=int(rng.integers(1 << 31))))
    return pd.concat(parts)


def build_url(rng: np.random.Generator) -> pd.DataFrame:
    phi = pd.read_csv(RAW_DIR / "phiusiil.csv", encoding="utf-8-sig", usecols=["URL", "label"])
    phi = pd.DataFrame({"url": phi.URL, "label": (phi.label == 0).astype(int), "source": "phiusiil"})
    fz = pd.read_csv(RAW_DIR / "url_paths.csv")
    fz = pd.DataFrame({"url": fz.url, "label": (fz.label == "bad").astype(int), "source": "url_paths"})
    df = pd.concat([phi, fz], ignore_index=True).dropna(subset=["url"])
    df["url"] = df.url.astype(str).str.strip()
    df = df[df.url.str.len().between(4, 2048)]
    df["canonical"] = df.url.map(canonicalize)
    # Remove conflicting labels for the same canonical URL, then exact dupes.
    conflict = df.groupby("canonical").label.nunique()
    bad = set(conflict[conflict > 1].index)
    print(f"[url] raw={len(df)} conflicting_canonical={len(bad)}")
    df = df[~df.canonical.isin(bad)].drop_duplicates("canonical")
    df = pd.concat(
        [_sample_balanced(g, URL_SAMPLE_PER_SOURCE, rng) for _, g in df.groupby("source")],
        ignore_index=True,
    )
    t0 = time.perf_counter()
    feats = pd.DataFrame([extract_url_features(u) for u in df.url], columns=list(URL_FEATURE_NAMES))
    print(f"[url] extracted {len(df)} x {feats.shape[1]} features in {time.perf_counter() - t0:.1f}s")
    df["registered_domain"] = df.url.map(lambda u: parse(u).registered_domain)
    out = pd.concat([df[["url", "canonical", "registered_domain", "source", "label"]].reset_index(drop=True), feats], axis=1)
    print(f"[url] final={len(out)} phishing_rate={out.label.mean():.3f} by source:\n{out.groupby('source').label.agg(['count', 'mean'])}")
    return out


def build_content(rng: np.random.Generator) -> pd.DataFrame:
    cols = ["URL", "label", *HTML_FEATURE_NAMES]
    phi = pd.read_csv(RAW_DIR / "phiusiil.csv", encoding="utf-8-sig", usecols=cols)
    phi["label"] = (phi.label == 0).astype(int)
    phi = phi.dropna().drop_duplicates(subset=["URL"])
    phi = _sample_balanced(phi, CONTENT_SAMPLE, rng)
    phi["registered_domain"] = phi.URL.map(lambda u: parse(u).registered_domain)
    phi = phi.rename(columns={"URL": "url"})
    out = phi[["url", "registered_domain", "label", *HTML_FEATURE_NAMES]].reset_index(drop=True)
    print(f"[content] final={len(out)} phishing_rate={out.label.mean():.3f}")
    return out


def main() -> None:
    rng = np.random.default_rng(SEED)
    stats = {}
    for name, fn in (("uci", lambda: build_uci()), ("url", lambda: build_url(rng)), ("content", lambda: build_content(rng))):
        df = fn()
        df.to_parquet(PROCESSED_DIR / f"{name}.parquet", index=False)
        stats[name] = {"rows": int(len(df)), "phishing_rate": round(float(df.label.mean()), 4)}
    (PROCESSED_DIR / "stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
