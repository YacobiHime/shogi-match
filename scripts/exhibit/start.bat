@echo off
rem Shogi exhibit: full screen (kiosk). Close with Alt+F4.
cd /d "%~dp0"
title shogi-match exhibit
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Kiosk
if errorlevel 1 pause
