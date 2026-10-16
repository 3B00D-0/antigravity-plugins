@echo off
title Antigravity 2.0 - Arabic / RTL Formatting Fix
echo ========================================================
echo   Antigravity 2.0 - Arabic / English RTL Formatting Fix
echo ========================================================
echo.

REM Check if Python is available, otherwise use built-in PowerShell/Node
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python "%~dp0patch_antigravity_rtl.py"
) else (
    echo [!] Python not found on PATH, trying Antigravity's built-in Node runtime...
    set ELECTRON_RUN_AS_NODE=1
    "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" "%~dp0patch_antigravity_rtl.js"
)

echo.
pause
