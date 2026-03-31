@echo off
title TradingViewer 一鍵部署工具
echo ========================================
echo   正在準備自動部署...
echo ========================================

echo 1. 正在掃描並加入修改內容...
git add .

echo 2. 正在建立更新紀錄...
set /p msg="請輸入更新說明 (直接按 Enter 則使用預設值): "
if "%msg%"=="" set msg="auto: 快速更新並觸發部署"
git commit -m "%msg%"

echo 3. 正在推送到 GitHub (將觸發 Actions 與 Render 部署)...
git push origin main

echo ========================================
echo   ✅ 推送完成！
echo   - 前端部署中: https://github.com/shengwen0928/tradingview/actions
echo   - 後端部署中: https://dashboard.render.com/
echo ========================================
pause
