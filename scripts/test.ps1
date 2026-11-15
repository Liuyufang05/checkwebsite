<#  Run the backend test-suite (feature extractors, SSRF guard, intel clients, API). #>
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location (Join-Path $Root "backend")
& (Join-Path $Root ".venv\Scripts\python.exe") -m pytest -q
