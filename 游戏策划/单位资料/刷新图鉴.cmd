@echo off
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
 echo 请先安装 Node.js 24 或更新的兼容版本，并加入 PATH。
 pause
 exit /b 1
)
node "%~dp0..\..\工具\刷新单位图鉴.cjs"
if errorlevel 1 (
 echo 刷新失败，请检查上方信息。
 pause
 exit /b 1
)
echo 图鉴已更新，请刷新已打开的页面。
pause
