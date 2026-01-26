@echo off
REM BuildData.bat - Converts CSV data files to gameData.js
REM This script reads all CSV files from the data folder and generates gameData.js

setlocal enabledelayedexpansion

REM Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"

REM Execute the PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%build_game_data.ps1"

if errorlevel 1 (
    echo.
    echo Error: Failed to generate gameData.js
    pause
    exit /b 1
)

pause
