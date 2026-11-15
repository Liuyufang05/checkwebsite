#!/usr/bin/env bash
# One-time local setup (macOS/Linux): venv, Playwright Chromium, frontend packages, .env
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r backend/requirements-dev.txt -r ml/requirements.txt
.venv/bin/python -m playwright install chromium
if command -v npm >/dev/null; then (cd frontend && npm ci --no-audit --no-fund); else echo "Node.js not found - install Node 20+ for the frontend"; fi
[ -f backend/.env ] || { cp .env.example backend/.env; echo "Created backend/.env - add your API keys there"; }
echo "Setup complete. Next: scripts/train.sh (optional) then scripts/run_dev.sh"
