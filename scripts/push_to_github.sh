#!/usr/bin/env bash
# Initialise git (if needed), commit and push to GitHub (main). Never commits .env files.
# Usage: scripts/push_to_github.sh [user] [repo] ["commit message"]   (PRIVATE=1 for a private repo)
set -euo pipefail
cd "$(dirname "$0")/.."
USER_NAME="${1:-demonmj}"; REPO="${2:-phishing-detector}"; MSG="${3:-PhishGuard: comparative ML framework for robust phishing website detection}"
BRANCH=main; URL="https://github.com/$USER_NAME/$REPO.git"

command -v git >/dev/null || { echo "git is not installed"; exit 1; }
git config user.email >/dev/null || { echo 'Set your identity: git config --global user.name "Name"; git config --global user.email "you@example.com"'; exit 1; }
[ -d .git ] || git init -b "$BRANCH" >/dev/null

if git lfs version >/dev/null 2>&1; then
  git lfs install --local >/dev/null; git lfs track "ml/models/**/*.joblib" >/dev/null; git add .gitattributes
else
  if find ml/models -type f -size +95M 2>/dev/null | grep -q .; then echo "Model files >95MB need git-lfs (https://git-lfs.com)"; exit 1; fi
fi

git rm -r --cached --ignore-unmatch backend/.env .env >/dev/null 2>&1 || true
git add -A
if git diff --cached --name-only | grep -E '(^|/)\.env$|\.env$' | grep -v '\.env\.example$' | grep -q .; then
  git reset -q; echo "Refusing to commit .env files"; exit 1
fi
git diff --cached --quiet || git commit -q -m "$MSG"
git branch -M "$BRANCH"

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh repo view "$USER_NAME/$REPO" >/dev/null 2>&1 || gh repo create "$USER_NAME/$REPO" "$([ "${PRIVATE:-0}" = 1 ] && echo --private || echo --public)" --source . --remote origin
fi
if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin "$URL"; else git remote add origin "$URL"; fi
git push -u origin "$BRANCH" || { echo "Create an EMPTY repo at https://github.com/new named $REPO, then re-run."; exit 1; }
echo "Done: https://github.com/$USER_NAME/$REPO"
