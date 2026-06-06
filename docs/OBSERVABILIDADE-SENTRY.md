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
2. `GET /api/debug/sentry-test` → deve aparecer no Sentry como `Sentry test error — RESERVA Etapa 6 QA`.
3. Remova `SENTRY_DEBUG_ROUTE` após validação.

## Alertas recomendados (Dashboard Sentry)

| Alerta | Condição |
|--------|----------|
| 5xx em preview/prod | `level:error` + URL contém `reserva` |
| Falha migration CI | GitHub Actions → notificar canal ops (fora do Sentry) |
| Flood de ruído | Filtrar `/api/debug/sentry-test` após QA |

## Próximos passos

- Criar projeto Sentry + configurar `NEXT_PUBLIC_SENTRY_DSN` em Vercel Preview e Production
- Validar ingestão via rota de teste
- Remover `SENTRY_DEBUG_ROUTE` após certificação Etapa 6
