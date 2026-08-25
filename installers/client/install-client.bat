@echo off
setlocal
chcp 65001 >nul
title Установка TeamHub — рабочее место

echo ============================================================
echo   TeamHub — ярлык на этом компьютере
echo ============================================================
echo.
echo TeamHub - это веб-страница, отдельная программа не устанавливается.
echo Этот мастер лишь добавит удобный значок на рабочий стол.
echo.
echo Узнайте у администратора адрес сервера TeamHub в локальной сети,
echo например: 192.168.1.10  или  192.168.1.10:3000
echo.
set /p SERVER=Адрес сервера TeamHub:

if "%SERVER%"=="" (
    echo.
    echo Адрес не указан. Установка прервана.
    pause
    exit /b 1
)

echo %SERVER%| findstr ":" >nul
if errorlevel 1 (
    set "SERVER=%SERVER%:3000"
)

set "URL=http://%SERVER%/"

echo.
echo Создаю ярлык для %URL% ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1" -Url "%URL%" -Name "TeamHub" -IconPath "%~dp0icon\teamhub.ico"
if errorlevel 1 (
    echo.
    echo Не удалось создать ярлык автоматически. Откройте %URL% в браузере
    echo и сохраните страницу в закладки — работать с TeamHub это не помешает.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Готово! На рабочем столе появился значок TeamHub.
echo Логин и пароль для входа вам выдаст администратор.
echo При первом входе рекомендуем сразу сменить пароль
echo (кнопка "Сменить пароль" внизу слева).
echo ============================================================
echo.
pause
