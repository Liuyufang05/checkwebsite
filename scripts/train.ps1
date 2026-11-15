<#
.SYNOPSIS  Download data, run EDA and train/compare all models. Writes a new versioned model to ml\models.
.PARAMETER Fast   Quick smoke run (small samples, few tuning trials, ~10-20 min).
.PARAMETER Sets   Feature sets to train: url, content, uci (default: all).
.EXAMPLE   powershell -ExecutionPolicy Bypass -File scripts\train.ps1
.EXAMPLE   powershell -ExecutionPolicy Bypass -File scripts\train.ps1 -Fast
#>
param([switch]$Fast, [string[]]$Sets = @("uci", "url", "content"))
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root
$py = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { throw "Run scripts\setup.ps1 first." }
if ($Fast) { $env:PG_FAST = "1" } else { Remove-Item Env:PG_FAST -ErrorAction SilentlyContinue }
$env:MPLBACKEND = "Agg"

& $py ml\data\download.py;      if ($LASTEXITCODE) { exit 1 }
& $py ml\prepare.py;            if ($LASTEXITCODE) { exit 1 }
& $py ml\eda.py;                if ($LASTEXITCODE) { exit 1 }
& $py ml\build_reputation.py;   if ($LASTEXITCODE) { exit 1 }
& $py ml\train.py --sets @Sets; if ($LASTEXITCODE) { exit 1 }
Copy-Item ml\reports\results.json frontend\public\data\results.json -Force
Write-Host "Training finished. Restart the backend to load the new model version." -ForegroundColor Green
