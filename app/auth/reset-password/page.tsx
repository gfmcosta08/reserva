"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase-client"
import { useRouter } from "next/navigation"
import { Lock, CheckCircle } from "lucide-react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const router = useRouter()

  // O Supabase injeta o token na URL como hash — precisa estar no cliente
  useEffect(() => {
    const supabase = createClient()
    // Detectar sessão a partir do hash da URL (token de reset)
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // sessão pronta, o form pode submeter
      }
    })
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.")
      return
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError("Não foi possível redefinir a senha. O link pode ter expirado. Solicite um novo.")
    } else {
      setDone(true)
      setTimeout(() => router.push("/auth/login"), 3000)
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[50vw] w-[50vw] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/5 bg-slate-900/40 p-8 sm:p-10 shadow-2xl backdrop-blur-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-900/50">
            <span className="text-3xl font-black text-white">R</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">RESERVA</h2>
          <p className="mt-1.5 text-sm font-medium text-slate-400">Sistema de Controle de Material</p>
        </div>

        {done ? (
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-6 text-center animate-in fade-in slide-in-from-top-3">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-400" />
            <p className="text-sm font-bold text-green-300">Senha redefinida com sucesso!</p>
            <p className="mt-1 text-xs text-green-400/80">Redirecionando para o login...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Nova senha</h3>
              <p className="text-xs text-slate-400">Defina uma nova senha para sua conta.</p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-400 animate-in fade-in slide-in-from-top-3">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Nova Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-700/50 bg-slate-800/50 pl-10 pr-4 py-3 text-white placeholder-slate-500 shadow-inner transition-all hover:border-slate-600 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="block w-full rounded-xl border border-slate-700/50 bg-slate-800/50 pl-10 pr-4 py-3 text-white placeholder-slate-500 shadow-inner transition-all hover:border-slate-600 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Repita a nova senha"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center overflow-hidden rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:scale-[1.02] hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="relative">{loading ? "Salvando..." : "Redefinir Senha"}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
