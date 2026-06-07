# Etapa 7 — Deploy código em PRODUÇÃO (Fase 1)

**Status:** ⛔ Aguardando aprovação explícita (G2) — Etapa 6 ✅ certificada 2026-06-07  
**Ambiente:** `mxlgkpfiugbodocyleij` + https://reserva1bpm.vercel.app  
**NÃO inclui:** import em massa de cautelados (Etapa 8)

---

## Gates obrigatórios (não pular)

| # | Gate | Quem |
|---|------|------|
| G1 | Etapa 6 ✅ — evento Sentry visível no dashboard | Responsável + agente |
| G2 | Frase explícita: **"Aprovado para produção — Fase 1 código"** | Responsável (você) |
| G3 | Backup Supabase produção documentado | Responsável |
| G4 | CI verde (build + tsc + vitest + E2E) no commit a promover | Automático |

**Sem G1–G2:** não executar `vercel deploy --prod`, não disparar `deploy.yml` com `MIGRATE`.

---

## Pré-voo (checklist — executar antes do go-live)

### 1. Backup produção

```text
Supabase Dashboard → projeto reserva1bpmto (mxlgkpfiugbodocyleij)
→ Database → Backups → confirmar snapshot recente OU
→ iniciar backup manual e anotar timestamp
```

Registrar em conversa/PR:

- Data/hora do backup
- Método (snapshot automático / manual)
- Responsável

### 2. Conferir estado atual de produção

```powershell
npx vercel curl "https://reserva1bpm.vercel.app/api/version"
```

Esperado hoje (baseline):

| Campo | Valor esperado |
|-------|----------------|
| `supabaseRef` | `mxlgkpfiugbodocyleij` |
| `supabaseEnv` | `producao` |
| `vercelEnv` | `production` |

Anotar `vercelGitCommitSha` atual — rollback reference.

### 3. Variáveis Vercel Production (antes do deploy)

| Variável | Obrigatória Fase 1 |
|----------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | prod ref |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod key |
| `RESERVA_SUPABASE_ENV` | `producao` |
| `NEXT_PUBLIC_SENTRY_DSN` | após Etapa 6 ✅ |

### 4. Migrations pendentes

Listar diferença teste vs prod:

```powershell
# Local — requer SUPABASE_ACCESS_TOKEN
supabase migration list --project-ref ajyvznrmbuistlcfckuh
supabase migration list --project-ref mxlgkpfiugbodocyleij
```

Migrations validadas em teste_db (Etapas 2–4) devem ser as mesmas aplicadas em prod via workflow.

---

## Execução (somente após G1 + G2)

### Passo A — Promover código (Vercel Production)

```powershell
git checkout master
git pull
# Confirmar CI verde no commit
npx vercel deploy --prod --yes
```

Ou: merge em `master` → deploy automático Vercel Production.

### Passo B — Migrations produção (workflow manual)

GitHub → Actions → **Deploy Production Migrations** → `workflow_dispatch`

- Input `confirm`: digitar exatamente **`MIGRATE`**

Arquivo: `.github/workflows/deploy.yml`  
Ref alvo: `mxlgkpfiugbodocyleij`

**Proibido:** `supabase db push` direto em prod fora do workflow.

### Passo C — Validar deploy

```powershell
npx vercel curl "https://reserva1bpm.vercel.app/api/version"
```

Confirmar:

- [ ] `supabaseRef`: `mxlgkpfiugbodocyleij`
- [ ] `vercelEnv`: `production`
- [ ] `vercelGitCommitSha` = commit promovido

### Passo D — Operadores reais

- [ ] Cadastrar supervisores/operadores em `auth.users` + `profiles` (prod)
- [ ] **Não** usar contas QA (`qa.supervisor@reserva.test`, mat. `999888`)

### Passo E — Cautela de prova (reversível)

- [ ] Material dedicado de teste em prod (ou cautela mínima reversível)
- [ ] Criar cautela → devolver → inventário restaurado
- [ ] **Não** importar DOCX nesta etapa

---

## Testes pós-deploy (produção)

| Teste | Comando / ação |
|-------|----------------|
| Login operador real | Browser |
| `/materials` lista ~587 itens | Browser |
| Cautela de prova + devolução | Browser |
| Sentry recebe eventos | Dashboard Sentry |
| Sem seed QA | `grep` / listagem persons |
| Regressão build local | `npm run build` + `tsc` + `vitest` |

---

## Rollback (se algo falhar)

1. Vercel Dashboard → Deployments → promover deployment **anterior** (sha anotado no pré-voo).
2. **Não** reverter migrations automaticamente — avaliar com DBA; migrations devem ser idempotentes/reversíveis quando possível.
3. Registrar incidente na tabela de bugs do Plano 10/10.

---

## O que NÃO fazer na Etapa 7

- Import `import-cautelados-*.docx` em produção
- Copiar dados de `teste_db` → produção
- `workflow_dispatch MIGRATE` sem backup + aprovação explícita
- Deploy prod antes de Sentry DSN (aceite Etapa 7.3 exige Sentry em prod)

---

## Aprovação necessária

Responda na conversa com:

```text
Aprovado para produção — Fase 1 código
```

Somente então execute Passos A–E.

---

*Runbook gerado 2026-06-06. Etapa 6 certificada 2026-06-07. Etapa 7 permanece ⛔ até G2 ("Aprovado para produção — Fase 1 código").*
