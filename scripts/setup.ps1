<#
.SYNOPSIS  One-time local setup on Windows (Python venv, Playwright Chromium, frontend packages, .env).
.EXAMPLE   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

# Pin the venv to a Python that has wheels for the pinned ML libs (3.12; 3.14 has none yet).
$py = "py"; $pyArgs = @("-3.12")
if (-not (py -3.12 -c "import sys" 2>$null)) { $py = "python"; $pyArgs = @() }
Write-Host "==> Creating virtual environment in .venv ($py $($pyArgs -join ' '))" -ForegroundColor Cyan
if (-not (Test-Path ".venv")) { & $py @pyArgs -m venv .venv }
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
