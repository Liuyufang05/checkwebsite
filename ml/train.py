"""Train, tune, cross-validate and compare all models on every feature set,
explain the best model with SHAP, run robustness/leakage checks and save
versioned artefacts.

Usage:
    python ml/train.py                       # all feature sets
    python ml/train.py --sets uci url        # subset
    PG_FAST=1 python ml/train.py             # quick smoke run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import optuna  # noqa: E402
import pandas as pd  # noqa: E402
import shap  # noqa: E402
import sklearn  # noqa: E402
from sklearn.base import clone  # noqa: E402
from sklearn.calibration import calibration_curve  # noqa: E402
from sklearn.inspection import permutation_importance  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import (  # noqa: E402
    StratifiedGroupKFold,
    StratifiedKFold,
    cross_validate,
    train_test_split,
)

import config  # noqa: E402
from config import (  # noqa: E402
    CV_FOLDS,
    FIG_DIR,
    MODELS_DIR,
    N_TRIALS,
    PROCESSED_DIR,
    REPORTS_DIR,
    SEED,
    TEST_SIZE,
    TUNE_SAMPLE,
)
from models import TREE_MODELS, build_ensembles, zoo  # noqa: E402

from app.features import (  # noqa: E402
    FEATURE_SCHEMA_VERSION,
    HTML_FEATURE_NAMES,
    URL_FEATURE_NAMES,
    extract_url_features,
    lists_fingerprint,
)

warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)

CV_MAX = int(__import__("os").environ.get("PG_CV_MAX", 4000 if config.FAST else 20000))
TUNE_TIMEOUT = int(__import__("os").environ.get("PG_TUNE_TIMEOUT", 20 if config.FAST else 120))
SLOW = {"svm": 0.5, "gb": 0.5, "mlp": 0.5, "rf": 0.6, "knn": 0.6}  # trial budget multipliers

UCI_FEATURES = [
    "having_IP_Address", "URL_Length", "Shortining_Service", "having_At_Symbol",
    "double_slash_redirecting", "Prefix_Suffix", "having_Sub_Domain", "SSLfinal_State",
    "Domain_registeration_length", "Favicon", "port", "HTTPS_token", "Request_URL",
    "URL_of_Anchor", "Links_in_tags", "SFH", "Submitting_to_email", "Abnormal_URL",
    "Redirect", "on_mouseover", "RightClick", "popUpWidnow", "Iframe", "age_of_domain",
    "DNSRecord", "web_traffic", "Page_Rank", "Google_Index", "Links_pointing_to_page",
    "Statistical_report",
]
SIZE_FEATURES = ["LineOfCode", "LargestLineLength", "NoOfImage", "NoOfCSS", "NoOfJS", "NoOfSelfRef", "NoOfExternalRef"]

FEATURE_SETS = {
    "uci": {
        "title": "UCI Phishing Websites - 30 engineered ternary features",
        "role": "comparison",
        "features": UCI_FEATURES,
        "group": None,
        "log": False,
        "live": False,
        "note": "Several features (web_traffic, Page_Rank, Google_Index, Links_pointing_to_page, Statistical_report) "
        "depend on discontinued services (Alexa, PageRank) and cannot be recomputed live, so this model is for "
        "benchmark comparison only.",
    },
    "url": {
        "title": "Live URL lexical - 44 features recomputed from PhiUSIIL + URL-paths URLs",
        "role": "live",
        "features": list(URL_FEATURE_NAMES),
        "group": "registered_domain",
        "log": True,
        "live": True,
        "note": "Computed by backend/app/features/url_features.py from canonicalised URLs; split by registered "
        "domain so no site appears in both train and test.",
    },
    "content": {
        "title": "Live HTML content - 24 PhiUSIIL HTML features reproducible from a fetched page",
        "role": "live",
        "features": list(HTML_FEATURE_NAMES),
        "group": "registered_domain",
        "log": True,
        "live": True,
        "note": "Same column definitions as PhiUSIIL, recomputed live by backend/app/features/html_features.py.",
    },
}

# Illustrative real-world sanity suite for the URL model (not used for selection).
SANITY_URLS = [
    ("https://github.com/demonmj/phishing-detector", 0), ("https://en.wikipedia.org/wiki/Phishing", 0),
    ("https://docs.python.org/3/library/urllib.parse.html", 0), ("https://www.bbc.com/news/technology", 0),
    ("https://stackoverflow.com/questions/231767/what-does-the-yield-keyword-do", 0),
    ("https://www.presidencyuniversity.in/", 0), ("https://www.irctc.co.in/nget/train-search", 0),
    ("https://www.flipkart.com/search?q=laptop", 0), ("https://news.ycombinator.com/item?id=1", 0),
    ("https://www.nytimes.com/section/world", 0), ("https://medium.com/@user/my-first-post-abc123", 0),
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 0),
    ("http://paypal-secure-login.xyz/verify/account.php", 1), ("https://metamask-wallet-restore.web.app/", 1),
    ("http://192.168.4.20/login/bank/", 1), ("https://secure-update-appleid.com.sign-in.top/", 1),
    ("https://microsoft-office365-login.godaddysites.com/", 1),
    ("http://www.chase.com.secure-verify.ru/login.php?session=abc123", 1),
    ("http://amaz0n-account-billing-update.com/signin", 1), ("https://netflix-payment-failed.weebly.com/", 1),
    ("http://xn--pple-43d.com/id/login", 1), ("https://dhl-parcel-redelivery-fee.top/track?id=93821", 1),
    ("http://login.microsoftonline.com.auth-session.cf/owa/", 1), ("https://sbi-kyc-update-online.in.net/verify.php", 1),
]


# ----------------------------------------------------------------------------- helpers
def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def to_xy(df: pd.DataFrame, feats: list[str]):
    return df[feats].to_numpy(dtype=float), df["label"].to_numpy(dtype=int)


def cap(X, y, g, n, seed=SEED):
    if n is None or len(y) <= n:
        return X, y, g
    idx, _ = train_test_split(np.arange(len(y)), train_size=n, stratify=y, random_state=seed)
    return X[idx], y[idx], (g[idx] if g is not None else None)


def splitter(groups, n_splits):
    if groups is not None:
        return StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=SEED)
    return StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=SEED)


def proba(model, X):
    return model.predict_proba(X)[:, 1]


def metrics(y, p, thr=0.5) -> dict:
    yhat = (p >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, yhat, labels=[0, 1]).ravel()
    return {
        "accuracy": accuracy_score(y, yhat),
        "precision": precision_score(y, yhat, zero_division=0),
        "recall": recall_score(y, yhat, zero_division=0),
        "f1": f1_score(y, yhat, zero_division=0),
        "roc_auc": roc_auc_score(y, p) if len(set(y)) > 1 else float("nan"),
        "pr_auc": average_precision_score(y, p) if len(set(y)) > 1 else float("nan"),
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]],
    }


def curves(y, p) -> dict:
    fpr, tpr, _ = roc_curve(y, p)
    grid = np.linspace(0, 1, 101)
    roc_t = np.interp(grid, fpr, tpr)
    prec, rec, _ = precision_recall_curve(y, p)
    order = np.argsort(rec)
    pr_p = np.interp(grid, rec[order], prec[order])
    return {"fpr": grid.round(3).tolist(), "tpr": roc_t.round(4).tolist(), "recall": grid.round(3).tolist(), "precision": pr_p.round(4).tolist()}


def rnd(d):
    if isinstance(d, dict):
        return {k: rnd(v) for k, v in d.items()}
    if isinstance(d, (list, tuple)):
        return [rnd(v) for v in d]
    if isinstance(d, (np.floating, float)):
        return None if np.isnan(d) else round(float(d), 5)
    if isinstance(d, np.integer):
        return int(d)
    return d


def jsonable_params(p: dict) -> dict:
    return {k: (list(v) if isinstance(v, tuple) else v) for k, v in p.items()}


# ----------------------------------------------------------------------------- tuning
def tune(spec, X, y, g) -> tuple[dict, float]:
    if spec.space is None:
        return dict(spec.defaults), float("nan")
    Xs, ys, gs = cap(X, y, g, min(TUNE_SAMPLE, spec.max_train or TUNE_SAMPLE))
    cv = splitter(gs, 3)
    extra = {"probability": False} if spec.short == "svm" else {}

    def objective(trial):
        params = spec.space(trial)
        model = spec.build({**params, **extra})
        s = cross_validate(model, Xs, ys, groups=gs, cv=cv, scoring="roc_auc", n_jobs=1)
        return float(np.mean(s["test_score"]))

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=SEED))
    study.enqueue_trial({k: v for k, v in spec.defaults.items() if k not in ("hidden",)}, skip_if_exists=True)
    n = max(3, int(N_TRIALS * SLOW.get(spec.short, 1.0)))
    study.optimize(objective, n_trials=n, timeout=TUNE_TIMEOUT, catch=(Exception,))
    if not any(tr.state == optuna.trial.TrialState.COMPLETE for tr in study.trials):
        log(f"  ! tuning failed for {spec.name}; using defaults")
        return dict(spec.defaults), float("nan")
    # Rebuild the param dict exactly as the search space returns it.
    best = spec.space(optuna.trial.FixedTrial(study.best_trial.params))
    return best, study.best_value


# ----------------------------------------------------------------------------- evaluation
def evaluate(name, short, model, Xtr, ytr, gtr, Xte, yte, max_train, params) -> tuple[dict, object]:
    # 5-fold CV on (a capped sample of) the training set
    Xc, yc, gc = cap(Xtr, ytr, gtr, min(CV_MAX, max_train or CV_MAX))
    cvres = cross_validate(
        clone(model), Xc, yc, groups=gc, cv=splitter(gc, CV_FOLDS),
        scoring=["accuracy", "precision", "recall", "f1", "roc_auc"], n_jobs=1,
    )
    cv = {m: {"mean": float(np.mean(cvres[f"test_{m}"])), "std": float(np.std(cvres[f"test_{m}"]))}
          for m in ("accuracy", "precision", "recall", "f1", "roc_auc")}

    Xf, yf, _ = cap(Xtr, ytr, None, max_train)
    t0 = time.perf_counter()
    fitted = clone(model).fit(Xf, yf)
    train_time = time.perf_counter() - t0

    t0 = time.perf_counter()
    p = proba(fitted, Xte)
    batch = time.perf_counter() - t0
    lat = []
    for i in range(25):
        t1 = time.perf_counter()
        proba(fitted, Xte[i:i + 1])
        lat.append(time.perf_counter() - t1)

    res = {
        "name": name, "key": short, "params": jsonable_params(params), "n_train": int(len(yf)),
        "cv": cv, "test": metrics(yte, p), "train_time_s": train_time,
        "inference_ms_per_1k": batch / len(yte) * 1000 * 1000, "latency_ms_single": float(np.median(lat) * 1000),
        "curves": curves(yte, p),
    }
    return res, fitted


# ----------------------------------------------------------------------------- explainability
def underlying(model):
    return model.steps[-1][1] if hasattr(model, "steps") else model


def explainer_kind(name: str) -> str:
    return "tree" if name in TREE_MODELS else "permutation"


def shap_analysis(name, model, Xtr, Xte, feats, set_key) -> dict:
    rng = np.random.default_rng(SEED)
    kind = explainer_kind(name)
    if kind == "tree":
        Xe = Xte[rng.choice(len(Xte), size=min(1500, len(Xte)), replace=False)]
        ex = shap.TreeExplainer(underlying(model))
        sv = ex.shap_values(Xe)
        if isinstance(sv, list):
            sv = sv[1]
        sv = np.asarray(sv)
        if sv.ndim == 3:
            sv = sv[:, :, 1]
    else:
        bg = Xtr[rng.choice(len(Xtr), size=min(100, len(Xtr)), replace=False)]
        Xe = Xte[rng.choice(len(Xte), size=min(250, len(Xte)), replace=False)]
        ex = shap.Explainer(lambda x: model.predict_proba(x)[:, 1], shap.maskers.Independent(bg), algorithm="permutation")
        sv = ex(Xe, max_evals=2 * len(feats) + 1, silent=True).values
    mean_abs = np.abs(sv).mean(axis=0)
    order = np.argsort(-mean_abs)

    plt.figure()
    shap.summary_plot(sv, Xe, feature_names=feats, show=False, max_display=15)
    plt.title(f"SHAP summary - {name} ({set_key})")
    plt.tight_layout()
    plt.savefig(FIG_DIR / f"shap_beeswarm_{set_key}.png", dpi=130)
    plt.close("all")

    points = {}
    for j in order[:12]:
        col = Xe[:, j]
        lo, hi = np.percentile(col, 2), np.percentile(col, 98)
        norm = np.clip((col - lo) / (hi - lo), 0, 1) if hi > lo else np.full_like(col, 0.5)
        idx = rng.choice(len(col), size=min(120, len(col)), replace=False)
        points[feats[j]] = [[round(float(sv[i, j]), 4), round(float(norm[i]), 3)] for i in idx]
    return {
        "explainer": kind,
        "n_explained": int(len(Xe)),
        "mean_abs": [{"feature": feats[j], "value": float(mean_abs[j])} for j in order],
        "beeswarm": points,
    }


def importance(name, model, Xte, yte, feats) -> list[dict]:
    m = underlying(model)
    if hasattr(m, "feature_importances_") and not hasattr(model, "steps"):
        imp = np.asarray(m.feature_importances_, dtype=float)
        method = "impurity/gain"
    else:
        n = min(3000, len(yte))
        idx = np.random.default_rng(SEED).choice(len(yte), size=n, replace=False)  # test rows are label-ordered
        r = permutation_importance(model, Xte[idx], yte[idx], scoring="roc_auc", n_repeats=5, random_state=SEED, n_jobs=1)
        imp = np.clip(r.importances_mean, 0, None)
        method = "permutation (ROC-AUC drop)"
    imp = imp / imp.sum() if imp.sum() > 0 else imp
    order = np.argsort(-imp)
    return [{"feature": feats[i], "value": float(imp[i]), "method": method} for i in order]


# ----------------------------------------------------------------------------- robustness
def single_feature_auc(df, feats) -> list[dict]:
    out = []
    for f in feats:
        try:
            a = roc_auc_score(df.label, df[f])
            out.append({"feature": f, "auc": max(a, 1 - a)})
        except ValueError:
            pass
    return sorted(out, key=lambda d: -d["auc"])


def calib(y, p) -> dict:
    frac, mean = calibration_curve(y, p, n_bins=10, strategy="quantile")
    thr = {f"{t:.1f}": {k: v for k, v in metrics(y, p, t).items() if k in ("precision", "recall", "f1")}
           for t in (0.3, 0.4, 0.5, 0.6, 0.7, 0.8)}
    return {"brier": brier_score_loss(y, p), "reliability": {"mean_pred": mean.tolist(), "frac_pos": frac.tolist()}, "thresholds": thr}


def robustness(key, cfg, df, best_name, best_model, fitted_best, Xtr, ytr, Xte, yte, te_idx, tr_idx) -> dict:
    feats = cfg["features"]
    out = {"calibration": calib(yte, proba(fitted_best, Xte))}
    p_best = proba(fitted_best, Xte)

    if key == "uci":
        tr_rows = set(map(tuple, Xtr.astype(int)))
        seen = np.array([tuple(r) in tr_rows for r in Xte.astype(int)])
        out["duplicate_leakage"] = {
            "dataset_duplicate_rows": int(df.duplicated(subset=feats + ["label"]).sum()),
            "test_rows_also_in_train": int(seen.sum()),
            "test_rows_also_in_train_pct": float(seen.mean()),
            "metrics_all_test": metrics(yte, p_best),
            "metrics_unseen_test_only": metrics(yte[~seen], p_best[~seen]),
        }
        dd = df.drop_duplicates(subset=feats + ["label"])
        X, y = to_xy(dd, feats)
        a, b, ya, yb = train_test_split(X, y, test_size=TEST_SIZE, stratify=y, random_state=SEED)
        m = clone(best_model).fit(a, ya)
        out["deduplicated_benchmark"] = {"rows": int(len(dd)), "metrics": metrics(yb, proba(m, b))}

    if cfg["group"]:
        # Random split (domain leakage allowed) vs grouped split.
        X, y = to_xy(df, feats)
        a, b, ya, yb = train_test_split(X, y, test_size=TEST_SIZE, stratify=y, random_state=SEED)
        a, ya, _ = cap(a, ya, None, len(Xtr))
        m = clone(best_model).fit(a, ya)
        out["split_comparison"] = {
            "random_split": metrics(yb, proba(m, b)),
            "domain_grouped_split": metrics(yte, p_best),
            "explanation": "Random splits let pages from the same registered domain land in both train and test, inflating scores.",
        }
        out["single_feature_auc"] = single_feature_auc(df, feats)[:12]

    if key == "url":
        te = df.iloc[te_idx]
        out["per_source"] = {s: metrics(yte[(te.source == s).values], p_best[(te.source == s).values])
                             for s in sorted(df.source.unique())}
        cross = {}
        for src, dst in (("phiusiil", "url_paths"), ("url_paths", "phiusiil")):
            a = df[df.source == src]
            b = df[df.source == dst]
            Xa, ya = to_xy(a, feats)
            Xb, yb = to_xy(b, feats)
            Xa, ya, _ = cap(Xa, ya, None, 30000)
            m = clone(best_model).fit(Xa, ya)
            cross[f"train_{src}__test_{dst}"] = metrics(yb, proba(m, Xb))
        out["cross_dataset"] = cross
        Xs = np.array([[extract_url_features(u)[f] for f in feats] for u, _ in SANITY_URLS])
        ys = np.array([lab for _, lab in SANITY_URLS])
        ps = proba(fitted_best, Xs)
        out["sanity_suite"] = {
            "note": "Hand-picked illustrative URLs (not used for training or selection).",
            "accuracy": float(((ps >= 0.5).astype(int) == ys).mean()),
            "items": [{"url": u, "label": int(lab), "p_phishing": float(pp)} for (u, lab), pp in zip(SANITY_URLS, ps)],
        }

    if key == "content":
        keep = [f for f in feats if f not in SIZE_FEATURES]
        idx = [feats.index(f) for f in keep]
        m = clone(best_model).fit(Xtr[:, idx], ytr)
        out["ablation_without_size_features"] = {
            "removed": SIZE_FEATURES,
            "metrics": metrics(yte, proba(m, Xte[:, idx])),
            "explanation": "PhiUSIIL legitimate pages are full homepages while phishing pages are small kits; page-size "
            "counts alone nearly separate the classes. Removing them shows how much signal remains.",
        }
    return out


# ----------------------------------------------------------------------------- plots
PALETTE = ["#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#f87171", "#c084fc", "#2dd4bf", "#fb923c", "#e879f9", "#a3e635"]


def plots(key, results):
    names = [r["name"] for r in results]
    fig, ax = plt.subplots(figsize=(12, 5))
    ms = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    w = 0.16
    for i, m in enumerate(ms):
        ax.bar(np.arange(len(names)) + i * w, [r["test"][m] for r in results], w, label=m, color=PALETTE[i])
    ax.set_xticks(np.arange(len(names)) + 2 * w)
    ax.set_xticklabels(names, rotation=30, ha="right")
    lo = min(r["test"][m] for r in results for m in ms)
    ax.set_ylim(max(0, lo - 0.05), 1.0)
    ax.legend(ncol=5, loc="lower center")
    ax.set_title(f"Held-out test metrics - {key}")
    fig.tight_layout()
    fig.savefig(FIG_DIR / f"metrics_{key}.png", dpi=130)

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    for i, r in enumerate(results):
        c = r["curves"]
        axes[0].plot(c["fpr"], c["tpr"], color=PALETTE[i % 12], label=f"{r['name']} ({r['test']['roc_auc']:.3f})")
        axes[1].plot(c["recall"], c["precision"], color=PALETTE[i % 12], label=f"{r['name']} ({r['test']['pr_auc']:.3f})")
    axes[0].plot([0, 1], [0, 1], "k--", lw=0.8)
    axes[0].set(xlabel="FPR", ylabel="TPR", title=f"ROC - {key}")
    axes[1].set(xlabel="Recall", ylabel="Precision", title=f"Precision-Recall - {key}")
    axes[0].legend(fontsize=7)
    axes[1].legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(FIG_DIR / f"roc_pr_{key}.png", dpi=130)

    n = len(results)
    cols = 4
    fig, axes = plt.subplots(int(np.ceil(n / cols)), cols, figsize=(14, 3.4 * np.ceil(n / cols)))
    for ax, r in zip(axes.ravel(), results):
        cm = np.array(r["test"]["confusion_matrix"])
        ax.imshow(cm, cmap="viridis")
        for (i, j), v in np.ndenumerate(cm):
            ax.text(j, i, str(v), ha="center", va="center", color="white" if v < cm.max() / 2 else "black")
        ax.set_title(r["name"], fontsize=9)
        ax.set_xticks([0, 1], ["legit", "phish"])
        ax.set_yticks([0, 1], ["legit", "phish"])
    for ax in axes.ravel()[n:]:
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(FIG_DIR / f"confusion_{key}.png", dpi=110)
    plt.close("all")


# ----------------------------------------------------------------------------- main loop
def run_set(key: str) -> dict:
    cfg = FEATURE_SETS[key]
    feats = cfg["features"]
    df = pd.read_parquet(PROCESSED_DIR / f"{key}.parquet")
    X, y = to_xy(df, feats)
    groups = df[cfg["group"]].to_numpy() if cfg["group"] else None
    log(f"== {key}: {len(df)} rows x {len(feats)} features")

    if groups is not None:
        sgkf = StratifiedGroupKFold(n_splits=int(round(1 / TEST_SIZE)), shuffle=True, random_state=SEED)
        tr_idx, te_idx = next(sgkf.split(X, y, groups))
        assert not set(groups[tr_idx]) & set(groups[te_idx]), "domain leakage between train and test"
    else:
        tr_idx, te_idx = train_test_split(np.arange(len(y)), test_size=TEST_SIZE, stratify=y, random_state=SEED)
    Xtr, ytr, Xte, yte = X[tr_idx], y[tr_idx], X[te_idx], y[te_idx]
    gtr = groups[tr_idx] if groups is not None else None

    results, fitted, tuned_models = [], {}, {}
    for spec in zoo(cfg["log"]):
        t0 = time.perf_counter()
        params, tune_auc = tune(spec, Xtr, ytr, gtr)
        model = spec.build(dict(params))
        tuned_models[spec.name] = model
        res, fm = evaluate(spec.name, spec.short, model, Xtr, ytr, gtr, Xte, yte, spec.max_train, params)
        res["tune_cv_roc_auc"] = tune_auc
        results.append(res)
        fitted[spec.name] = fm
        log(f"  {spec.name:<22} cvF1={res['cv']['f1']['mean']:.4f} testF1={res['test']['f1']:.4f} "
            f"AUC={res['test']['roc_auc']:.4f} ({time.perf_counter() - t0:.0f}s)")

    for name, short, ens in build_ensembles(tuned_models):
        t0 = time.perf_counter()
        res, fm = evaluate(name, short, ens, Xtr, ytr, gtr, Xte, yte, None, {"base": ["rf", "xgb", "lgbm"]})
        results.append(res)
        fitted[name] = fm
        tuned_models[name] = ens
        log(f"  {name:<22} cvF1={res['cv']['f1']['mean']:.4f} testF1={res['test']['f1']:.4f} "
            f"AUC={res['test']['roc_auc']:.4f} ({time.perf_counter() - t0:.0f}s)")

    # Model selection uses cross-validation only (never the test set).
    best = max(results, key=lambda r: (round(r["cv"]["f1"]["mean"], 4), r["cv"]["roc_auc"]["mean"]))
    best_name = best["name"]
    log(f"  best by CV F1: {best_name}")
    fm = fitted[best_name]

    # Analysis steps are fail-soft: an error here must never discard trained models.
    def safe(name, fn, default):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            log(f"  ! {name} failed: {type(exc).__name__}: {exc}")
            return default

    shap_res = safe("SHAP", lambda: shap_analysis(best_name, fm, Xtr, Xte, feats, key),
                    {"explainer": explainer_kind(best_name), "n_explained": 0, "mean_abs": [], "beeswarm": {}})
    imp = safe("importance", lambda: importance(best_name, fm, Xte, yte, feats), [])
    rob = safe("robustness", lambda: robustness(key, cfg, df, best_name, tuned_models[best_name], fm, Xtr, ytr, Xte, yte, te_idx, tr_idx),
               {"calibration": calib(yte, proba(fm, Xte))})
    safe("plots", lambda: plots(key, results), None)

    return {
        "key": key, **{k: cfg[k] for k in ("title", "role", "note", "live")},
        "features": feats, "n_rows": int(len(df)), "n_train": int(len(tr_idx)), "n_test": int(len(te_idx)),
        "split": "stratified group (registered domain)" if groups is not None else "stratified random",
        "phishing_rate": float(y.mean()), "models": results, "best": best_name,
        "shap": shap_res, "importance": imp, "robustness": rob,
        "_fitted": fm, "_bg": Xtr[np.random.default_rng(SEED).choice(len(Xtr), size=min(100, len(Xtr)), replace=False)],
    }


def save_artifacts(out: dict[str, dict]) -> str:
    version = datetime.now(timezone.utc).strftime("v%Y%m%d-%H%M%S")
    vdir = MODELS_DIR / version
    vdir.mkdir(parents=True)
    files = {}
    for key, r in out.items():
        fm = r["_fitted"]
        bundle = {
            "model": fm, "name": r["best"], "features": r["features"], "feature_set": key,
            "explainer": explainer_kind(r["best"]), "background": r["_bg"],
            "feature_schema_version": FEATURE_SCHEMA_VERSION, "lists_fingerprint": lists_fingerprint(),
        }
        path = vdir / f"{key}_model.joblib"
        joblib.dump(bundle, path, compress=3)
        files[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        if hasattr(fm, "named_steps") and "scaler" in fm.named_steps:
            sp = vdir / f"{key}_scaler.joblib"
            joblib.dump(fm.named_steps["scaler"], sp)
            files[sp.name] = hashlib.sha256(sp.read_bytes()).hexdigest()
    # When only a subset was retrained, carry the other bundles over from the
    # previous version so the backend always finds every model.
    prev_meta = {}
    latest = MODELS_DIR / "latest.json"
    if latest.exists():
        pdir = MODELS_DIR / json.loads(latest.read_text())["version"]
        if (pdir / "metadata.json").exists():
            prev_meta = json.loads((pdir / "metadata.json").read_text()).get("models", {})
        for key in FEATURE_SETS:
            src = pdir / f"{key}_model.joblib"
            if key not in out and src.exists():
                for f in pdir.glob(f"{key}_*.joblib"):
                    (vdir / f.name).write_bytes(f.read_bytes())
                    files[f.name] = hashlib.sha256(f.read_bytes()).hexdigest()
    carried = {k: v for k, v in prev_meta.items() if k not in out and (vdir / f"{k}_model.joblib").exists()}
    meta = {
        "version": version,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "lists_fingerprint": lists_fingerprint(),
        "libraries": {"python": platform.python_version(), "scikit-learn": sklearn.__version__,
                      "xgboost": __import__("xgboost").__version__, "lightgbm": __import__("lightgbm").__version__,
                      "numpy": np.__version__, "shap": shap.__version__},
        "models": {k: {"best": r["best"], "role": r["role"], "features": r["features"],
                       "test": rnd({m: v for m, v in next(x for x in r["models"] if x["name"] == r["best"])["test"].items()})}
                   for k, r in out.items()} | carried,
        "sha256": files,
        "fast_mode": config.FAST,
    }
    (vdir / "metadata.json").write_text(json.dumps(meta, indent=2))
    (MODELS_DIR / "latest.json").write_text(json.dumps({"version": version}, indent=2))
    return version


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sets", nargs="+", default=list(FEATURE_SETS), choices=list(FEATURE_SETS))
    args = ap.parse_args()
    t0 = time.perf_counter()
    out = {k: run_set(k) for k in args.sets}

    # Merge with previously saved results when training a subset.
    res_path = REPORTS_DIR / "results.json"
    prev = json.loads(res_path.read_text()) if res_path.exists() else {"feature_sets": {}}
    if set(args.sets) != set(FEATURE_SETS):
        missing = set(FEATURE_SETS) - set(args.sets)
        log(f"note: only trained {args.sets}; artefacts for {sorted(missing)} are not re-saved")
    version = save_artifacts(out)

    for k, r in out.items():
        rows = [{"model": m["name"], **{f"cv_{x}": m["cv"][x]["mean"] for x in m["cv"]},
                 **{f"test_{x}": v for x, v in m["test"].items() if x != "confusion_matrix"},
                 "train_time_s": m["train_time_s"], "inference_ms_per_1k": m["inference_ms_per_1k"],
                 "latency_ms_single": m["latency_ms_single"]} for m in r["models"]]
        pd.DataFrame(rows).round(5).to_csv(REPORTS_DIR / f"results_{k}.csv", index=False)
        prev["feature_sets"][k] = rnd({kk: vv for kk, vv in r.items() if not kk.startswith("_")})

    prev.update({
        "model_version": version,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "fast_mode": config.FAST,
        "config": {"seed": SEED, "test_size": TEST_SIZE, "cv_folds": CV_FOLDS, "tuning": "Optuna TPE, 3-fold CV on a stratified sample",
                   "tune_sample": TUNE_SAMPLE, "n_trials": N_TRIALS, "cv_max_rows": CV_MAX,
                   "svm_max_train": config.SVM_MAX_TRAIN, "knn_max_train": config.KNN_MAX_TRAIN},
    })
    res_path.write_text(json.dumps(prev, indent=1))
    log(f"saved model version {version}; total {time.perf_counter() - t0:.0f}s")


if __name__ == "__main__":
    main()
