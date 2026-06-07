import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

/**
 * Rota de teste Sentry (Etapa 6). Ativar com SENTRY_DEBUG_ROUTE=1 no ambiente.
 * GET /api/sentry-test → lança erro controlado para validar ingestão.
 * captureException explícito: Next.js 14 não expõe onRequestError (requer 15+).
 */
export const dynamic = "force-dynamic"

export async function GET() {
  if (process.env.SENTRY_DEBUG_ROUTE !== "1") {
    return NextResponse.json({ error: "Rota desabilitada" }, { status: 404 })
  }
  const err = new Error("Sentry test error — RESERVA Etapa 6 QA")
  Sentry.captureException(err)
  await Sentry.flush(2000)
  throw err
}
