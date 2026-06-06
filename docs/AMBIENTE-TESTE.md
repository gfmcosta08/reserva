# Ambiente de teste Supabase (`teste_db`)

Espelho de **produção** (`reserva1bpmto`) para desenvolver e validar mudanças antes de promover código/schema para produção.

**Governança:** `teste_db` + https://reserva-teste.vercel.app é a **única fonte de validação** aceita. Produção (`mxlgkpfiugbodocyleij` + https://reserva1bpm.vercel.app) só após QA e **aprovação explícita**. Ver [`CHANGE-PROTOCOL.md`](./CHANGE-PROTOCOL.md) § 5 e [`PLANO-PRODUTO-VERTICAL.md`](./PLANO-PRODUTO-VERTICAL.md) § Governança.

## Referências de projeto

| Ambiente | Nome no Dashboard | Project ref (confirmar em Settings → General) |
|----------|-------------------|-----------------------------------------------|
| **Produção** | reserva1bpmto | `mxlgkpfiugbodocyleij` |
| **Teste** | teste_bd | `ajyvznrmbuistlcfckuh` |

URLs: `https://<PROJECT_REF>.supabase.co`

O token `SUPABASE_ACCESS_TOKEN` da sua máquina precisa ser da **mesma conta/org** que esses projetos (org `reserva1bpmto` no Dashboard). Se `npx supabase projects list` não listar RESERVA, gere um token em [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) na conta correta.

## Clonagem completa (uma vez)

### 1. Credenciais

```powershell
cd "d:\Sistemas\Controle de material"
copy scripts\env.clone.example scripts\.env.clone
# Edite scripts\.env.clone com senhas e keys do Dashboard (produção + teste)
```

| Variável | Onde obter |
|----------|------------|
| `SUPABASE_*_DB_PASSWORD` | Settings → Database → Database password |
| `SUPABASE_*_SERVICE_ROLE_KEY` | Settings → API → service_role (secret) |
| `SUPABASE_TEST_ANON_KEY` | Settings → API → anon public |
| `SUPABASE_ACCESS_TOKEN` | [Account tokens](https://supabase.com/dashboard/account/tokens) |

### 2. Executar clone

```powershell
.\scripts\clone-supabase.ps1
```

Etapas automáticas:

1. `supabase db push` no **teste** (12 migrations em `supabase/migrations/`)
2. Dump **dados** `public` + `auth` da produção
3. Restore no teste (`psql` ou arquivos em `scripts/dumps/` para SQL Editor manual)
4. Cópia do bucket Storage **`documents`** (se service_role definidas)
5. Lembrete para rodar [`scripts/rewrite-storage-urls.sql`](../scripts/rewrite-storage-urls.sql) no teste (trocar `SEU_REF_TESTE`)

Flags: `-SkipSchema`, `-SkipData`, `-SkipStorage`, `-SkipUrlRewrite`

### 3. Apontar o app local para teste

```powershell
.\scripts\switch-env-test.ps1
npm run dev
```

Volta para produção local:

```powershell
.\scripts\switch-env-production.ps1
```

**Vercel Production** continua com as variáveis de `reserva1bpmto` — não altere sem querer.

## Checklist pós-clonagem

- [ ] Login operador e supervisor em `/auth/login`
- [ ] `/materials`, `/persons`, `/cautelas` listam dados
- [ ] Foto de RG abre (URL com ref do **teste**)
- [ ] Dashboard e `/alerts` coerentes
- [ ] `npm run build` sem erro

## Fluxo contínuo (promoção)

```text
1. Nova migration em supabase/migrations/
2. supabase db push --project-ref ajyvznrmbuistlcfckuh   (teste_db — SEMPRE primeiro)
3. App local (switch-env-test.ps1) e/ou reserva-teste.vercel.app → validar + QA
4. Aprovação explícita do responsável ("Aprovado para produção")
5. supabase db push --project-ref mxlgkpfiugbodocyleij   (produção — só após passo 4)
6. git push master → Vercel deploy Production (código)
```

**Não** copiar dados de teste de volta para produção — só código e schema.
**Não** pular etapas 2–4: produção sem gate é violação do protocolo.

## CI (GitHub)

| Workflow | Gatilho | Banco | Papel |
|----------|---------|-------|-------|
| [`deploy-test.yml`](../.github/workflows/deploy-test.yml) | `workflow_dispatch` (manual) | `ajyvznrmbuistlcfckuh` (teste_db) | **Primeiro** — migrations de validação |
| [`deploy.yml`](../.github/workflows/deploy.yml) | `push` em `master` | `mxlgkpfiugbodocyleij` (prod) | **Último** — só após aprovação humana |

O M0 prevê evoluir `deploy.yml` para exigir gate explícito (ex.: `workflow_dispatch` ou job condicional) em vez de `db push` automático em prod. Até lá, a aprovação é controle de processo documentado em [`CHANGE-PROTOCOL.md`](./CHANGE-PROTOCOL.md).

## Importação cautelados (legado 1º BPM)

Relatório DOCX/CSV → `persons` + cautelas permanentes em **teste** (não altera produção).

```powershell
node scripts/import/parse-cautelados-docx.mjs
node scripts/import/import-cautelados-test.mjs          # dry-run
node scripts/import/import-cautelados-test.mjs --apply    # grava em teste_bd
```

Detalhes: [`scripts/import/README.md`](../scripts/import/README.md). Relatório: `scripts/import/dry-run-report.md`.

Pessoas importadas ficam com cadastro incompleto (fotos, WhatsApp, PIN real, biometria, e-mail) até atualização em `/persons`.

## Arquivos relacionados

| Arquivo | Função |
|---------|--------|
| [`scripts/clone-supabase.ps1`](../scripts/clone-supabase.ps1) | Orquestra clonagem |
| [`scripts/clone-storage-documents.mjs`](../scripts/clone-storage-documents.mjs) | Bucket `documents` |
| [`scripts/env.clone.example`](../scripts/env.clone.example) | Modelo de credenciais |
| [`scripts/rewrite-storage-urls.sql`](../scripts/rewrite-storage-urls.sql) | Atualiza URLs em `persons` |

## Bloqueio comum: token da CLI em outra conta

Se `npx supabase projects list` **não** mostrar `reserva1bpmto` / `teste_db`, o `SUPABASE_ACCESS_TOKEN` é de outra organização. Gere um token na conta que vê esses projetos no Dashboard e coloque em `scripts/.env.clone`.

## Histórico de clonagem

| Data | Responsável | Notas |
|------|-------------|-------|
| 2026-05-18 | Clone executado | Migrations via API; 587 materials + 1 profile + 1 auth user; bucket `documents` criado no teste; `.env.local` → teste |
