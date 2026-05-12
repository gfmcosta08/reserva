"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase-client"
import { useRouter } from "next/navigation"
import { ArrowLeft, Mail, Lock, Send } from "lucide-react"

type Mode = "login" | "forgot"

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError("E-mail ou senha inválidos. Verifique seus dados e tente novamente.")
      setLoading(false)
    } else {
      router.push("/")
      router.refresh()
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError("Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.")
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[50vw] w-[50vw] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/5 bg-slate-900/40 p-8 sm:p-10 shadow-2xl backdrop-blur-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-900/50">
            <span className="text-3xl font-black text-white">R</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">RESERVA</h2>
          <p className="mt-1.5 text-sm font-medium text-slate-400">Sistema de Controle de Material</p>
        </div>

        {/* ── LOGIN ── */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-400 animate-in fade-in slide-in-from-top-3">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                E-mail Operacional
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-slate-700/50 bg-slate-800/50 pl-10 pr-4 py-3 text-white placeholder-slate-500 shadow-inner transition-all hover:border-slate-600 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="operador@reserva.gov"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-700/50 bg-slate-800/50 pl-10 pr-4 py-3 text-white placeholder-slate-500 shadow-inner transition-all hover:border-slate-600 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setMode("forgot"); setError(null) }}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center overflow-hidden rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:scale-[1.02] hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-50"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                <div className="relative h-full w-8 bg-white/20" />
              </div>
              <span className="relative">{loading ? "Autenticando..." : "Acessar Sistema"}</span>
            </button>
          </form>
        )}

        {/* ── RECUPERAR SENHA ── */}
        {mode === "forgot" && (
          <div className="space-y-5">
            <button
              onClick={() => { setMode("login"); setError(null); setResetSent(false) }}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao login
            </button>

            {resetSent ? (
              <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-5 text-center animate-in fade-in slide-in-from-top-3">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <Send className="h-5 w-5 text-green-400" />
                </div>
                <p className="text-sm font-bold text-green-300">Link enviado!</p>
                <p className="mt-1 text-xs text-green-400/80">
                  Verifique sua caixa de entrada em <span className="font-semibold">{email}</span> e clique no link para redefinir sua senha.
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Recuperar senha</h3>
                  <p className="text-xs text-slate-400">
                    Informe seu e-mail cadastrado. Enviaremos um link para você criar uma nova senha.
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-400 animate-in fade-in slide-in-from-top-3">
                    {error}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    E-mail Cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-xl border border-slate-700/50 bg-slate-800/50 pl-10 pr-4 py-3 text-white placeholder-slate-500 shadow-inner transition-all hover:border-slate-600 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="operador@reserva.gov"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative flex w-full justify-center overflow-hidden rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:scale-[1.02] hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="relative">{loading ? "Enviando..." : "Enviar link de recuperação"}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
