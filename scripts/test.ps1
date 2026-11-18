<#  Run the backend test-suite (feature extractors, SSRF guard, intel clients, API). #>
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location (Join-Path $Root "backend")
$py = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = Join-Path $Root ".venv312\Scripts\python.exe" }
& $py -m pytest -q
