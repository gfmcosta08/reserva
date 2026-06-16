import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase-server"

/** Valores alinhados a `profiles.role` em [supabase/migrations/20260323000000_initial_schema.sql](supabase/migrations/20260323000000_initial_schema.sql) */
const ALLOWED_CAUTELA_ROLES = ["operator", "supervisor"] as const

export type CautelaOperatorProfile = {
  role: string
  name: string
  email: string
  is_active: boolean
}

export async function requireCautelaOperatorOrThrow(): Promise<{ user: User; profile: CautelaOperatorProfile }> {
  const result = await requireCautelaOperator()
  if ("error" in result) throw new Error(result.error)
  return result
}

export function cautelaAuthHttpStatus(error: string): 401 | 403 {
  return error === "Operador não autenticado" ? 401 : 403
}

export async function requireCautelaOperator(): Promise<
  { user: User; profile: CautelaOperatorProfile } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Operador não autenticado" }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, name, email, is_active")
    .eq("id", user.id)
    .single()

  if (error || !profile) {
    return { error: "Perfil não encontrado" }
  }

  if (!profile.is_active) {
    return { error: "Operador inativo" }
  }

  if (!ALLOWED_CAUTELA_ROLES.includes(profile.role as any)) {
    return { error: "Acesso negado: perfil sem permissão" }
  }

  return { user, profile }
}
