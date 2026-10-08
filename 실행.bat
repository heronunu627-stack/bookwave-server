@echo off
chcp 65001 > nul
title 북웨이브 (bookwave) - 오디오북 & 전자책

echo ===================================================
echo     북웨이브 (bookwave) 실행 중...
echo ===================================================
echo.
echo 잠시 후 기본 웹 브라우저가 자동으로 열립니다.
echo 프로그램을 종료하려면 이 창을 닫거나 Ctrl + C 를 누르세요.
echo.

cd /d "%~dp0"
python server.py
if errorlevel 1 (
    echo.
    echo [오류 발생] Python이 설치되어 있는지 확인해주세요.
    pause
)
