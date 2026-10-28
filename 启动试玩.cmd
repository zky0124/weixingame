@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 启动后请打开 http://127.0.0.1:7456/preview
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0工具\启动首战试玩.ps1"
pause
