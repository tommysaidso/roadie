@echo off
title ROADIE
cd /d "%~dp0"
echo(
echo   ============================================
echo      ROADIE  -  the band's road kit (BC)
echo   ============================================
echo(
where node >nul 2>nul
if errorlevel 1 (
  echo  [!] Node.js is required. Get it free at https://nodejs.org  ^(LTS^)
  echo      Then double-click this again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo  First run: installing ROADIE ^(about 1-2 minutes^)...
  call npm install --no-audit --no-fund
)
echo  Starting ROADIE on http://localhost:3001 ...
echo  ^(Keep this window open while you use ROADIE. Close it to stop.^)
REM open the browser a few seconds after the server starts
start "" /min cmd /c "timeout /t 9 >nul & start "" http://localhost:3001"
call npm run dev
