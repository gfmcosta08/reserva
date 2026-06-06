import * as Sentry from "@sentry/nextjs"

const sentryActive = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)

export type CautelaFlow = "cautela_create" | "cautela_return"

/** Tags opcionais nos fluxos críticos — no-op sem DSN configurado. */
export function tagCautelaFlow(flow: CautelaFlow, cautelaId?: string): void {
  if (!sentryActive) return
  Sentry.setTag("flow", flow)
  if (cautelaId) Sentry.setTag("cautela_id", cautelaId)
}

export function captureCautelaFlowError(
  flow: CautelaFlow,
  error: unknown,
  cautelaId?: string
): void {
  if (!sentryActive) return
  tagCautelaFlow(flow, cautelaId)
  Sentry.captureException(error)
}
