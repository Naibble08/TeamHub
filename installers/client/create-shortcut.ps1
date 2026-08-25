param(
    [Parameter(Mandatory=$true)][string]$Url,
    [string]$Name = "TeamHub",
    [string]$IconPath = ""
)

# Создаёт ярлык TeamHub на рабочем столе и в меню «Пуск». Если на компьютере
# есть Microsoft Edge или Google Chrome — ярлык открывает TeamHub в режиме
# отдельного окна приложения (без адресной строки и вкладок браузера).
# Отдельное ПО при этом не устанавливается — это просто ярлык на веб-страницу.

$ErrorActionPreference = "Stop"

function Get-BrowserExe {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

$browser = Get-BrowserExe
$shell = New-Object -ComObject WScript.Shell

function New-AppShortcut {
    # Edge/Chrome есть — создаём .lnk в режиме отдельного окна приложения.
    param([string]$FolderPath)
    $sc = $shell.CreateShortcut((Join-Path $FolderPath "$Name.lnk"))
    $sc.TargetPath = $browser
    $sc.Arguments = "--app=$Url"
    if ($IconPath -and (Test-Path $IconPath)) { $sc.IconLocation = $IconPath }
    $sc.Description = "TeamHub - рабочее пространство команды"
    $sc.Save()
}

function New-UrlShortcut {
    # Нет ни Edge, ни Chrome — обычный интернет-ярлык, откроется в браузере по умолчанию.
    param([string]$FolderPath)
    $path = Join-Path $FolderPath "$Name.url"
    $lines = @("[InternetShortcut]", "URL=$Url")
    if ($IconPath -and (Test-Path $IconPath)) {
        $lines += "IconFile=$IconPath"
        $lines += "IconIndex=0"
    }
    Set-Content -Path $path -Value $lines -Encoding ASCII
}

function New-TeamHubShortcut {
    param([string]$FolderPath)
    if ($browser) { New-AppShortcut -FolderPath $FolderPath }
    else { New-UrlShortcut -FolderPath $FolderPath }
}

$desktop = [Environment]::GetFolderPath("Desktop")
New-TeamHubShortcut -FolderPath $desktop
Write-Host "Ярлык создан на рабочем столе." -ForegroundColor Green

$startMenu = [Environment]::GetFolderPath("StartMenu")
$programs = Join-Path $startMenu "Programs"
if (Test-Path $programs) {
    New-TeamHubShortcut -FolderPath $programs
    Write-Host "Ярлык добавлен в меню Пуск." -ForegroundColor Green
}

if (-not $browser) {
    Write-Host "Microsoft Edge или Chrome не найдены — ярлык откроет TeamHub в браузере по умолчанию (в отдельном окне приложения он выглядел бы аккуратнее)." -ForegroundColor Yellow
}
