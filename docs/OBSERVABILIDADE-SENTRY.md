# Observabilidade — Sentry (Track C / M0)

Integração preparada; **build e runtime funcionam sem DSN**.

## Ativar

1. Crie projeto em [sentry.io](https://sentry.io) (Next.js).
2. Configure variáveis (Vercel ou `.env.local` — não commitar):

| Variável | Onde | Descrição |
|----------|------|-----------|
| `NEXT_PUBLIC_SENTRY_DSN` | Client + fallback server | DSN público do projeto |
| `SENTRY_DSN` | Server (opcional) | DSN server-side se diferente |
| `SENTRY_ORG` | Build (opcional) | Upload de source maps no CI |
| `SENTRY_PROJECT` | Build (opcional) | Id do projeto Sentry |
| `SENTRY_AUTH_TOKEN` | CI (opcional) | Token para upload de source maps |

3. Redeploy. Erros não tratados e falhas de Server Actions passam a aparecer no Sentry.

## Arquivos

- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- `instrumentation.ts` — hook Next.js + `onRequestError`
- `next.config.mjs` — `withSentryConfig` só quando DSN presente

## Tags nos fluxos críticos (Etapa 6)

`lib/sentry-flow.ts` define `tagCautelaFlow` e `captureCautelaFlowError`:

| Tag | Valores | Onde |
|-----|---------|------|
| `flow` | `cautela_create`, `cautela_return` | `createCautela`, `POST /api/cautela-return` |
| `cautela_id` | UUID da cautela | Após sucesso ou no catch de devolução |

Sem DSN configurado, as funções são no-op (zero impacto em build/runtime).

## Erro de teste controlado

1. Defina `SENTRY_DEBUG_ROUTE=1` no ambiente Vercel (Preview) **temporariamente**.
2. `GET /api/sentry-test` → deve aparecer no Sentry como `Sentry test error — RESERVA Etapa 6 QA`.
3. Remova `SENTRY_DEBUG_ROUTE` após validação.

## Alertas recomendados (Dashboard Sentry)

| Alerta | Condição |
|--------|----------|
| 5xx em preview/prod | `level:error` + URL contém `reserva` |
| Falha migration CI | GitHub Actions → notificar canal ops (fora do Sentry) |
| Flood de ruído | Filtrar `/api/sentry-test` após QA |

## Status Etapa 6 (2026-06-06)

| Item | Status |
|------|--------|
| Código Sentry (`@sentry/nextjs`, configs, tags cautela) | ✅ |
| Rota `GET /api/sentry-test` + `force-dynamic` | ✅ |
| Middleware libera `/api/sentry-test` (sem auth) | ✅ |
| `SENTRY_DEBUG_ROUTE=1` em Vercel Preview (branch `master`) | ✅ |
| `NEXT_PUBLIC_SENTRY_DSN` em Vercel | ⛔ **ausente** |
| Evento visível no dashboard Sentry | ⛔ **bloqueado** (sem DSN) |

### Bloqueador — DSN manual (5 min)

1. [sentry.io](https://sentry.io) → **Create project** → plataforma **Next.js**.
2. Copie o **DSN** (formato `https://<key>@o<org>.ingest.us.sentry.io/<project>`).
3. Vercel → **reserva-master** → Settings → Environment Variables:
   - `NEXT_PUBLIC_SENTRY_DSN` = DSN → marque **Preview** e **Production**.
4. Redeploy Preview (`git push` ou `npx vercel deploy --yes`) + alias `reserva-teste`.
5. `npx vercel curl https://reserva-teste.vercel.app/api/sentry-test` → esperado **HTTP 500** com mensagem `Sentry test error — RESERVA Etapa 6 QA`.
6. Confirme o evento no dashboard Sentry → Issues.
7. Remova `SENTRY_DEBUG_ROUTE` da Vercel após validação.

**Nota:** `SENTRY_DEBUG_ROUTE=1` no ambiente de build quebra o deploy se a rota não tiver `export const dynamic = "force-dynamic"` — já corrigido.

### API Sentry (automação)

Não foi possível criar projeto via API: `SENTRY_AUTH_TOKEN` ausente no ambiente local, Vercel e GitHub (gh não autenticado nesta sessão).

## Próximos passos

- [ ] Responsável: criar projeto Sentry + `NEXT_PUBLIC_SENTRY_DSN` em Preview e Production
- [ ] Validar ingestão via `/api/sentry-test`
- [ ] Remover `SENTRY_DEBUG_ROUTE` após certificação Etapa 6
