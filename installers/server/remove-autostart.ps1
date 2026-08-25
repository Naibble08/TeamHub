# Удаляет задачу автозапуска TeamHub. Вызывается из uninstall-server.bat.

$taskName = "TeamHub Server"

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Задача автозапуска удалена." -ForegroundColor Green
} else {
    Write-Host "Задача автозапуска не найдена — нечего удалять." -ForegroundColor Yellow
}
