@echo off
setlocal
chcp 65001 >nul
title Удаление TeamHub — сервер

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Требуются права администратора. Перезапускаю с повышенными правами...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================================
echo   TeamHub — удаление автозапуска сервера
echo ============================================================
echo.

echo Останавливаю и удаляю задачу автозапуска...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0remove-autostart.ps1"
echo.

echo Удаляю правило брандмауэра...
netsh advfirewall firewall delete rule name="TeamHub" >nul 2>&1
echo Готово.
echo.

echo ============================================================
echo Сервер больше не будет запускаться автоматически.
echo Папка с данными (data, uploads) и сам код TeamHub НЕ удалены —
echo при необходимости удалите их вручную.
echo ============================================================
echo.
pause
