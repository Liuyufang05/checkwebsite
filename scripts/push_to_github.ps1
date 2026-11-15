<#
.SYNOPSIS  Initialise git (if needed), commit, and push this project to GitHub (branch main).
.DESCRIPTION
  * Never commits secrets: aborts if any .env file (other than .env.example) is staged.
  * Uses Git LFS for model bundles (ml/models/**/*.joblib) when git-lfs is installed.
  * Uses the GitHub CLI (gh) to create the repository if it is installed and logged in;
    otherwise pushes to an existing empty repository you create at https://github.com/new.
.EXAMPLE   powershell -ExecutionPolicy Bypass -File scripts\push_to_github.ps1
.EXAMPLE   powershell -ExecutionPolicy Bypass -File scripts\push_to_github.ps1 -Private -Message "Update models"
#>
param(
    [string]$User = "demonmj",
    [string]$Repo = "phishing-detector",
    [string]$Branch = "main",
    [string]$Message = "PhishGuard: comparative ML framework for robust phishing website detection",
    [switch]$Private
)
# "Continue": in Windows PowerShell 5.1, git writing to stderr would otherwise abort the script.
$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Need($cmd, $hint) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd not found. $hint" } }
Need git "Install Git from https://git-scm.com/download/win"

if (-not (git config user.email)) {
    Write-Host 'Git needs your identity first. Run:' -ForegroundColor Yellow
    Write-Host '  git config --global user.name  "Your Name"'
    Write-Host '  git config --global user.email "you@example.com"'
    exit 1
}

if (-not (Test-Path ".git")) {
    git init -b $Branch | Out-Null
    Write-Host "==> Initialised a new git repository" -ForegroundColor Cyan
}

# Large model files: Git LFS when available (GitHub rejects files > 100 MB without it).
$hasLfs = $false
try { git lfs version *> $null; $hasLfs = ($LASTEXITCODE -eq 0) } catch { $hasLfs = $false }
if ($hasLfs) {
    git lfs install --local | Out-Null
    git lfs track "ml/models/**/*.joblib" | Out-Null
    git add .gitattributes
    Write-Host "==> Git LFS will store model bundles" -ForegroundColor Cyan
} else {
    $big = Get-ChildItem ml\models -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 95MB }
    if ($big) { throw "Model files over 95 MB found and git-lfs is not installed. Install it from https://git-lfs.com and re-run." }
    Write-Host "==> git-lfs not installed; model bundles are small enough to commit directly" -ForegroundColor Yellow
}

# Make sure secrets are never tracked, even if they were added before.
git rm -r --cached --ignore-unmatch backend/.env .env *> $null
git add -A
$leaked = git diff --cached --name-only | Where-Object { $_ -match '(^|/)\.env$' -or ($_ -match '\.env$' -and $_ -notmatch '\.env\.example$') }
if ($leaked) { git reset -q; throw "Refusing to commit secret files: $leaked" }

git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -q -m $Message
    if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
    Write-Host "==> Committed: $Message" -ForegroundColor Cyan
} else {
    Write-Host "==> Nothing new to commit" -ForegroundColor Yellow
}

git branch -M $Branch
$remoteUrl = "https://github.com/$User/$Repo.git"
$useGh = $false
if (Get-Command gh -ErrorAction SilentlyContinue) { gh auth status *> $null; $useGh = ($LASTEXITCODE -eq 0) }

if ($useGh) {
    gh repo view "$User/$Repo" *> $null
    if ($LASTEXITCODE -ne 0) {
        $vis = if ($Private) { "--private" } else { "--public" }
        gh repo create "$User/$Repo" $vis --description "Comparative ML framework for robust phishing website detection" --source . --remote origin
        Write-Host "==> Created GitHub repository $User/$Repo" -ForegroundColor Cyan
    }
}
$existing = (git remote get-url origin 2>&1) | Where-Object { $_ -is [string] -and $_ -like "http*" }
if (-not $existing) { git remote add origin $remoteUrl } elseif ($existing -ne $remoteUrl) { git remote set-url origin $remoteUrl }

Write-Host "==> Pushing to $remoteUrl ($Branch)" -ForegroundColor Cyan
git push -u origin $Branch
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Push failed. If the repository doesn't exist yet:" -ForegroundColor Yellow
    Write-Host "  1. Open https://github.com/new and create '$Repo' (leave it EMPTY: no README/license)."
    Write-Host "  2. Run this script again. Git will ask you to sign in through the browser."
    exit 1
}
Write-Host "Done: https://github.com/$User/$Repo" -ForegroundColor Green
