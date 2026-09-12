@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
echo ============================================
echo   古琴减字谱 H5 - 本地开发服务器
echo   Node 后端 + 静态托管（端口 8090）
echo   AI 曲库可同步到 data/gen_scores.json
echo ============================================
echo.
start "" http://localhost:8090/h5/index.html
node server.js 8090
pause
