@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Установка TeamHub — сервер

rem --- Повышение прав до администратора (нужны для Node.js, брандмауэра и автозапуска) ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Требуются права администратора. Перезапускаю с повышенными правами...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================================
echo   TeamHub — установка серверной части
echo ============================================================
echo.

rem --- Корень приложения: на два уровня выше installers\server ---
pushd "%~dp0..\.."
set "APP_DIR=%CD%"
popd
echo Папка приложения: %APP_DIR%
echo.

rem --- [1/5] Node.js ---
echo [1/5] Проверка Node.js...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-node.ps1"
if errorlevel 1 (
    echo.
    echo Установка прервана: не удалось подготовить Node.js.
    pause
    exit /b 1
)
set "PATH=%PATH%;C:\Program Files\nodejs\"
echo.

rem --- [2/5] Зависимости ---
echo [2/5] Установка зависимостей проекта (npm install)...
cd /d "%APP_DIR%"
call npm install
if errorlevel 1 (
    echo.
    echo Не удалось установить зависимости. Проверьте подключение к интернету и запустите установку ещё раз.
    pause
    exit /b 1
)
echo.

rem --- [3/5] Автозапуск сервера + первый запуск ---
echo [3/5] Настройка автозапуска и запуск сервера...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-autostart.ps1" -AppDir "%APP_DIR%"
if errorlevel 1 (
    echo Не удалось настроить автозапуск. Сервер можно запускать вручную командой "npm start" в папке приложения.
)
echo.

rem --- [4/5] Брандмауэр ---
echo [4/5] Открываю порт 3000 в брандмауэре для локальной сети...
netsh advfirewall firewall show rule name="TeamHub" >nul 2>&1
if %errorLevel% equ 0 netsh advfirewall firewall delete rule name="TeamHub" >nul
netsh advfirewall firewall add rule name="TeamHub" dir=in action=allow protocol=TCP localport=3000 >nul
echo Готово. Если позже смените порт в config\config.json — обновите и это правило.
echo.

rem --- [5/5] Итоги ---
timeout /t 4 /nobreak >nul
echo [5/5] Журнал запуска ^(здесь же — логин и пароль администратора при первом запуске^):
echo ------------------------------------------------------------
if exist "%APP_DIR%\logs\server.log" (
    type "%APP_DIR%\logs\server.log"
) else (
    echo Файл журнала ещё не появился. Откройте через несколько секунд:
    echo %APP_DIR%\logs\server.log
)
echo ------------------------------------------------------------
echo.

echo Адрес сервера в локальной сети:
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0show-lan-ip.ps1"
echo.

echo ============================================================
echo Сохраните пароль администратора (см. журнал выше) и передайте
echo сотрудникам адрес сервера — он нужен для installers\client\install-client.bat
echo ============================================================
echo.
pause
