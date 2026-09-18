# Zero Chart PowerShell Launcher
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   Starting Zero Chart Live Multi-Asset Pro Terminal" -ForegroundColor Green
Write-Host "   (Real-Time Crypto, Commodities, Indian Equities, and Forex)" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Run standalone server
Set-Location -Path $PSScriptRoot
Write-Host "[INFO] Launching Zero Chart server..." -ForegroundColor Cyan
node server.mjs
