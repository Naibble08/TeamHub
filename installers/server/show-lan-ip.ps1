# Печатает адреса TeamHub в локальной сети — вызывается из install-server.bat.

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notlike '169.254.*' }).IPAddress

if ($ip) {
    $ip | ForEach-Object { Write-Host ("  http://" + $_ + ":3000") }
} else {
    Write-Host "  Не удалось определить адрес автоматически — посмотрите вывод команды ipconfig"
}
