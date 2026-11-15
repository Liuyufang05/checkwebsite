<#
.SYNOPSIS  One-time local setup on Windows (Python venv, Playwright Chromium, frontend packages, .env).
.EXAMPLE   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$py = if (Get-Command py -ErrorAction SilentlyContinue) { "py" } else { "python" }
Write-Host "==> Creating virtual environment in .venv" -ForegroundColor Cyan
if (-not (Test-Path ".venv")) { & $py -m venv .venv }
$venvPy = Join-Path $Root ".venv\Scripts\python.exe"
& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install -r backend\requirements-dev.txt -r ml\requirements.txt

Write-Host "==> Installing headless Chromium for screenshots" -ForegroundColor Cyan
& $venvPy -m playwright install chromium

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "==> Installing frontend packages" -ForegroundColor Cyan
    Push-Location frontend; npm ci --no-audit --no-fund; Pop-Location
} else {
    Write-Warning "Node.js not found - install Node 20+ to run the frontend outside Docker."
}

if (-not (Test-Path "backend\.env")) {
    Copy-Item ".env.example" "backend\.env"
    Write-Host "==> Created backend\.env from .env.example (add your API keys there)" -ForegroundColor Yellow
}
Write-Host "Setup complete. Next: scripts\train.ps1 (optional, models are included) then scripts\run_dev.ps1" -ForegroundColor Green
