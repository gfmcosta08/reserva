#Requires -Version 5.1
<#
  Configura secrets do GitHub Actions a partir de scripts/.env.clone e scripts/.env.qa.
  Pré-requisito: gh auth login (ou GH_TOKEN com escopo repo)
#>
$ErrorActionPreference = "Stop"
$Gh = "$env:LOCALAPPDATA\Programs\gh\gh.exe"
if (-not (Test-Path $Gh)) { $Gh = "gh" }

if (-not $env:GH_TOKEN) {
  & $Gh auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $nodeToken = node -e "try{const {execSync}=require('child_process');const o=execSync('git credential fill',{input:'protocol=https\\nhost=github.com\\n\\n'}).toString();const m=o.match(/^password=(.+)$/m);if(m)process.stdout.write(m[1]);}catch(e){}" 2>$null
    if ($nodeToken) {
      $env:GH_TOKEN = $nodeToken.Trim()
      Write-Host "GH_TOKEN obtido do Git Credential Manager." -ForegroundColor Cyan
    }
  }
}

if (-not $env:GH_TOKEN) {
  & $Gh auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Execute: gh auth login" -ForegroundColor Yellow
    Write-Host "Ou defina GH_TOKEN (PAT com escopo repo)." -ForegroundColor Yellow
    exit 1
  }
}

function Read-EnvFile($path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  Get-Content $path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -gt 0) { $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim() }
  }
  return $map
}

$clone = Read-EnvFile (Join-Path $PSScriptRoot ".env.clone")
$qa = Read-EnvFile (Join-Path $PSScriptRoot ".env.qa")

$vercelBypass = $env:VERCEL_AUTOMATION_BYPASS_SECRET
if (-not $vercelBypass) { $vercelBypass = $qa["VERCEL_AUTOMATION_BYPASS_SECRET"] }
if (-not $vercelBypass) {
  Write-Host "SKIP VERCEL_AUTOMATION_BYPASS_SECRET (defina em env ou scripts/.env.qa)" -ForegroundColor DarkYellow
}

$secrets = @{
  E2E_SUPERVISOR_EMAIL = $qa["QA_SUPERVISOR_EMAIL"]
  E2E_SUPERVISOR_PASSWORD = $qa["QA_SUPERVISOR_PASSWORD"]
  E2E_BASE_URL = "https://reserva-teste.vercel.app"
  SUPABASE_ACCESS_TOKEN = $clone["SUPABASE_ACCESS_TOKEN"]
  SUPABASE_TEST_DB_PASSWORD = $clone["SUPABASE_TEST_DB_PASSWORD"]
  SUPABASE_TEST_PROJECT_REF = $clone["SUPABASE_TEST_PROJECT_REF"]
  VERCEL_AUTOMATION_BYPASS_SECRET = $vercelBypass
}

foreach ($name in $secrets.Keys) {
  $val = $secrets[$name]
  if (-not $val) {
    Write-Host "SKIP $name (valor vazio em .env)" -ForegroundColor DarkYellow
    continue
  }
  & $Gh secret set $name --body $val
  Write-Host "OK $name" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Secrets publicados. VERCEL_AUTOMATION_BYPASS_SECRET incluido quando disponivel.'
