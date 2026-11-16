@echo off
title 369 Multi Discrete Streamer
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js / npm not found. Install Node.js from https://nodejs.org and try again.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo Starting dev server at http://localhost:5173 ...
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5173"
call npm run dev

pause
