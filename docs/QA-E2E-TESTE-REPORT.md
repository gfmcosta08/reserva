# Relatório QA E2E — Controle de Material (teste_bd)

**Data:** 06/06/2026  
**Ambiente remoto:** https://reserva-teste.vercel.app  
**Supabase:** `ajyvznrmbuistlcfckuh` (teste_db)  
**Commit deploy:** `8cad1d0` (master — inclui `f1181fc` pool Glock + filtros materiais)

---

## Resumo executivo — pronto para QA

| Área | Resultado |
|------|-----------|
| API `/api/version` | ✅ `teste_db`, commit recente |
| ammo_batches + migrations | ✅ SQL idempotente aplicado |
| Materiais clonados | ✅ 589 (587 prod + 2 QA) |
| Pessoas / cautelas demo | ✅ 2 pessoas, 1 cautela JHONNY (parcial) |
| Supervisor QA | ✅ `qa.supervisor@reserva.test` |
| Vitest (`npm test`) | ✅ 2/2 passed |
| E2E local (`localhost:3000`) | ✅ 1/1 passed |
| E2E remoto (`reserva-teste.vercel.app`) | ✅ 1/1 passed (com bypass Vercel) |
| GitHub secrets | ⏳ `gh` instalado; requer `gh auth login` |

---

## Acesso para QA no navegador

### URL principal

https://reserva-teste.vercel.app

### Bypass Deployment Protection (Vercel SSO)

O preview exige login Vercel por padrão. Use **uma** das opções:

**Opção A — Link com bypass (recomendado para QA manual):**

```
https://reserva-teste.vercel.app/auth/login?x-vercel-protection-bypass=JiWhIN8Aa7gwYvd2OtxMANYgotiH8R7h&x-vercel-set-bypass-cookie=true
```

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
| Supervisor QA | `qa.supervisor@reserva.test` | `ReservaQA2026!Super` |
| Pessoa E2E | mat. `999888` | PIN `5678` |
| JHONNY (demo parcial) | mat. `064272` | PIN `0000` |

Credenciais completas em `scripts/.env.qa` (gitignored).

---

## Estado dos dados (teste_db — 06/06/2026)

| Tabela | Count | Notas |
|--------|-------|-------|
| `materials` | **589** | 587 clonados de prod + PAT-QA-CAR-002 + PAT-QA-MUN-001 |
| `persons` | **2** | JHONNY (064272) + TESTE QA E2E BROWSER (999888) |
| `cautelas` | **1** | Demo parcial JHONNY — `dd414536-cfb8-4c32-9fda-b78e55b4b5b7` |
| `cautela_items` | **3** | Pistola PAT-00272 + 3 carregadores + 50 munições |
| `ammo_batches` | **0** | Tabela criada; sem lotes seedados |

**Prod** tinha 587 materiais e **0** persons/cautelas — clone de pessoas não aplicável; seeds QA usados.

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

# 3. Ambiente local → teste_db
powershell -File scripts/switch-env-test.ps1

# 4. Testes
npm test                    # Vitest: 2 passed
npm run test:e2e            # local: 1 passed

# E2E remoto (Vercel)
$env:E2E_BASE_URL="https://reserva-teste.vercel.app"
$env:VERCEL_AUTOMATION_BYPASS_SECRET="JiWhIN8Aa7gwYvd2OtxMANYgotiH8R7h"
$env:CI="1"
npm run test:e2e            # remoto: 1 passed

# 5. Verificação API
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
| `VERCEL_AUTOMATION_BYPASS_SECRET` | bypass Vercel (Dashboard ou `vercel curl -v`) |
| `SUPABASE_ACCESS_TOKEN` | em `scripts/.env.clone` |
| `SUPABASE_TEST_DB_PASSWORD` | senha Postgres teste_db |

---

## Evidências

### `/api/version`

```json
{
  "app": "RESERVA",
  "framework": "next",
  "supabaseEnv": "teste_db",
  "supabaseRef": "ajyvznrmbuistlcfckuh",
  "vercelEnv": "preview",
  "vercelGitCommitSha": "b9a5c547bfcbd829803c9536e7fe2cf83d748d07",
  "vercelGitCommitRef": "master"
}
```

### Counts teste_db

```json
{
  "materials": 589,
  "persons": 2,
  "cautelas": 1,
  "cautela_items": 3,
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
| `scripts/set-github-secrets.ps1` | Automação secrets após `gh auth login` |

---

## Test plan rápido (regressão manual)

- [ ] Acessar via link bypass → login supervisor
- [ ] Nova cautela diária com mat. `999888` + PIN `5678`
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
- `ammo_batches` sem dados seed (tabela OK)
- Prod sem persons/cautelas — import legado não replicado
