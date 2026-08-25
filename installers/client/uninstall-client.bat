@echo off
setlocal
chcp 65001 >nul
title Удаление ярлыка TeamHub

rem Ярлык мог быть создан как .lnk (если найден Edge/Chrome) или как .url (иначе) —
rem удаляем оба варианта на случай переустановки в другом режиме.
for %%E in (lnk url) do (
    if exist "%USERPROFILE%\Desktop\TeamHub.%%E" del /f /q "%USERPROFILE%\Desktop\TeamHub.%%E"
    if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\TeamHub.%%E" del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\TeamHub.%%E"
)

echo Ярлыки TeamHub удалены с этого компьютера.
echo (Сама система TeamHub при этом не затронута — она находится на сервере.)
echo.
pause
