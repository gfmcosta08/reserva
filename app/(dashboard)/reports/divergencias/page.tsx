import { createClient } from "@/lib/supabase-server"
import DivergencesReportClient from "./DivergencesReportClient"
import { ShieldAlert, AlertTriangle, Package, XCircle, RotateCcw } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DivergencesReportPage() {
  const supabase = await createClient()

  // Buscar dados do usuário
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-400">Faça login para acessar</p>
      </div>
    )
  }

  // Buscar dados completos do perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-400">Perfil não encontrado</p>
      </div>
    )
  }

  return (
    <DivergencesReportClient user={{ email: user.email || "", role: profile.role }} />
  )
}
