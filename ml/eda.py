"""Exploratory data analysis + dataset-artefact audit.

Writes PNG figures to ml/reports/figures/ and a JSON summary to
ml/reports/eda.json (served by the API and rendered by the frontend).
"""

from __future__ import annotations

import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import seaborn as sns  # noqa: E402
from sklearn.feature_selection import mutual_info_classif  # noqa: E402
from sklearn.metrics import roc_auc_score  # noqa: E402

from config import FIG_DIR, PROCESSED_DIR, RAW_DIR, REPORTS_DIR, SEED  # noqa: E402

from app.features import HTML_FEATURE_NAMES, URL_FEATURE_NAMES  # noqa: E402

sns.set_theme(style="darkgrid", context="notebook")
COLORS = {0: "#22d3ee", 1: "#f472b6"}


def class_balance(name, y) -> dict:
    vc = pd.Series(y).value_counts().sort_index()
    return {"legitimate": int(vc.get(0, 0)), "phishing": int(vc.get(1, 0))}


def corr_heatmap(df, feats, name):
    c = df[feats + ["label"]].corr(numeric_only=True).fillna(0)
    plt.figure(figsize=(max(8, len(feats) * 0.35), max(6, len(feats) * 0.3)))
    sns.heatmap(c, cmap="icefire", center=0, xticklabels=True, yticklabels=True, cbar_kws={"shrink": 0.6})
    plt.title(f"Pearson correlation - {name}")
    plt.tight_layout()
    plt.savefig(FIG_DIR / f"corr_{name}.png", dpi=110)
    plt.close()
    lab = c["label"].drop("label").sort_values(key=np.abs, ascending=False)
    pairs = []
    cf = c.loc[feats, feats]
    for i, a in enumerate(feats):
        for b in feats[i + 1:]:
            pairs.append((a, b, float(cf.loc[a, b])))
    pairs.sort(key=lambda t: -abs(t[2]))
    return {
        "label_correlation": [{"feature": k, "r": round(float(v), 4)} for k, v in lab.head(15).items()],
        "top_feature_pairs": [{"a": a, "b": b, "r": round(r, 4)} for a, b, r in pairs[:10]],
    }


def distributions(df, feats, name, k=9):
    sample = df.sample(min(len(df), 20000), random_state=SEED)
    mi = mutual_info_classif(sample[feats], sample.label, random_state=SEED)
    top = [feats[i] for i in np.argsort(-mi)[:k]]
    fig, axes = plt.subplots(3, 3, figsize=(13, 9))
    hist = {}
    for ax, f in zip(axes.ravel(), top):
        v = sample[f]
        lo, hi = np.percentile(v, 1), np.percentile(v, 99)
        bins = np.linspace(lo, hi if hi > lo else lo + 1, 30)
        hist[f] = {"bins": bins.round(4).tolist()}
        for lab in (0, 1):
            h, _ = np.histogram(sample.loc[sample.label == lab, f].clip(lo, hi), bins=bins, density=True)
            hist[f]["phishing" if lab else "legitimate"] = h.round(5).tolist()
            ax.hist(sample.loc[sample.label == lab, f].clip(lo, hi), bins=bins, alpha=0.6, density=True,
                    color=COLORS[lab], label="phishing" if lab else "legitimate")
        ax.set_title(f, fontsize=10)
    axes[0, 0].legend()
    fig.suptitle(f"Feature distributions (top-{k} by mutual information) - {name}")
    fig.tight_layout()
    fig.savefig(FIG_DIR / f"dist_{name}.png", dpi=110)
    plt.close()
    return {"mutual_info_top": [{"feature": feats[i], "mi": round(float(mi[i]), 4)} for i in np.argsort(-mi)[:15]], "histograms": hist}


