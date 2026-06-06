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

## Próximos passos (pós-M0)

- Alertas 5xx e falha de migration no GitHub Actions
- Tags `cautela_id` / `flow` nos fluxos de cautela e devolução (`Sentry.setTag`)
