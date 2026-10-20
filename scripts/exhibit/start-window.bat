@echo off
rem Shogi exhibit: normal window (for setup and checking).
cd /d "%~dp0"
title shogi-match exhibit
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 pause