def artefact_audit() -> dict:
    phi = pd.read_csv(RAW_DIR / "phiusiil.csv", encoding="utf-8-sig")
    phi["phishing"] = (phi.label == 0).astype(int)
    u = phi.URL.astype(str)
    stripped = u.str.replace(r"^https?://", "", regex=True)
    art = pd.DataFrame({
        "starts_https_www": u.str.startswith("https://www."),
        "has_path": stripped.str.contains("/"),
        "is_https": u.str.startswith("https"),
        "has_uppercase": u.str.contains("[A-Z]"),
    }).groupby(phi.phishing).mean()
    num = phi.select_dtypes("number").drop(columns=["label", "phishing"])
    aucs = []
    for c in num:
        a = roc_auc_score(phi.phishing, num[c])
        aucs.append({"feature": c, "auc": round(max(a, 1 - a), 4), "used_in_live_model": c in HTML_FEATURE_NAMES})
    aucs.sort(key=lambda d: -d["auc"])

    top = aucs[:20]
    plt.figure(figsize=(9, 7))
    plt.barh([d["feature"] for d in top][::-1], [d["auc"] for d in top][::-1],
             color=["#34d399" if d["used_in_live_model"] else "#f87171" for d in top][::-1])
    plt.axvline(0.95, ls="--", c="w", lw=0.8)
    plt.xlim(0.5, 1.0)
    plt.title("PhiUSIIL single-feature ROC-AUC (green = used by the live content model)")
    plt.tight_layout()
    plt.savefig(FIG_DIR / "leakage_single_feature_auc.png", dpi=120)
    plt.close()

    fz = pd.read_csv(RAW_DIR / "url_paths.csv")
    fz_s = fz.url.astype(str)
    return {
        "phiusiil_url_artefacts": {
            "legitimate": {k: round(float(v), 4) for k, v in art.loc[0].items()},
            "phishing": {k: round(float(v), 4) for k, v in art.loc[1].items()},
            "finding": "Every legitimate PhiUSIIL URL is a bare https://www.<domain> homepage. URL models trained on raw "
            "PhiUSIIL learn this artefact; we canonicalise URLs and add a second source of legitimate deep links.",
        },
        "url_paths_artefacts": {
            "has_path_legitimate": round(float(fz_s[fz.label == "good"].str.contains("/").mean()), 4),
            "has_path_phishing": round(float(fz_s[fz.label == "bad"].str.contains("/").mean()), 4),
        },
        "phiusiil_single_feature_auc": aucs,
    }


def main():
    summary = {"datasets": {}}
    sets = {
        "uci": (pd.read_parquet(PROCESSED_DIR / "uci.parquet"), None),
        "url": (pd.read_parquet(PROCESSED_DIR / "url.parquet"), list(URL_FEATURE_NAMES)),
        "content": (pd.read_parquet(PROCESSED_DIR / "content.parquet"), list(HTML_FEATURE_NAMES)),
    }
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.6))
    for ax, (name, (df, feats)) in zip(axes, sets.items()):
        feats = feats or [c for c in df.columns if c != "label"]
        cb = class_balance(name, df.label)
        ax.bar(["legitimate", "phishing"], [cb["legitimate"], cb["phishing"]], color=[COLORS[0], COLORS[1]])
        ax.set_title(name)
        summary["datasets"][name] = {
            "rows": int(len(df)), "n_features": len(feats), "class_balance": cb,
            "missing_values": int(df[feats].isna().sum().sum()),
            "duplicate_feature_rows": int(df.duplicated(subset=feats + ["label"]).sum()),
            "describe": df[feats].describe().T[["mean", "std", "min", "max"]].round(4).reset_index().rename(columns={"index": "feature"}).to_dict("records"),
            **corr_heatmap(df, feats, name),
            **distributions(df, feats, name),
        }
        if "source" in df:
            summary["datasets"][name]["by_source"] = df.groupby("source").label.agg(["count", "mean"]).round(4).reset_index().to_dict("records")
        print(f"[eda] {name}: done")
    fig.suptitle("Class balance after cleaning")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "class_balance.png", dpi=120)
    plt.close()
    summary["artefacts"] = artefact_audit()
    manifest = RAW_DIR / "manifest.json"
    if manifest.exists():
        summary["sources"] = json.loads(manifest.read_text())
    (REPORTS_DIR / "eda.json").write_text(json.dumps(summary, indent=1))
    print("[eda] wrote eda.json and figures")


if __name__ == "__main__":
    main()
