# Relatório QA E2E — Controle de Material (teste_db)

**Data:** 06/06/2026 (atualizado — Etapa 5 certificada)  
**Ambiente remoto:** https://reserva-teste.vercel.app  
**Supabase:** `ajyvznrmbuistlcfckuh` (teste_db)  
**Commit deploy:** `d313bc2` (master — ammo_batches fix, E2E-07 Etapa 5)

---

## Resumo executivo

| Área | Resultado |
|------|-----------|
| API `/api/version` | ✅ `teste_db`, commit `d313bc2` |
| Deploy alias `reserva-teste` | ✅ apontado para build `d313bc2` (06/06) |
| Materiais | ✅ **863** (service role) |
| Pessoas | ✅ **121** |
| Cautelas | ✅ **197** |
| Supervisor QA | ✅ `qa.supervisor@reserva.test` (credenciais em `scripts/.env.qa`) |
| `npm run build` | ✅ sem erro |
| `npx tsc --noEmit` | ✅ sem erro |
| Vitest (`npm test`) | ✅ **14/14** passed |
| E2E remoto CI=1 | ✅ **17/17** passed (~2.0m) |

---

## Suite E2E (17 testes)

| Spec | Testes | Cobertura |
|------|--------|-----------|
| E2E-01 | 1 | Login supervisor |
| E2E-02 | 1 | Nova cautela diária (999888) |
| E2E-03 | 1 | Devolução total |
| E2E-04 | 1 | Devolução parcial JHONNY |
| E2E-05 | 1 | Relatório divergências |
| E2E-06 | 1 | Estoque — devolução carregador pool |
| E2E-07 | 8 | Etapa 5 smoke (logout, reports, alerts, history, ammo CRUD, modal Em Uso, deep link, exports, 404 admin) |
| e2e-lists | 2 | Listagens `/materials` e `/persons` |

### Comando E2E remoto

```powershell
$env:CI="1"
$env:E2E_BASE_URL="https://reserva-teste.vercel.app"
npm run test:e2e
```

Credenciais carregadas de `scripts/.env.qa` via `playwright.config.ts`.

---

## Acesso para QA no navegador

### URL principal

https://reserva-teste.vercel.app

### Bypass Deployment Protection (Vercel SSO)

```powershell
npx vercel curl https://reserva-teste.vercel.app/api/version
```

Para QA manual no navegador, use link com bypass (valor em `scripts/.env.qa` → `VERCEL_AUTOMATION_BYPASS_SECRET`):

```
https://reserva-teste.vercel.app/auth/login?x-vercel-protection-bypass=<SECRET>&x-vercel-set-bypass-cookie=true
```

---

## Credenciais de login (app RESERVA)

| Papel | Identificador | Onde obter |
|-------|---------------|------------|
| Supervisor QA | `qa.supervisor@reserva.test` | `scripts/.env.qa` → `QA_SUPERVISOR_PASSWORD` |
| Pessoa E2E | mat. `999888` | `scripts/.env.qa` |
| JHONNY (demo parcial) | mat. `064272` | PIN import (`0000` — trocar no balcão) |

---

## Estado dos dados (teste_db — 06/06/2026)

Fonte: `node scripts/verify-supabase-connection.mjs test`

| Tabela | Count | Notas |
|--------|-------|-------|
| `materials` | **863** | 587 clone + seriais Etapa 4 + pool Glock + QA |
| `persons` | **121** | 120 import + seed E2E |
| `cautelas` | **197** | Import + seeds/backfill Glock |
| `profiles` | **2** | Operadores QA |
| `ammo_batches` | variável | CRUD validado via E2E-07 |

---

## Evidências Etapa 5 (06/06/2026)

### `/api/version`

```json
{
  "app": "RESERVA",
  "framework": "next",
  "supabaseEnv": "teste_db",
  "supabaseRef": "ajyvznrmbuistlcfckuh",
  "vercelEnv": "preview",
  "vercelGitCommitSha": "d313bc280931e9c6eea220cd0ceb608af18b0c74",
  "vercelGitCommitRef": "master"
}
```

### Regressão automática

| Comando | Resultado |
|---------|-----------|
| `npm run build` | ✅ |
| `npx tsc --noEmit` | ✅ |
| `npm test` | ✅ 14/14 |
| `npm run test:e2e` CI=1 remoto | ✅ 17/17 (~2.0m) |

---

## Roteiro manual — itens automatizados vs exceções aceitas

| Item manual Plano 5.1 | Status |
|-----------------------|--------|
| Login / logout / re-login | ✅ E2E-01 + E2E-07 |
| Listagem materiais desktop | ✅ e2e-lists |
| Listagem materiais mobile (cards) | ⏸️ manual-only (layout responsivo) |
| Criar material `stock_quantity` | ⏸️ manual-only |
| Badge Em Uso → modal | ✅ E2E-07 |
| OCR etiqueta | ⏸️ requer `OCR_SPACE_API_KEY` |
| Export Excel materials/cautelas/divergencias | ✅ E2E-07 API smoke |
| Nova cautela + Glock 3 linhas | ✅ E2E-02 |
| Devolução parcial/total | ✅ E2E-03/04 |
| Deep link cautelas | ✅ E2E-07 |
| Reports + alerts + history | ✅ E2E-07 |
| `/ammo-batches` CRUD | ✅ E2E-07 |
| `/admin` `/settings` 404 | ✅ E2E-07 (aceito) |
| Pessoas: Pendente, wizard, histórico | ⏸️ manual-only (Etapa 9 CAD) |
| PIN lockout 3 tentativas | ⏸️ manual-only |
| Item damaged → cautela divergent | ⏸️ manual-only |
| SEC-02 export sem sessão → 401 | ⏸️ manual-only (código guardado) |

---

## Correções aplicadas nesta sessão (Etapa 5)

| Arquivo | Alteração |
|---------|-----------|
| `tests/e2e/e2e-07-etapa5-smoke.spec.ts` | CRUD ammo-batches, modal Em Uso, exports cautelas/divergencias |
| `tests/e2e/e2e-06-stock.spec.ts` | Busca dinâmica + badge Em Uso como botão |
| `app/actions/ammo-batches.ts` | Removido join `profiles` (RLS) — `select("*")` |
| Alias Vercel | `reserva-teste` → deploy `d313bc2` |

---

## Referências

- Plano 10/10 Etapa 5: certificada 06/06/2026
- Etapa 6 (Sentry): `docs/OBSERVABILIDADE-SENTRY.md`
- Pool Glock: `scripts/qa/sync-glock-charger-pool-report.md`
