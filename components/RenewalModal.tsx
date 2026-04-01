"use client"

import { useState } from "react"
import { X, Calendar, Loader2, AlertCircle, CheckCircle, RefreshCw } from "lucide-react"
import { renewCautela } from "@/app/actions/cautelas"
import { format, addDays } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Cautela {
  id: string
  type: string
  status: string
  expires_at?: string | null
  persons?: {
    full_name: string
  }
}

interface RenewalModalProps {
  cautela: Cautela
  onClose: () => void
  onSuccess: () => void
}

export default function RenewalModal({ cautela, onClose, onSuccess }: RenewalModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedOption, setSelectedOption] = useState<"30" | "60" | "90" | "custom">("30")
  const [customDays, setCustomDays] = useState("30")

  const today = new Date()
  const defaultExpiration = addDays(today, 30)

  const getExpirationDate = () => {
    switch (selectedOption) {
      case "30":
        return addDays(today, 30)
      case "60":
        return addDays(today, 60)
      case "90":
        return addDays(today, 90)
      case "custom":
        const days = parseInt(customDays) || 30
        return addDays(today, days)
      default:
        return defaultExpiration
    }
  }

  const handleRenew = async () => {
    setLoading(true)
    setError(null)

    const expiresAt = getExpirationDate().toISOString()

    const result = await renewCautela(cautela.id, expiresAt)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-white">Renovar Cautela</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {success ? (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Cautela Renovada!</h3>
              <p className="text-slate-400">
                Nova validade: {format(getExpirationDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          ) : (
            <>
              {/* Cautela Info */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                <p className="text-sm text-slate-400 mb-1">Responsável</p>
                <p className="text-white font-bold">{cautela.persons?.full_name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Tipo: {cautela.type === "daily" ? "Diária" : "Permanente"}
                </p>
                {cautela.expires_at && (
                  <p className="text-xs text-slate-500">
                    Vencimento atual: {format(new Date(cautela.expires_at), "dd/MM/yyyy")}
                  </p>
                )}
              </div>

              {/* Duration Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-300">
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Período de Renovação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "30", label: "30 dias", days: 30 },
                    { value: "60", label: "60 dias", days: 60 },
                    { value: "90", label: "90 dias", days: 90 },
                    { value: "custom", label: "Personalizado", days: null },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedOption(option.value as any)}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                        selectedOption === option.value
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                          : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {selectedOption === "custom" && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-center"
                    />
                    <span className="text-slate-400 text-sm">dias</span>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">
                  Nova Data de Vencimento
                </p>
                <p className="text-2xl font-bold text-white">
                  {format(getExpirationDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRenew}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-3 rounded-xl font-bold transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Renovando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Renovar
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
