@echo off
title Antigravity 2.0 - Restore Original UI
echo ========================================================
echo   Antigravity 2.0 - Restore Original Unpatched Files
echo ========================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python "%~dp0patch_antigravity_rtl.py" --restore
) else (
    echo Restoring from backups...
    copy /Y "%LOCALAPPDATA%\Programs\antigravity\resources\app.asar.bak" "%LOCALAPPDATA%\Programs\antigravity\resources\app.asar"
    copy /Y "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe.bak" "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
)

echo.
pause
