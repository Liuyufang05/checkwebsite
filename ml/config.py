"""Central configuration for the ML pipeline."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
ROOT = ML_DIR.parent
BACKEND_DIR = ROOT / "backend"

# Make the shared feature extractor importable: ``from app.features import ...``
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

DATA_DIR = ML_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = ML_DIR / "models"
REPORTS_DIR = ML_DIR / "reports"
FIG_DIR = REPORTS_DIR / "figures"

for _d in (RAW_DIR, PROCESSED_DIR, MODELS_DIR, REPORTS_DIR, FIG_DIR):
    _d.mkdir(parents=True, exist_ok=True)

SEED = 42
TEST_SIZE = 0.20
CV_FOLDS = 5

# Compute budget. Defaults are sized for a 2-4 core laptop (~30-45 min total).
# Set PG_FAST=1 for a quick smoke run, or override the sizes individually.
FAST = os.environ.get("PG_FAST", "0") == "1"
URL_SAMPLE_PER_SOURCE = int(os.environ.get("PG_URL_SAMPLE", 8000 if FAST else 40000))
CONTENT_SAMPLE = int(os.environ.get("PG_CONTENT_SAMPLE", 8000 if FAST else 60000))
TUNE_SAMPLE = int(os.environ.get("PG_TUNE_SAMPLE", 3000 if FAST else 12000))
SVM_MAX_TRAIN = int(os.environ.get("PG_SVM_MAX", 3000 if FAST else 15000))
KNN_MAX_TRAIN = int(os.environ.get("PG_KNN_MAX", 10000 if FAST else 40000))
N_TRIALS = int(os.environ.get("PG_TRIALS", 4 if FAST else 20))
N_JOBS = int(os.environ.get("PG_JOBS", -1))
