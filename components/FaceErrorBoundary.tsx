"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

type Props = {
  children: ReactNode
  onReset?: () => void
}

type State = {
  hasError: boolean
  message: string
}

export default class FaceErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "Falha inesperada na biometria facial."
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("FaceErrorBoundary:", error, info.componentStack)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: "" })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-red-300">Biometria indisponível</p>
            <p className="text-xs text-red-400/80 max-w-xs">
              {this.state.message || "Não foi possível concluir a captura facial neste dispositivo."}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700"
          >
            Tentar novamente
          </button>
          <p className="text-[10px] text-slate-500">
            Você pode continuar usando PIN como assinatura.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
