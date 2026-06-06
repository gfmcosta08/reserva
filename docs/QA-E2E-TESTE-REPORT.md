# Relatório QA E2E — Controle de Material (teste_bd)

**Data:** 06/06/2026  
**Ambiente remoto:** https://reserva-teste.vercel.app  
**Supabase:** `ajyvznrmbuistlcfckuh` (teste_db)  
**Commit deploy:** `5e9464d` (master — stock_quantity em cautela, devolução e cadastro)

---

## Resumo executivo — pronto para QA

| Área | Resultado |
|------|-----------|
| API `/api/version` | ✅ `teste_db`, commit `5e9464d` |
| ammo_batches + migrations | ✅ SQL idempotente aplicado |
| Materiais clonados | ✅ 589 (587 prod + 2 QA) |
| Pessoas / cautelas pós-import | ✅ ~120 pessoas, ~119 cautelas (ver § Estado dos dados) |
| Supervisor QA | ✅ `qa.supervisor@reserva.test` (credenciais em `scripts/.env.qa`) |
| Vitest (`npm test`) | ✅ 2/2 passed |
| E2E local (`localhost:3000`) | ✅ 1/1 passed |
| E2E remoto (`reserva-teste.vercel.app`) | ✅ 1/1 passed (bypass via env) |
| GitHub secrets | ⏳ `gh` instalado; requer `gh auth login` |

---

## Acesso para QA no navegador

### URL principal

https://reserva-teste.vercel.app

### Bypass Deployment Protection (Vercel SSO)

O preview exige login Vercel por padrão. Use **uma** das opções:

**Opção A — Link com bypass (recomendado para QA manual):**

```
https://reserva-teste.vercel.app/auth/login?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>&x-vercel-set-bypass-cookie=true
```

Substitua `<VERCEL_AUTOMATION_BYPASS_SECRET>` pelo valor em `scripts/.env.qa` ou no Dashboard Vercel → Deployment Protection → Protection Bypass for Automation.

O cookie de bypass persiste na sessão do navegador após o primeiro acesso.

**Opção B — CLI (API/scripts):**

```powershell
npx vercel curl https://reserva-teste.vercel.app/api/version
```

**Opção C — Desativar proteção:** Vercel Dashboard → projeto `reserva-master` → Settings → Deployment Protection → Preview.

---

## Credenciais de login (app RESERVA)

| Papel | Identificador | Senha / PIN |
|-------|---------------|-------------|
| Supervisor QA | `qa.supervisor@reserva.test` | ver `scripts/.env.qa` → `QA_SUPERVISOR_PASSWORD` |
| Pessoa E2E | mat. `999888` | ver `scripts/.env.qa` |
| JHONNY (demo parcial) | mat. `064272` | PIN temporário de import (`0000` — trocar no balcão) |

Credenciais completas em `scripts/.env.qa` (gitignored). Gerar/atualizar supervisor:

```powershell
node scripts/qa/create-supervisor-test.mjs
```

---

## Estado dos dados (teste_db — 06/06/2026)

Fonte: `scripts/import/import-final-report.md` (apply idempotente do DOCX 1º BPM).

| Tabela | Count | Notas |
|--------|-------|-------|
| `materials` | **589** | 587 clonados de prod + PAT-QA-CAR-002 + PAT-QA-MUN-001 |
| `persons` | **120** | 118 novas do import + JHONNY (064272) + TESTE QA E2E (999888) |
| `cautelas` | **119** | Permanentes abertas/parciais pós-import |
| `cautela_items` | **134** | Após remoção de 6 duplicatas |
| `ammo_batches` | **0** | Tabela criada; sem lotes seedados |

**Pendências do import:** 4 seriais ausentes no estoque (ATAIDES, VALDSON, GOUVEIA, MACEDO) — ver Etapa 4 do Plano 10/10.

> **Nota:** consulta direta via `scripts/.env.clone` em 06/06/2026 retornou 0 registros (possível reset do banco ou credencial desatualizada). Revalidar counts com `node scripts/verify-supabase-connection.mjs test` ou reexecutar seeds/import se divergir.

---

## Comandos executados nesta sessão

```powershell
# 1. Fix ammo_batches (idempotente via Management API)
node scripts/fix-ammo-batches-test.mjs

# 2. Seeds QA
node scripts/qa/sync-glock-charger-pool.mjs              # dry-run pool Glock 9mm
node scripts/qa/sync-glock-charger-pool.mjs --apply       # teste_db: total = 3×N pistolas (só seed QA)
node scripts/qa/seed-pack-accessories.mjs --apply         # munição QA + delega carregadores ao sync acima
node scripts/qa/create-supervisor-test.mjs
node scripts/qa/seed-partial-return-demo.mjs --apply   # após criar JHONNY

# 3. Import cautelados 1º BPM (teste_db)
node scripts/import/parse-cautelados-docx.mjs --input scripts/import/cautelados-1bpm-atualizada-2026-06-06.docx
node scripts/import/import-cautelados-test.mjs --apply

# 4. Ambiente local → teste_db
powershell -File scripts/switch-env-test.ps1

# 5. Testes
npm test                    # Vitest: 2 passed
npm run test:e2e            # local: 1 passed

# E2E remoto (Vercel) — carregar secrets de scripts/.env.qa antes
$env:E2E_BASE_URL="https://reserva-teste.vercel.app"
# $env:VERCEL_AUTOMATION_BYPASS_SECRET — ver scripts/.env.qa
$env:CI="1"
npm run test:e2e            # remoto: 1 passed

# 6. Verificação API
npx vercel curl https://reserva-teste.vercel.app/api/version
```

