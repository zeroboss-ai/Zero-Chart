@echo off
setlocal
title Zero Chart - Live Multi-Asset Pro Terminal

echo ======================================================================
echo    Starting Zero Chart Live Multi-Asset Pro Terminal
echo    (Real-Time Crypto, Commodities, Indian Equities, and Forex)
echo ======================================================================

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH.
    echo Please install Node.js from https://nodejs.org/ (v20 or higher recommended)
    echo.
    pause
    exit /b 1
)

:: Change directory to script folder
cd /d "%~dp0"

:: Launch standalone server
echo [INFO] Launching Zero Chart server...
node server.mjs %*

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server encountered an error.
    pause
)
