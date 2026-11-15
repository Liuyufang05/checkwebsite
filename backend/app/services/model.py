"""Loads the versioned model bundles produced by ml/train.py and explains
individual predictions with SHAP."""

from __future__ import annotations

import gzip
import json
import logging
import threading
from pathlib import Path

import joblib
import numpy as np

from ..features import FEATURE_SCHEMA_VERSION, lists_fingerprint
from ..features.descriptions import describe

log = logging.getLogger("phishguard.model")
STATIC_DIR = Path(__file__).resolve().parents[1] / "data"


class ModelRegistry:
    def __init__(self, models_dir: Path):
        self.models_dir = Path(models_dir)
        self.version: str | None = None
        self.bundles: dict[str, dict] = {}
        self.metadata: dict = {}
        self.warnings: list[str] = []
        self._explainers: dict[str, object] = {}
        self._lock = threading.Lock()
        self.reputable: frozenset[str] = frozenset()

    # ------------------------------------------------------------------ loading
    def load(self) -> None:
        self.bundles.clear()
        self._explainers.clear()
        self.warnings.clear()
        latest = self.models_dir / "latest.json"
        if not latest.exists():
            self.warnings.append(f"No trained models found in {self.models_dir}. Run scripts/train.ps1 (or train.sh).")
        else:
            self.version = json.loads(latest.read_text())["version"]
            vdir = self.models_dir / self.version
            meta = vdir / "metadata.json"
            self.metadata = json.loads(meta.read_text()) if meta.exists() else {}
            for key in ("url", "content"):
                path = vdir / f"{key}_model.joblib"
                if not path.exists():
                    self.warnings.append(f"{key} model missing in {vdir.name}")
                    continue
                bundle = joblib.load(path)
                if bundle.get("feature_schema_version") != FEATURE_SCHEMA_VERSION:
                    self.warnings.append(f"{key}: feature schema {bundle.get('feature_schema_version')} != {FEATURE_SCHEMA_VERSION}; retrain.")
                if bundle.get("lists_fingerprint") != lists_fingerprint():
                    self.warnings.append(f"{key}: keyword lists changed since training; retrain for exact parity.")
                self.bundles[key] = bundle
                log.info("loaded %s model %s (%s)", key, bundle["name"], self.version)
        rep = STATIC_DIR / "reputable_domains.txt.gz"
        if rep.exists():
            with gzip.open(rep, "rt", encoding="utf-8") as fh:
                self.reputable = frozenset(line.strip() for line in fh if line.strip())

    @property
    def ready(self) -> bool:
        return "url" in self.bundles

    def info(self) -> dict:
        return {
            "version": self.version,
            "loaded": {k: b["name"] for k, b in self.bundles.items()},
            "warnings": self.warnings,
            "reputable_domains": len(self.reputable),
        }

    # ------------------------------------------------------------------ inference
    def predict(self, key: str, features: dict[str, float]) -> float:
        b = self.bundles[key]
        x = np.array([[features[f] for f in b["features"]]], dtype=float)
        return float(b["model"].predict_proba(x)[0, 1])

    def _explainer(self, key: str):
        with self._lock:
            if key in self._explainers:
                return self._explainers[key]
            import shap

            b = self.bundles[key]
            model = b["model"]
            if b["explainer"] == "tree":
                inner = model.steps[-1][1] if hasattr(model, "steps") else model
                ex = ("tree", shap.TreeExplainer(inner))
            else:
                bg = np.asarray(b["background"])[:50]
                ex = ("perm", shap.Explainer(lambda z: model.predict_proba(z)[:, 1], shap.maskers.Independent(bg), algorithm="permutation"))
            self._explainers[key] = ex
            return ex

    def warmup(self) -> None:
        """Build explainers once at start-up so the first scan isn't slowed by SHAP initialisation."""
        for key, b in self.bundles.items():
            try:
                row = np.asarray(b["background"])[0]
                self.explain(key, dict(zip(b["features"], map(float, row))), top=1)
            except Exception as exc:  # noqa: BLE001
                log.warning("warm-up failed for %s: %s", key, exc)

    def explain(self, key: str, features: dict[str, float], top: int = 8) -> list[dict]:
        b = self.bundles[key]
        names = b["features"]
        x = np.array([[features[f] for f in names]], dtype=float)
        try:
            kind, ex = self._explainer(key)
            if kind == "tree":
                sv = ex.shap_values(x)
                if isinstance(sv, list):
                    sv = sv[1]
                sv = np.asarray(sv)
                if sv.ndim == 3:
                    sv = sv[:, :, 1]
                vals = sv[0]
                unit = "log-odds" if b["name"] in ("XGBoost", "LightGBM", "Gradient Boosting") else "probability"
            else:
                vals = ex(x, max_evals=2 * len(names) + 1, silent=True).values[0]
                unit = "probability"
        except Exception as exc:  # noqa: BLE001
            log.warning("SHAP failed for %s: %s", key, exc)
            return []
        order = np.argsort(-np.abs(vals))[:top]
        return [
            {
                "feature": names[i],
                "label": describe(names[i]),
                "value": float(x[0, i]),
                "shap": float(vals[i]),
                "unit": unit,
                "direction": "phishing" if vals[i] > 0 else "legitimate",
            }
            for i in order
            if abs(vals[i]) > 1e-6
        ]
