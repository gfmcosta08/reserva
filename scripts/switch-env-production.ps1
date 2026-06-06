#Requires -Version 5.1
$Root = Split-Path $PSScriptRoot -Parent
$LocalEnv = Join-Path $Root ".env.local"
$Backup = Join-Path $Root ".env.local.production.bak"

if (-not (Test-Path $Backup)) {
  throw "Backup não encontrado. Restaure .env.local manualmente com as keys de reserva1bpmto."
}
Copy-Item $Backup $LocalEnv -Force
Write-Host ".env.local restaurado para produção (backup)." -ForegroundColor Green
