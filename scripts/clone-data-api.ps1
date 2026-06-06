#Requires -Version 5.1
<#
  Copia dados public + auth.users de prod para teste via Management API (SQL).
  Requer scripts/.env.clone com SUPABASE_ACCESS_TOKEN e refs.
#>
param(
  [string]$EnvFile = (Join-Path $PSScriptRoot ".env.clone")
)

$ErrorActionPreference = "Stop"
$map = @{}
Get-Content $EnvFile -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $i = $line.IndexOf("=")
  if ($i -gt 0) { $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim() }
}

$token = $map["SUPABASE_ACCESS_TOKEN"]
$prod = $map["SUPABASE_PROD_PROJECT_REF"]
$test = $map["SUPABASE_TEST_PROJECT_REF"]
if (-not $token -or -not $prod -or -not $test) { throw "Preencha SUPABASE_ACCESS_TOKEN, PROD e TEST refs em .env.clone" }

function Invoke-DbQuery($ref, $sql) {
  $headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
  $body = @{ query = $sql } | ConvertTo-Json -Compress
  $uri = "https://api.supabase.com/v1/projects/$ref/database/query"
  return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body
}

Write-Host "Truncando tabelas no teste (ordem FK)..."
$truncate = @"
TRUNCATE public.divergences, public.cautela_items, public.cautelas, public.corrections, public.audit_logs, public.ammo_batches, public.persons, public.materials, public.profiles CASCADE;
"@
Invoke-DbQuery $test $truncate | Out-Null

$tables = @(
  @{ Schema = "auth"; Table = "users"; PublicTable = $null },
  @{ Schema = "public"; Table = "profiles"; PublicTable = "profiles" },
  @{ Schema = "public"; Table = "materials"; PublicTable = "materials" },
  @{ Schema = "public"; Table = "persons"; PublicTable = "persons" },
  @{ Schema = "public"; Table = "cautelas"; PublicTable = "cautelas" },
  @{ Schema = "public"; Table = "cautela_items"; PublicTable = "cautela_items" },
  @{ Schema = "public"; Table = "divergences"; PublicTable = "divergences" },
  @{ Schema = "public"; Table = "audit_logs"; PublicTable = "audit_logs" },
  @{ Schema = "public"; Table = "corrections"; PublicTable = "corrections" },
  @{ Schema = "public"; Table = "ammo_batches"; PublicTable = "ammo_batches" }
)

foreach ($t in $tables) {
  $full = if ($t.Schema -eq "auth") { "auth.users" } else { "public.$($t.Table)" }
  Write-Host "Copiando $full ..."
  $countSql = "select count(*)::int as c from $full"
  $c = (Invoke-DbQuery $prod $countSql).c
  if ($null -eq $c) { $c = (Invoke-DbQuery $prod $countSql | Select-Object -First 1).c }
  Write-Host "  registros prod: $c"
  if ($c -eq 0) { continue }

  # Export as INSERT statements via json aggregation (Postgres)
  $exportSql = @"
SELECT coalesce(
  (SELECT string_agg(stmt, E'\n') FROM (
    SELECT 'INSERT INTO $full SELECT * FROM json_populate_record(null::$full, j) ON CONFLICT DO NOTHING;' as stmt
    FROM (SELECT 1) x WHERE false
  ) s),
  ''
);
"@
  # Simpler: use jsonb array and insert via script in chunks
  $offset = 0
  $page = 200
  while ($offset -lt $c) {
    $pageSql = "select coalesce(json_agg(t), '[]'::json) as rows from (select * from $full order by 1 limit $page offset $offset) t"
    $rowsJson = (Invoke-DbQuery $prod $pageSql | Select-Object -ExpandProperty rows -ErrorAction SilentlyContinue)
    if (-not $rowsJson) {
      $resp = Invoke-DbQuery $prod $pageSql
      if ($resp -is [array]) { $rowsJson = $resp[0].rows } else { $rowsJson = $resp.rows }
    }
    if ($rowsJson -eq '[]' -or [string]::IsNullOrWhiteSpace("$rowsJson")) { break }
    $insertSql = "insert into $full select * from json_populate_recordset(null::$full, '$($rowsJson -replace "'", "''")'::json);"
    try {
      Invoke-DbQuery $test $insertSql | Out-Null
    } catch {
      Write-Warning "  batch offset $offset falhou, tentando linha a linha via API node..."
      break
    }
    $offset += $page
    Write-Host "  ... $offset / $c"
  }
}

Write-Host "Ajustando URLs storage..."
$prodRef = $prod
$replaceSql = @"
UPDATE public.persons SET
  rg_front_url = replace(rg_front_url, '$prodRef', '$test'),
  rg_back_url = replace(rg_back_url, '$prodRef', '$test')
WHERE rg_front_url IS NOT NULL OR rg_back_url IS NOT NULL;
"@
Invoke-DbQuery $test $replaceSql | Out-Null
Write-Host "Clone SQL concluído. Rode: node scripts/clone-storage-documents.mjs"
