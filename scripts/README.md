# Scripts — clone Supabase e ambiente local

## Início rápido

```powershell
copy env.clone.example .env.clone
# Preencha senhas e keys (Dashboard Supabase, conta da org RESERVA)
.\clone-supabase.ps1
.\switch-env-test.ps1
```

## Arquivos

| Script | Descrição |
|--------|-----------|
| `clone-supabase.ps1` | Clone completo prod → teste |
| `clone-storage-documents.mjs` | Bucket `documents` |
| `switch-env-test.ps1` | `.env.local` → teste_db |
| `switch-env-production.ps1` | Restaura `.env.local` de produção |
| `verify-supabase-connection.mjs` | Contagens `prod` / `test` |
| `rewrite-storage-urls.sql` | SQL no Editor do teste |
| `env.clone.example` | Modelo de credenciais |

Documentação: [`../docs/AMBIENTE-TESTE.md`](../docs/AMBIENTE-TESTE.md)
