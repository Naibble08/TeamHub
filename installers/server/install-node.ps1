# Проверяет наличие Node.js и при необходимости устанавливает его (LTS).
# Вызывается из install-server.bat. Код выхода 0 — Node.js готов к работе.

$ErrorActionPreference = "Stop"

function Test-NodeAvailable {
    try {
        $v = & node -v 2>$null
        if ($LASTEXITCODE -eq 0 -and $v) { return $true }
    } catch {}
    return $false
}

if (Test-NodeAvailable) {
    Write-Host "Node.js уже установлен: $(node -v)" -ForegroundColor Green
    exit 0
}

Write-Host "Node.js не найден на этом компьютере. Устанавливаю..." -ForegroundColor Yellow

# Попытка 1: winget (входит в состав Windows 10/11 с обновлённым App Installer)
$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($winget) {
    Write-Host "Пробую установить через winget..."
    try {
        winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
    } catch {
        Write-Host "winget не справился, пробую прямую загрузку с nodejs.org..." -ForegroundColor Yellow
    }
}

$env:Path = "$env:Path;C:\Program Files\nodejs\"
if (Test-NodeAvailable) {
    Write-Host "Node.js установлен: $(node -v)" -ForegroundColor Green
    exit 0
}

# Попытка 2: прямая загрузка официального установщика LTS с nodejs.org
Write-Host "Загружаю официальный установщик Node.js с nodejs.org..."
$index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
$lts = $index | Where-Object { $_.lts -ne $false } | Select-Object -First 1
if (-not $lts) { throw "Не удалось определить актуальную версию Node.js LTS" }

$version = $lts.version
$msiUrl = "https://nodejs.org/dist/$version/node-$version-x64.msi"
$msiPath = Join-Path $env:TEMP "node-$version-x64.msi"

Write-Host "Версия Node.js: $version"
Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -UseBasicParsing

Write-Host "Устанавливаю Node.js (тихая установка, без диалоговых окон)..."
$proc = Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /quiet /norestart" -Wait -PassThru
if ($proc.ExitCode -ne 0) {
    throw "Установка Node.js завершилась с кодом ошибки $($proc.ExitCode)"
}
Remove-Item $msiPath -ErrorAction SilentlyContinue

$env:Path = "$env:Path;C:\Program Files\nodejs\"
if (Test-NodeAvailable) {
    Write-Host "Node.js установлен: $(node -v)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Не удалось автоматически установить Node.js." -ForegroundColor Red
    Write-Host "Установите его вручную с https://nodejs.org (версия LTS) и запустите установку TeamHub ещё раз." -ForegroundColor Red
    exit 1
}
