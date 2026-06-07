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

## Status Etapa 6 (2026-06-06) — ✅ certificada

| Item | Status |
|------|--------|
| Código Sentry (`@sentry/nextjs`, configs, tags cautela) | ✅ |
| Rota `GET /api/sentry-test` + `force-dynamic` + `captureException` | ✅ |
| Middleware libera `/api/sentry-test` (sem auth) | ✅ |
| Projeto Sentry via Vercel Marketplace (`reserva-sentry`, plano Developer) | ✅ |
| `NEXT_PUBLIC_SENTRY_DSN` em Vercel Preview + Production | ✅ |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (integração) | ✅ |
| `GET /api/sentry-test` → HTTP 500 (com `SENTRY_DEBUG_ROUTE=1`) | ✅ |
| Evento no Sentry (`Sentry test error — RESERVA Etapa 6 QA`) | ✅ API 2026-06-07 |
| `SENTRY_DEBUG_ROUTE` removido pós-QA | ✅ |

### Provisionamento automatizado (sem dashboard manual)

1. `vercel integration add sentry` → termos aceitos via API Vercel (`auto-provision` + `billingPlanId: am3_f`).
2. Recurso `reserva-sentry` conectado ao projeto `reserva-master` (Preview + Production).
3. Redeploy + alias `reserva-teste` → `reserva-master-dp0gijuva`.
4. Validação: `vercel curl /api/sentry-test` → 500; Sentry API `/projects/reserva-sentry/reserva-sentry/events/` → issue confirmada.

**Nota Next.js 14:** `onRequestError` exige Next.js 15+; a rota de teste usa `Sentry.captureException` + `flush` antes do throw.

### Rota de debug

`SENTRY_DEBUG_ROUTE` foi **removida** da Vercel após certificação. Para revalidar ingestão no futuro, reative temporariamente em Preview e remova após o teste.
