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
    .maybeSingle()

  // 🔒 SEGURANÇA: fail-closed — sem linha em profiles não concedemos papel de operador (evita bypass se RLS/policy falhar)
  if (!profile) {
    return { error: "Perfil operacional não encontrado. Peça a um supervisor para vincular seu usuário em profiles." }
  }

  if (profile.is_active === false) {
    return { error: "Conta desativada. Contate um supervisor." }
  }

  if (!ALLOWED_CAUTELA_ROLES.includes(profile.role as (typeof ALLOWED_CAUTELA_ROLES)[number])) {
    return { error: "Apenas operadores autorizados podem realizar esta ação" }
  }

  return {
    user,
    profile: {
      role: profile.role,
      name: profile.name,
      email: profile.email,
      is_active: profile.is_active !== false,
    },
  }
}
