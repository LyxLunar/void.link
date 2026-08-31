@echo off
title VOID.LINK
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18+ is required.
  echo Install Node.js from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
echo.
echo VOID.LINK is starting...
echo Open http://localhost:3000
echo Founder: http://localhost:3000/founder
echo.
start "" http://localhost:3000
npm start
pause
