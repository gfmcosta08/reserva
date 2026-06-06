#Requires -Version 5.1
<#
  Aponta .env.local do app para teste_db (sem apagar produção).
  Mantém backup .env.local.production.bak na primeira execução.
#>
$Root = Split-Path $PSScriptRoot -Parent
$EnvClone = Join-Path $PSScriptRoot ".env.clone"
$LocalEnv = Join-Path $Root ".env.local"
$Backup = Join-Path $Root ".env.local.production.bak"

if (-not (Test-Path $EnvClone)) {
  throw "Crie scripts/.env.clone com SUPABASE_TEST_URL e SUPABASE_TEST_ANON_KEY"
}

$map = @{}
Get-Content $EnvClone -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $i = $line.IndexOf("=")
  if ($i -gt 0) { $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim() }
}

$testUrl = $map["SUPABASE_TEST_URL"]
$testAnon = $map["SUPABASE_TEST_ANON_KEY"]
if (-not $testUrl -or -not $testAnon) {
  throw "Defina SUPABASE_TEST_URL e SUPABASE_TEST_ANON_KEY em scripts/.env.clone"
}

if ((Test-Path $LocalEnv) -and -not (Test-Path $Backup)) {
  Copy-Item $LocalEnv $Backup -Force
  Write-Host "Backup produção: .env.local.production.bak"
}

$ocr = ""
if (Test-Path $LocalEnv) {
  $ocrLine = Get-Content $LocalEnv -Encoding UTF8 | Where-Object { $_ -match "^OCR_SPACE_API_KEY=" } | Select-Object -First 1
  if ($ocrLine) { $ocr = $ocrLine }
}

$content = @(
  "# AMBIENTE: teste_db (gerado por scripts/switch-env-test.ps1)",
  "NEXT_PUBLIC_SUPABASE_URL=$testUrl",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=$testAnon"
)
if ($ocr) { $content += $ocr }

Set-Content -Path $LocalEnv -Value ($content -join "`n") -Encoding UTF8 -NoNewline
Add-Content -Path $LocalEnv -Value "`n"
Write-Host ".env.local apontando para teste: $testUrl" -ForegroundColor Green
Write-Host "Restaurar produção: scripts/switch-env-production.ps1"
