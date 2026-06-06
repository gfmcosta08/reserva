import { NextResponse } from "next/server"
import { cautelaAuthHttpStatus, requireCautelaOperator } from "@/lib/auth-cautela"

/** Guarda rotas API sensíveis: 401 sem sessão, 403 sem operador ativo. */
export async function requireApiCautelaOperator() {
  const auth = await requireCautelaOperator()
  if ("error" in auth) {
    return {
      response: NextResponse.json(
        { error: auth.error },
        { status: cautelaAuthHttpStatus(auth.error) }
      ),
    }
  }
  return { auth }
}
