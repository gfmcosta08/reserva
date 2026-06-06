#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,
  [string]$EnvFile = ""
)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $EnvFile) {
  $EnvFile = Join-Path $scriptDir ".env.clone"
}

$ErrorActionPreference = "Stop"
$map = @{}
Get-Content $EnvFile -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $i = $line.IndexOf("=")
  if ($i -gt 0) { $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim() }
}
$token = $map["SUPABASE_ACCESS_TOKEN"]
if (-not $token) { throw "SUPABASE_ACCESS_TOKEN ausente em $EnvFile" }

$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
}
$uri = "https://api.supabase.com/v1/projects/$ProjectRef/database/query"
$repoRoot = Split-Path $scriptDir -Parent
$migrations = Get-ChildItem (Join-Path $repoRoot "supabase\migrations") -Filter "*.sql" | Sort-Object Name

foreach ($file in $migrations) {
  Write-Host "Applying $($file.Name) ..."
  $sql = Get-Content $file.FullName -Raw -Encoding UTF8
  $bodyObj = @{ query = $sql }
  $body = $bodyObj | ConvertTo-Json -Depth 5 -Compress
  try {
    Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType "application/json; charset=utf-8" | Out-Null
    Write-Host "  OK"
  } catch {
    Write-Host "  ERRO: $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    throw
  }
}
Write-Host "Migrations applied to $ProjectRef"
