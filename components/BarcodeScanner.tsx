"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Camera, X, Flashlight, Loader2, Check, AlertCircle } from "lucide-react"

interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose?: () => void
  title?: string
  formats?: string[]
}

export default function BarcodeScanner({
  onScan,
  onClose,
  title = "Escanear Código",
  formats = ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"]
}: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  // Inject scanline animation CSS
  useEffect(() => {
    const styleId = "barcode-scanner-styles"
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style")
      style.id = styleId
      style.textContent = `
        @keyframes scanline {
          0%, 100% { transform: translateY(-120px); opacity: 0; }
          50% { transform: translateY(120px); opacity: 1; }
        }
      `
      document.head.appendChild(style)
    }
    return () => {
      const style = document.getElementById(styleId)
      if (style) style.remove()
    }
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const animationRef = useRef<number | null>(null)

  // Inicializar detector de código de barras
  const initDetector = useCallback(async () => {
    if (!("BarcodeDetector" in window)) {
      setError("BarcodeDetector API não suportada neste navegador")
      return false
    }

    try {
      // @ts-ignore - BarcodeDetector é uma API experimental
      detectorRef.current = new BarcodeDetector({ formats })
      return true
    } catch (err) {
      setError("Erro ao inicializar detector de código de barras")
      return false
    }
  }, [formats])

  // Iniciar câmera
  const startCamera = useCallback(async () => {
    try {
      setError(null)
      setIsScanning(true)

      // Verificar suporte à API
      if (await initDetector()) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        })

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setHasPermission(true)
          detectBarcode()
        }
      }
    } catch (err: any) {
      console.error("Erro ao acessar câmera:", err)
      setHasPermission(false)
      if (err.name === "NotAllowedError") {
        setError("Permissão de câmera negada. Por favor, permita o acesso à câmera.")
      } else if (err.name === "NotFoundError") {
        setError("Câmera não encontrada. Verifique se há uma câmera disponível.")
      } else {
        setError("Erro ao acessar câmera: " + err.message)
      }
      setIsScanning(false)
    }
  }, [initDetector])

  // Parar câmera
  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsScanning(false)
    setScannedCode(null)
    setTorchOn(false)
  }, [])

  // Detectar código de barras
  const detectBarcode = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current) return

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current)

      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue
        setScannedCode(code)

        // Tocar som de sucesso (se suportado)
        try {
          const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVcQNpHW+NueZVQ1Wq/w/5xkPzJJiNr1/5piRjNEhN36/5lgTTQ4guH+/5ldUDExf+b+/5dWUzIueOn+/5VWUjEueOn//5RXUzEteOn//5JWUzAseOn//5FVUzAseOn//5FUUy8reOn//49VUy4reOn//45WUy0reOn//45VUy0reOn//4xWUywreOn//4tWUysreOn//4pWUyoqeOn//4lWUykqeOn//4hWUygoeOn//4dWUycncel8/4ZVVykneel8/4VVVykneel8/4RU")
          audio.volume = 0.3
          audio.play().catch(() => {})
        } catch {}

        // Chamar callback após pequeno delay
        setTimeout(() => {
          onScan(code)
          stopCamera()
        }, 500)

        return
      }
    } catch (err) {
      console.error("Erro na detecção:", err)
    }

    // Continuar escaneando
    animationRef.current = requestAnimationFrame(detectBarcode)
  }, [onScan, stopCamera])

  // Toggle lanterna
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return

    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return

    try {
      // @ts-ignore - torch é uma propriedade experimental
      await track.applyConstraints({
        advanced: [{ torch: !torchOn }] as any
      })
      setTorchOn(!torchOn)
    } catch (err) {
      console.error("Erro ao toggle lanterna:", err)
    }
  }, [torchOn])

  // Efeito colateral para cleanup
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Se não está escaneando, mostrar botão para iniciar
  if (!isScanning) {
    return (
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={startCamera}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
        >
          <Camera className="h-5 w-5" />
          {title}
        </button>
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    )
  }

  // Interface de escaneamento
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <h2 className="text-white font-bold">{title}</h2>
        <div className="flex items-center gap-2">
          {(streamRef.current?.getVideoTracks()[0]?.getCapabilities() as any)?.torch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full ${torchOn ? "bg-yellow-500" : "bg-slate-700"} text-white`}
            >
              <Flashlight className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => {
              stopCamera()
              onClose?.()
            }}
            className="p-2 rounded-full bg-slate-700 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Área de visualização */}
      <div className="flex-1 relative flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Overlay de escaneamento */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-64">
            {/* Cantos do scanner */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

            {/* Linha de escaneamento animada */}
            <div className="absolute left-2 right-2 h-0.5 bg-blue-500 animate-pulse top-1/2"
                 style={{ animation: "scanline 2s ease-in-out infinite" }} />
          </div>
        </div>

        {/* Código detectado */}
        {scannedCode && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-green-500/90 text-white px-6 py-3 rounded-xl flex items-center gap-2 animate-bounce">
            <Check className="h-5 w-5" />
            <span className="font-mono font-bold">{scannedCode}</span>
          </div>
        )}

        {/* Loading */}
        {hasPermission === null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="flex flex-col items-center gap-4 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Acessando câmera...</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-black/50 text-center">
        <p className="text-slate-400 text-sm">
          Posicione o código de barras dentro da área de escaneamento
        </p>
      </div>

      {/* CSS para animação via useEffect */}
    </div>
  )
}

// Hook para usar o scanner
export function useBarcodeScanner(onScan: (code: string) => void) {
  const [isOpen, setIsOpen] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)

  const handleScan = useCallback((code: string) => {
    setLastScanned(code)
    onScan(code)
    setIsOpen(false)
  }, [onScan])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return {
    isOpen,
    lastScanned,
    open,
    close,
    scanner: isOpen ? (
      <BarcodeScanner
        onScan={handleScan}
        onClose={close}
        title="Escanear Código de Barras"
      />
    ) : null
  }
}
