"""Model zoo + Optuna search spaces. Every model is compared under identical
conditions: same split, same CV folds, same tuning budget, same metrics."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import lightgbm as lgb
import optuna
from sklearn.ensemble import (
    GradientBoostingClassifier,
    RandomForestClassifier,
    StackingClassifier,
    VotingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from xgboost import XGBClassifier

from config import N_JOBS, SEED, SVM_MAX_TRAIN, KNN_MAX_TRAIN

from app.features.transforms import signed_log1p  # noqa: E402

TREE_MODELS = {"Decision Tree", "Random Forest", "Gradient Boosting", "XGBoost", "LightGBM"}


@dataclass
class ModelSpec:
    name: str
    short: str
    build: Callable[[dict], object]
    space: Callable[[optuna.Trial], dict] | None
    scaled: bool = False
    max_train: int | None = None
    defaults: dict = field(default_factory=dict)


def _wrap(clf, scaled: bool, log: bool):
    if not scaled:
        return clf
    steps = []
    if log:
        steps.append(("log", FunctionTransformer(signed_log1p, feature_names_out="one-to-one")))
    steps += [("scaler", StandardScaler()), ("clf", clf)]
    return Pipeline(steps)


def zoo(log_counts: bool) -> list[ModelSpec]:
    w = lambda clf, scaled: _wrap(clf, scaled, log_counts)  # noqa: E731
    return [
        ModelSpec(
            "Logistic Regression", "logreg",
            lambda p: w(LogisticRegression(max_iter=3000, random_state=SEED, **p), True),
            lambda t: {"C": t.suggest_float("C", 1e-3, 1e2, log=True)},
            scaled=True, defaults={"C": 1.0},
        ),
        ModelSpec(
            "Naive Bayes", "nb",
            lambda p: w(GaussianNB(**p), True),
            lambda t: {"var_smoothing": t.suggest_float("var_smoothing", 1e-11, 1e-3, log=True)},
            scaled=True, defaults={"var_smoothing": 1e-9},
        ),
        ModelSpec(
            "KNN", "knn",
            lambda p: w(KNeighborsClassifier(n_jobs=N_JOBS, **p), True),
            lambda t: {
                "n_neighbors": t.suggest_int("n_neighbors", 3, 41, step=2),
                "weights": t.suggest_categorical("weights", ["uniform", "distance"]),
                "p": t.suggest_categorical("p", [1, 2]),
            },
            scaled=True, max_train=KNN_MAX_TRAIN, defaults={"n_neighbors": 15, "weights": "distance", "p": 2},
        ),
        ModelSpec(
            "Decision Tree", "dt",
            lambda p: DecisionTreeClassifier(random_state=SEED, **p),
            lambda t: {
                "max_depth": t.suggest_int("max_depth", 3, 30),
                "min_samples_leaf": t.suggest_int("min_samples_leaf", 1, 50),
                "criterion": t.suggest_categorical("criterion", ["gini", "entropy"]),
            },
            defaults={"max_depth": 12, "min_samples_leaf": 5, "criterion": "gini"},
        ),
        ModelSpec(
            "SVM (RBF)", "svm",
            lambda p: w(SVC(**{"probability": True, "random_state": SEED, "cache_size": 1000, **p}), True),
            lambda t: {
                "C": t.suggest_float("C", 0.1, 100, log=True),
                "gamma": t.suggest_float("gamma", 1e-3, 1.0, log=True),
            },
            scaled=True, max_train=SVM_MAX_TRAIN, defaults={"C": 3.0, "gamma": 0.05},
        ),
        ModelSpec(
            "Random Forest", "rf",
            lambda p: RandomForestClassifier(n_jobs=N_JOBS, random_state=SEED, **p),
            lambda t: {
                "n_estimators": t.suggest_int("n_estimators", 100, 400, step=50),
                "max_depth": t.suggest_categorical("max_depth", [None, 12, 20, 30]),
                "min_samples_leaf": t.suggest_int("min_samples_leaf", 1, 8),
                "max_features": t.suggest_categorical("max_features", ["sqrt", "log2", 0.5]),
            },
            defaults={"n_estimators": 300, "max_depth": None, "min_samples_leaf": 1, "max_features": "sqrt"},
        ),
        ModelSpec(
            "Gradient Boosting", "gb",
            lambda p: GradientBoostingClassifier(random_state=SEED, **p),
            lambda t: {
                "n_estimators": t.suggest_int("n_estimators", 100, 400, step=50),
                "learning_rate": t.suggest_float("learning_rate", 0.02, 0.3, log=True),
                "max_depth": t.suggest_int("max_depth", 2, 6),
                "subsample": t.suggest_float("subsample", 0.6, 1.0),
            },
            defaults={"n_estimators": 200, "learning_rate": 0.1, "max_depth": 3, "subsample": 1.0},
        ),
        ModelSpec(
            "XGBoost", "xgb",
            lambda p: XGBClassifier(
                tree_method="hist", eval_metric="logloss", n_jobs=N_JOBS, random_state=SEED, **p
            ),
            lambda t: {
                "n_estimators": t.suggest_int("n_estimators", 150, 700, step=50),
                "max_depth": t.suggest_int("max_depth", 3, 10),
                "learning_rate": t.suggest_float("learning_rate", 0.02, 0.3, log=True),
                "subsample": t.suggest_float("subsample", 0.6, 1.0),
                "colsample_bytree": t.suggest_float("colsample_bytree", 0.5, 1.0),
                "min_child_weight": t.suggest_int("min_child_weight", 1, 10),
            },
            defaults={"n_estimators": 400, "max_depth": 6, "learning_rate": 0.1},
        ),
        ModelSpec(
            "LightGBM", "lgbm",
            lambda p: lgb.LGBMClassifier(n_jobs=N_JOBS, random_state=SEED, verbose=-1, **p),
            lambda t: {
                "n_estimators": t.suggest_int("n_estimators", 150, 800, step=50),
                "num_leaves": t.suggest_int("num_leaves", 15, 255, log=True),
                "learning_rate": t.suggest_float("learning_rate", 0.02, 0.3, log=True),
                "min_child_samples": t.suggest_int("min_child_samples", 5, 100, log=True),
                "subsample": t.suggest_float("subsample", 0.6, 1.0),
                "subsample_freq": 1,
                "colsample_bytree": t.suggest_float("colsample_bytree", 0.5, 1.0),
                "reg_lambda": t.suggest_float("reg_lambda", 1e-3, 10, log=True),
            },
            defaults={"n_estimators": 400, "num_leaves": 63, "learning_rate": 0.05},
        ),
        ModelSpec(
            "MLP", "mlp",
            lambda p: w(
                MLPClassifier(
                    hidden_layer_sizes=tuple(p.get("hidden", (128, 64))),
                    early_stopping=True, max_iter=300, random_state=SEED,
                    **{k: v for k, v in p.items() if k != "hidden"},
                ),
                True,
            ),
            lambda t: {
                "hidden": [(64,), (128,), (128, 64), (256, 128)][t.suggest_int("hidden_idx", 0, 3)],
                "alpha": t.suggest_float("alpha", 1e-6, 1e-2, log=True),
                "learning_rate_init": t.suggest_float("learning_rate_init", 1e-4, 1e-2, log=True),
            },
            scaled=True, defaults={"alpha": 1e-4, "learning_rate_init": 1e-3},
        ),
    ]


def build_ensembles(tuned: dict[str, object]) -> list[tuple[str, str, object]]:
    """Stacking + soft-voting ensembles over the tuned tree learners."""
    from sklearn.base import clone

    base = [(k, clone(tuned[n])) for n, k in (("Random Forest", "rf"), ("XGBoost", "xgb"), ("LightGBM", "lgbm")) if n in tuned]
    stack = StackingClassifier(
        estimators=base,
        final_estimator=LogisticRegression(max_iter=2000),
        cv=5, stack_method="predict_proba", n_jobs=1,
    )
    vote = VotingClassifier(estimators=[(k, clone(m)) for k, m in base], voting="soft", n_jobs=1)
    return [("Stacking Ensemble", "stack", stack), ("Soft Voting Ensemble", "vote", vote)]
