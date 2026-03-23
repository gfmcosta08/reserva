"use client"

import { useEffect, useRef, useState } from "react"
import * as faceapi from "face-api.js"
import { Camera, RefreshCw, CheckCircle, Loader2 } from "lucide-react"

interface FaceRegistrationProps {
  onCapture: (descriptor: number[]) => void
}

export default function FaceRegistration({ onCapture }: FaceRegistrationProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [captured, setCaptured] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/"
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        startVideo()
      } catch (err) {
        console.error("Erro ao carregar modelos:", err)
        setError("Não foi possível carregar os modelos de reconhecimento facial.")
      }
    }

    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" } // Pode ser alternado para environment se necessário
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setLoading(false)
        }
      } catch (err) {
        console.error("Erro ao acessar câmera:", err)
        setError("Não foi possível acessar a câmera.")
      }
    }

    loadModels()

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const captureFace = async () => {
    if (!videoRef.current) return
    setLoading(true)

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (detection) {
        const descriptorArray = Array.from(detection.descriptor) as number[]
        onCapture(descriptorArray)
        setCaptured(true)
      } else {
        alert("Nenhum rosto detectado. Tente novamente em um ambiente mais iluminado.")
      }
    } catch (err) {
      console.error("Erro na detecção:", err)
      alert("Erro ao processar rosto.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 flex flex-col items-center">
      <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-2xl">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Iniciando Biometria...</p>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-6 text-center z-20">
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
        />
        
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay do Rosto */}
        <div className="absolute inset-0 border-[40px] border-slate-900/60 pointer-events-none">
          <div className="w-full h-full border-2 border-dashed border-blue-500/50 rounded-full" />
        </div>
      </div>

      {captured ? (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-green-500 font-bold bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20">
            <CheckCircle className="h-5 w-5" />
            Face Registrada com Sucesso
          </div>
          <button
            onClick={() => setCaptured(false)}
            className="text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Tirar outra foto
          </button>
        </div>
      ) : (
        <button
          onClick={captureFace}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50 transition-all hover:scale-105"
        >
          <Camera className="h-5 w-5" />
          Capturar Biometria Facial
        </button>
      )}

      <p className="text-xs text-slate-500 text-center max-w-xs">
        Posicione o rosto dentro do círculo e certifique-se de estar em um local bem iluminado.
      </p>
    </div>
  )
}
