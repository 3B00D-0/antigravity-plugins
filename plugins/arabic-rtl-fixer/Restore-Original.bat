@echo off
title Antigravity 2.0 - Restore Original UI
echo ========================================================
echo   Antigravity 2.0 - Restore Original Unpatched Files
echo ========================================================
echo.

set AGY_EXE=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe
if not exist "%AGY_EXE%" set AGY_EXE=%LOCALAPPDATA%\antigravity\Antigravity.exe

if exist "%AGY_EXE%" (
    set ELECTRON_RUN_AS_NODE=1
    "%AGY_EXE%" "%~dp0patch_antigravity_rtl.js" --restore
    set ELECTRON_RUN_AS_NODE=
) else (
    where python >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        python "%~dp0patch_antigravity_rtl.py" --restore
    ) else (
        echo [!] Could not locate Antigravity.exe or Python.
    )
)

echo.
pause
