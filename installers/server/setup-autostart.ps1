param(
    [Parameter(Mandatory=$true)][string]$AppDir
)

# Настраивает автозапуск сервера TeamHub при включении компьютера (через
# Планировщик заданий Windows) и сразу запускает его. Вызывается из
# install-server.bat. Использует модуль ScheduledTasks — надёжнее и проще,
# чем собирать строку для schtasks.exe вручную (риск ошибок при пробелах в пути).

$ErrorActionPreference = "Stop"
$taskName = "TeamHub Server"

$installersServerDir = Join-Path $AppDir "installers\server"
if (-not (Test-Path $installersServerDir)) { New-Item -ItemType Directory -Path $installersServerDir -Force | Out-Null }
$vbsPath = Join-Path $installersServerDir "run-hidden.vbs"

$logsDir = Join-Path $AppDir "logs"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }

# Генерируем скрытый запускатель — путь к приложению уже "зашит" внутри файла,
# поэтому Планировщику не нужно передавать его отдельным аргументом командной строки.
$vbsContent = @"
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "$AppDir"
shell.Run "cmd /c node src\server.js >> ""logs\server.log"" 2>&1", 0, False
"@
# UTF-16 с BOM — надёжно читается WSH, даже если путь к приложению
# содержит кириллицу (например, имя пользователя Windows).
Set-Content -Path $vbsPath -Value $vbsContent -Encoding Unicode

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Write-Host "Обновляю существующую задачу автозапуска..."
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Автозапуск настроен: сервер будет включаться сам при каждой загрузке компьютера." -ForegroundColor Green

Start-ScheduledTask -TaskName $taskName
Write-Host "Сервер запущен." -ForegroundColor Green
