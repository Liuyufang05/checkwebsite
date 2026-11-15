#!/usr/bin/env bash
# Download data, run EDA and train/compare all models.  Usage: scripts/train.sh [--fast] [uci url content]
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python
[ -x "$PY" ] || PY=python3
if [ "${1:-}" = "--fast" ]; then export PG_FAST=1; shift; fi
SETS=("$@"); [ ${#SETS[@]} -eq 0 ] && SETS=(uci url content)
export MPLBACKEND=Agg
$PY ml/data/download.py
$PY ml/prepare.py
$PY ml/eda.py
$PY ml/build_reputation.py
$PY ml/train.py --sets "${SETS[@]}"
cp ml/reports/results.json frontend/public/data/results.json
echo "Training finished. Restart the backend to load the new model version."
