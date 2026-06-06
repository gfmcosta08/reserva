# Configurar secrets no GitHub (CI + migrations)

> Execute **uma vez** em: GitHub → repositório → **Settings → Secrets and variables → Actions**.

O `gh` CLI não está instalado nesta máquina; use a UI ou instale: `winget install GitHub.cli`

## Secrets obrigatórios para CI E2E

| Secret | Valor | Uso |
|--------|-------|-----|
| `E2E_SUPERVISOR_EMAIL` | `qa.supervisor@reserva.test` | Smoke Playwright no CI |
| `E2E_SUPERVISOR_PASSWORD` | Senha em `scripts/.env.qa` (gerada por `node scripts/qa/create-supervisor-test.mjs`) | Smoke Playwright |
| `E2E_BASE_URL` | `https://reserva-teste.vercel.app` | Opcional; preview precisa estar **sem** SSO bloqueando |

## Secrets para migrations (teste_db primeiro)

| Secret | Valor | Uso |
|--------|-------|-----|
| `SUPABASE_ACCESS_TOKEN` | [Dashboard Supabase → Account → Access Tokens](https://supabase.com/dashboard/account/tokens) | CLI `db push` |
| `SUPABASE_TEST_DB_PASSWORD` | Senha do Postgres do projeto `ajyvznrmbuistlcfckuh` | `deploy-test.yml` |
| `SUPABASE_TEST_PROJECT_REF` | `ajyvznrmbuistlcfckuh` | Opcional (já no workflow como fallback) |

## Secrets para produção (somente após aprovação)

| Secret | Valor | Uso |
|--------|-------|-----|
| `SUPABASE_DB_PASSWORD` | Senha Postgres prod `mxlgkpfiugbodocyleij` | `deploy.yml` manual com `MIGRATE` |

## Comandos `gh` (se instalar CLI)

```powershell
gh secret set E2E_SUPERVISOR_EMAIL --body "qa.supervisor@reserva.test"
gh secret set E2E_SUPERVISOR_PASSWORD --body "<senha>"
gh secret set E2E_BASE_URL --body "https://reserva-teste.vercel.app"
gh secret set SUPABASE_ACCESS_TOKEN --body "<token>"
gh secret set SUPABASE_TEST_DB_PASSWORD --body "<senha-teste>"
gh secret set SUPABASE_DB_PASSWORD --body "<senha-prod>"
```

## Vercel — Deployment Protection (preview)

Para E2E remoto e QA em `reserva-teste.vercel.app`:

1. Vercel Dashboard → projeto `reserva-master` → **Settings → Deployment Protection**
2. Em **Preview**: desativar SSO/Vercel Authentication **ou** configurar bypass token para CI
3. Alternativa: `npx vercel curl https://reserva-teste.vercel.app/api/version`

## Sentry (opcional)

Vercel → Environment Variables (Preview + Production):

- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN`

Ver `docs/OBSERVABILIDADE-SENTRY.md`.
