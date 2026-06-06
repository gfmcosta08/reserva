# E2E Playwright — RESERVA

Smoke mínimo: login supervisor + navegação até `/cautelas`.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `E2E_SUPERVISOR_EMAIL` | Sim | E-mail do operador QA (ex.: `qa.supervisor@reserva.test`) |
| `E2E_SUPERVISOR_PASSWORD` | Sim | Senha do operador — ver `docs/QA-E2E-TESTE-REPORT.md` |
| `E2E_BASE_URL` | Não | URL da app (default `http://localhost:3000`) |

A app deve apontar para **teste_db** (`ajyvznrmbuistlcfckuh`) via `NEXT_PUBLIC_SUPABASE_*` em `.env.local` — use `scripts/switch-env-test.ps1`.

## Executar localmente

```powershell
# Terminal 1 — app (se não usar webServer automático do Playwright)
npm run dev

# Terminal 2 — E2E
$env:E2E_SUPERVISOR_EMAIL = "qa.supervisor@reserva.test"
$env:E2E_SUPERVISOR_PASSWORD = "<senha QA>"
npm run test:e2e
```

Com UI: `npm run test:e2e:ui`

## CI (GitHub Actions)

Secrets opcionais no repositório:

- `E2E_SUPERVISOR_EMAIL`
- `E2E_SUPERVISOR_PASSWORD`
- `E2E_BASE_URL` (ex.: preview Vercel do ambiente teste)

Se os secrets de credencial não existirem, o job E2E é ignorado (não falha o pipeline).
