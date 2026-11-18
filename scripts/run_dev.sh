#!/usr/bin/env bash
# Run backend + frontend locally without Docker (Ctrl+C stops both).
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python; [ -x "$PY" ] || PY=.venv312/Scripts/python.exe
(cd backend && ../$PY -m uvicorn app.main:app --reload --port 8000) &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT
cd frontend && npm run dev
