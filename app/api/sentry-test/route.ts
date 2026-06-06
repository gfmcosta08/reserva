import { NextResponse } from "next/server"

/**
 * Rota de teste Sentry (Etapa 6). Ativar com SENTRY_DEBUG_ROUTE=1 no ambiente.
 * GET /api/sentry-test → lança erro controlado para validar ingestão.
 */
export async function GET() {
  if (process.env.SENTRY_DEBUG_ROUTE !== "1") {
    return NextResponse.json({ error: "Rota desabilitada" }, { status: 404 })
  }
  throw new Error("Sentry test error — RESERVA Etapa 6 QA")
}