---

## GitHub CLI e secrets

- **gh instalado em:** `%LOCALAPPDATA%\Programs\gh\gh.exe` (v2.67.0)
- **Status auth:** não autenticado — execute:

```powershell
gh auth login
powershell -ExecutionPolicy Bypass -File scripts/set-github-secrets.ps1
```

Secrets a configurar (ver `docs/SETUP-SECRETS-GITHUB.md`):

| Secret | Valor |
|--------|-------|
| `E2E_SUPERVISOR_EMAIL` | `qa.supervisor@reserva.test` |
| `E2E_SUPERVISOR_PASSWORD` | em `scripts/.env.qa` |
| `E2E_BASE_URL` | `https://reserva-teste.vercel.app` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | em `scripts/.env.qa` ou Dashboard Vercel |
| `SUPABASE_ACCESS_TOKEN` | em `scripts/.env.clone` |
| `SUPABASE_TEST_DB_PASSWORD` | senha Postgres teste_db |

---

## Evidências

### `/api/version` (06/06/2026 — Etapa 0)

```json
{
  "app": "RESERVA",
  "framework": "next",
  "supabaseEnv": "teste_db",
  "supabaseRef": "ajyvznrmbuistlcfckuh",
  "vercelEnv": "preview",
  "vercelGitCommitSha": "5e9464d721c28f1fca4bba7720cb5b1b525eeac7",
  "vercelGitCommitRef": "master"
}
```

### Counts teste_db (pós-import — `import-final-report.md`)

```json
{
  "materials": 589,
  "persons": 120,
  "cautelas": 119,
  "cautela_items": 134,
  "ammo_batches": 0
}
```

---

## Correções de código aplicadas

| Arquivo | Alteração |
|---------|-----------|
| `tests/e2e/smoke.spec.ts` | Aguarda nav; link Cautelas com `exact: true` |
| `playwright.config.ts` | Suporte `VERCEL_AUTOMATION_BYPASS_SECRET` |
| `.github/workflows/ci.yml` | Passa bypass secret no job E2E |
| `scripts/fix-ammo-batches-test.mjs` | Fix idempotente ammo_batches |
| `scripts/set-github-secrets.ps1` | Sem bypass hardcoded; lê de env / `.env.qa` |
| `scripts/qa/create-supervisor-test.mjs` | Senha gerada ou lida de `.env.qa` (não versionada) |
| `PRD.md` | Sincronizado com Obsidian PRD v1.4 |

---

## Test plan rápido (regressão manual)

- [ ] Acessar via link bypass → login supervisor
- [ ] Nova cautela diária com mat. `999888` + PIN (ver `.env.qa`)
- [ ] JHONNY (064272): cautela demo com 3 linhas → devolução parcial
- [ ] Relatório `/reports/divergencias`
- [ ] `/ammo-batches` (tabela vazia, UI carrega)

---

## Pool carregadores Glock 9mm (teste_db)

> **Regra 3×N é somente seed/sync no `teste_db`**, para alinhar QA com a realidade operacional. **Não** é regra da Nova Cautela em produção ou preview: o operador informa qualquer quantidade, limitada apenas ao saldo **disponível** no pool.

| Comando | Efeito |
|---------|--------|
| `node scripts/qa/sync-glock-charger-pool.mjs` | Dry-run: N pistolas Glock 9mm → alvo `3×N` carregadores `PAT-GLK-POOL-*` |
| `node scripts/qa/sync-glock-charger-pool.mjs --apply` | Aplica inserts/retires no teste_db |
| Relatório | `scripts/qa/sync-glock-charger-pool-report.md` |

### Validação automática (06/06/2026)

| Verificação | Resultado |
|-------------|-----------|
| `npx tsc --noEmit` | ✅ sem erros |
| `npm run build` | ✅ sem erros |
| Sync dry-run (`scripts/.env.clone`) | ✅ pool alinhado: **90** pistolas → **270** carregadores (`PAT-GLK-POOL-*`) |
| Disponíveis / em uso | **269** disponíveis, **1** cautelado (insert/retire = 0) |
| Nova Cautela (código) | ✅ `resolvePackAccessoriesForWeapon` + N linhas qty 1 em `CautelaMaterialsStep` |
| Devolução parcial (código) | ✅ `cautela-return` usa `materialStatusAfterReturn` — linha qty 1 liberada ao devolver 1 unidade |
| Legado import | ⚠️ **57** cautelas abertas com Glock **sem** linha de carregador (flag no relatório sync) |

### Checklist manual (reserva-teste)

- [ ] Nova Cautela → pistola Glock 9mm → QTD carregadores = 3 → **3 linhas distintas** no pacote
- [ ] QTD > disponível → alerta *"Só há X carregador(es) disponível(is) no pool"*
- [ ] Devolução parcial de 1 carregador (linha qty 1) → +1 disponível em `/materials` (filtro CARREGADOR)
- [ ] Cautela permanece `partial` até encerrar saldo

---

## Lacunas conhecidas

- GitHub secrets pendentes de `gh auth login` manual
- Rotação do bypass Vercel após exposição em docs (ação manual no Dashboard)
- `ammo_batches` sem dados seed (tabela OK)
- 4 seriais faltantes no estoque — Etapa 4
- 57 cautelas Glock sem carregador — backfill na Etapa 4
- Prod sem persons/cautelas — import legado não replicado (só teste_db)
