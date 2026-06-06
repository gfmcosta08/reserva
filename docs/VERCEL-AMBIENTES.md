# Vercel — ambientes RESERVA

Projeto Vercel: **reserva-master** (`prj_gbNPiYncv4ZWFJsvC8gtVyuY2uZa`)

## URLs oficiais

| Ambiente | URL | Banco Supabase | Quando usar |
|----------|-----|----------------|-------------|
| **Produção** | https://reserva1bpm.vercel.app | `mxlgkpfiugbodocyleij` (reserva1bpmto) | Operação real |
| **Teste / QA** | https://reserva-teste.vercel.app (alias do Preview) | `ajyvznrmbuistlcfckuh` (teste_bd) | **Fonte única de validação** — toda mudança entra aqui primeiro |

Confirme no navegador:

`https://<url>/api/version`

| Campo | Produção | Teste |
|-------|----------|-------|
| `supabaseEnv` | `producao` | `teste_db` |
| `supabaseRef` | `mxlgkpfiugbodocyleij` | `ajyvznrmbuistlcfckuh` |
| `vercelEnv` | `production` | `preview` |

## Variáveis na Vercel

| Variável | Production | Preview | Development |
|----------|------------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | prod | **teste** | **teste** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod | **teste** | **teste** |
| `RESERVA_SUPABASE_ENV` | `producao` | `teste_db` | `teste_db` |

Alterações via CLI (token em `VERCEL_TOKEN`) ou Dashboard → Settings → Environment Variables.

## Fluxo de release (governança teste → produção)

**Regra:** produção (`reserva1bpm.vercel.app` + `mxlgkpfiugbodocyleij`) **não** recebe mudanças sem validação e aprovação no teste.

1. **Implementar** em branch local → migration em **teste_bd** (`ajyvznrmbuistlcfckuh`).
2. **Publicar Preview** (`vercel deploy` ou push em branch ≠ `master`) → validar em https://reserva-teste.vercel.app.
3. **QA** — `npm run build`, fluxos manuais (cautela, materiais, pessoas, relatórios, auth); E2E quando disponível.
4. **Aprovação explícita** — responsável confirma *"Aprovado para produção"* (conversa, PR ou checklist do milestone).
5. **Promover** — migration em prod + merge em `master` → deploy Production.

Até o gate de CI do M0 estar completo, trate o passo 4 como controle humano obrigatório mesmo que `deploy.yml` dispare em `master`. Ver [`CHANGE-PROTOCOL.md`](./CHANGE-PROTOCOL.md) e [`PLANO-PRODUTO-VERTICAL.md`](./PLANO-PRODUTO-VERTICAL.md).

## Branch `staging` (recomendado)

Crie a branch `staging` no Git para URL estável de Preview:

```bash
git checkout -b staging
git push -u origin staging
```

URL fixa de branch: `https://reserva-master-git-staging-<team>.vercel.app` (também usa env Preview = teste_db).

## Proteção de Preview (importante para testes)

Deploys Preview exigem login Vercel por padrão. Para o agente ou scripts acessarem sem browser:

```powershell
# API / version (recomendado)
npx vercel curl "https://reserva-teste.vercel.app/api/version"
```

Para testes no navegador (MCP browser), use o bypass gerado pelo CLI ou desative **Deployment Protection** só em Preview no Dashboard → Settings → Deployment Protection.

Após cada `vercel deploy` de teste, re-aponte o alias:

```powershell
npx vercel alias set <url-do-novo-deploy> reserva-teste.vercel.app
```

## Comandos úteis

```powershell
# Novo deploy de teste (Preview)
npx vercel deploy --yes

# Alias estável (após deploy)
npx vercel alias set <url-do-deploy> reserva-teste.vercel.app

# Listar env
npx vercel env ls
```

## Produção no Dashboard

Production **não** foi alterada para teste — apenas Preview e Development recebem `teste_bd`.

Se Production ainda apontar para ref antigo (`chguaozitzwfsmqyhreb`), atualize `NEXT_PUBLIC_SUPABASE_*` em Production para `mxlgkpfiugbodocyleij` no Dashboard.
