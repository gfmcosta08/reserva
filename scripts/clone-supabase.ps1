#Requires -Version 5.1
<#
.SYNOPSIS
  Clona reserva1bpmto (produção) → teste_db: schema (migrations), dados public+auth, storage.

.DESCRIPTION
  1. Carrega scripts/.env.clone (copie de env.clone.example)
  2. db push no teste
  3. dump dados public + auth da prod
  4. restore no teste via psql ou supabase db execute
  5. Opcional: node clone-storage-documents.mjs

  Pré-requisitos: Node.js, npx supabase CLI, psql (PostgreSQL client) no PATH.
#>
param(
  [switch]$SkipSchema,
  [switch]$SkipData,
  [switch]$SkipStorage,
  [switch]$SkipUrlRewrite
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $PSScriptRoot ".env.clone"
$DumpDir = Join-Path $PSScriptRoot "dumps"

function Load-EnvClone {
  if (-not (Test-Path $EnvFile)) {
    throw "Crie $EnvFile a partir de scripts/env.clone.example"
  }
  $map = @{}
  Get-Content $EnvFile -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -gt 0) { $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim() }
  }
  return $map
}

function Get-DbUrl($ref, $password) {
  # Session pooler (IPv4) — ajuste região se o Dashboard mostrar outro host
  return "postgresql://postgres.${ref}:${password}@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
}

function Invoke-Supabase { param([string[]]$Args)
  Push-Location $Root
  try {
    & npx --yes supabase @Args
    if ($LASTEXITCODE -ne 0) { throw "supabase falhou: $Args" }
  } finally { Pop-Location }
}

function Test-Psql {
  $psql = Get-Command psql -ErrorAction SilentlyContinue
  if (-not $psql) {
    Write-Warning "psql não encontrado no PATH. Instale PostgreSQL client ou use restore manual no SQL Editor."
    return $false
  }
  return $true
}

$envMap = Load-EnvClone
$required = @(
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROD_PROJECT_REF",
  "SUPABASE_PROD_DB_PASSWORD",
  "SUPABASE_TEST_PROJECT_REF",
  "SUPABASE_TEST_DB_PASSWORD"
)
foreach ($k in $required) {
  if (-not $envMap[$k]) { throw "Defina $k em scripts/.env.clone" }
}

$env:SUPABASE_ACCESS_TOKEN = $envMap["SUPABASE_ACCESS_TOKEN"]
$prodRef = $envMap["SUPABASE_PROD_PROJECT_REF"]
$testRef = $envMap["SUPABASE_TEST_PROJECT_REF"]
$prodPass = $envMap["SUPABASE_PROD_DB_PASSWORD"]
$testPass = $envMap["SUPABASE_TEST_DB_PASSWORD"]

New-Item -ItemType Directory -Force -Path $DumpDir | Out-Null
$publicDump = Join-Path $DumpDir "prod_public_data.sql"
$authDump = Join-Path $DumpDir "prod_auth_data.sql"

Write-Host "=== RESERVA: clone $prodRef -> $testRef ===" -ForegroundColor Cyan

if (-not $SkipSchema) {
  Write-Host "[1/5] Schema: supabase db push no teste..." -ForegroundColor Yellow
  Invoke-Supabase @(
    "db", "push",
    "--project-ref", $testRef,
    "--password", $testPass
  )
}

if (-not $SkipData) {
  $prodUrl = Get-DbUrl $prodRef $prodPass
  $testUrl = Get-DbUrl $testRef $testPass

  Write-Host "[2/5] Dump public (dados)..." -ForegroundColor Yellow
  Invoke-Supabase @(
    "db", "dump",
    "--db-url", $prodUrl,
    "--data-only",
    "--schema", "public",
    "-f", $publicDump
  )

  Write-Host "[3/5] Dump auth (dados)..." -ForegroundColor Yellow
  Invoke-Supabase @(
    "db", "dump",
    "--db-url", $prodUrl,
    "--data-only",
    "--schema", "auth",
    "-f", $authDump
  )

  if (Test-Psql) {
    Write-Host "[4/5] Restore no teste (psql)..." -ForegroundColor Yellow
    $env:PGSSLMODE = "require"
    & psql $testUrl -v ON_ERROR_STOP=1 -f $publicDump
    & psql $testUrl -v ON_ERROR_STOP=1 -f $authDump
  } else {
    Write-Host "Restore manual: execute no SQL Editor do teste_db:" -ForegroundColor Magenta
    Write-Host "  $publicDump"
    Write-Host "  $authDump"
  }
}

if (-not $SkipStorage) {
  if ($envMap["SUPABASE_PROD_SERVICE_ROLE_KEY"] -and $envMap["SUPABASE_TEST_SERVICE_ROLE_KEY"]) {
    Write-Host "[5/5] Storage bucket documents..." -ForegroundColor Yellow
    Push-Location $Root
    node (Join-Path $PSScriptRoot "clone-storage-documents.mjs")
    Pop-Location
  } else {
    Write-Warning "Pule storage: defina SUPABASE_PROD_SERVICE_ROLE_KEY e SUPABASE_TEST_SERVICE_ROLE_KEY"
  }
}

if (-not $SkipUrlRewrite) {
  Write-Host "URLs: edite scripts/rewrite-storage-urls.sql (troque SEU_REF_TESTE por $testRef) e rode no SQL Editor do teste." -ForegroundColor Magenta
}

Write-Host "Concluído. Próximo: scripts/switch-env-test.ps1 e npm run dev" -ForegroundColor Green
