@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20 or newer from https://nodejs.org/
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
if not exist node_modules (
  echo Installing Family Guard dependencies...
  call npm ci
  if errorlevel 1 (
    echo Unable to install dependencies. Please check your network.
    pause
    exit /b 1
  )
)
echo Opening Family Guard on http://127.0.0.1:3000
echo Keep this window open while presenting the prototype.
call npm start
pause
