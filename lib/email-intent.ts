/**
 * Envio real de e-mail usa Resend em [app/api/email/route.ts](app/api/email/route.ts).
 * Use apenas para diagnóstico local quando necessário (não grava fila nem simula envio).
 */
export function logEmailIntentDev(tag: string, payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "development" && process.env.DEBUG_EMAIL_INTENT === "1") {
    console.info(`[email-intent] ${tag}`, payload)
  }
}
