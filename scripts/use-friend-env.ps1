# Backup current .env, switch to .env.friend, test DB connection, then restore
param(
  [switch]$KeepFriendEnv
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$envFile = Join-Path $root '.env'
$friendEnv = Join-Path $root '.env.friend'
$backupFile = Join-Path $root (".env.backup." + (Get-Date -Format 'yyyyMMdd_HHmmss'))

if (!(Test-Path $friendEnv)) {
  Write-Error ".env.friend no existe en $root"
  exit 1
}

if (Test-Path $envFile) {
  Copy-Item $envFile $backupFile -Force
  Write-Host "Respaldo creado: $backupFile"
}

Copy-Item $friendEnv $envFile -Force
Write-Host "Copiado .env.friend a .env"

# Ejecutar prueba de conexión
node (Join-Path $root 'scripts/test-db-connection.js')

if (-not $KeepFriendEnv) {
  if (Test-Path $backupFile) {
    Copy-Item $backupFile $envFile -Force
    Write-Host "Restaurado .env desde respaldo"
  }
}
