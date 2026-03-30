import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase-server"

/** Valores alinhados a `profiles.role` em [supabase/migrations/20260323000000_initial_schema.sql](supabase/migrations/20260323000000_initial_schema.sql) */
const ALLOWED_CAUTELA_ROLES = ["operator", "supervisor"] as const

export type CautelaOperatorProfile = {
  role: string
  name: string
  email: string
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
    .select("role, name, email")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    if (error && error.code !== "PGRST116") {
      return { error: "Perfil não encontrado" }
    }
    return {
      user,
      profile: {
        role: "operator",
        name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Operador",
        email: user.email ?? "",
      },
    }
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
    },
  }
}
