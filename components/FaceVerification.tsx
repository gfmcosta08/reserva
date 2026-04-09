"use client"

import { useEffect, useRef, useState } from "react"
import * as faceapi from "face-api.js"
import { Camera, Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react"

interface FaceVerificationProps {
  /** Descriptor armazenado da pessoa (vetor numérico do cadastro) */
  storedDescriptor: number[]
  /** Callback quando a verificação é concluída (true = match, false = falhou) */
  onResult: (matched: boolean) => void
  /** Nome da pessoa para exibir na UI */
  personName: string
}

const MATCH_THRESHOLD = 0.5 // Distância euclidiana máxima para considerar match

export default function FaceVerification({ storedDescriptor, onResult, personName }: FaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "failed">("idle")
  const [error, setError] = useState<string | null>(null)
  const [distance, setDistance] = useState<number | null>(null)

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/"
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        startVideo()
      } catch (err) {
        console.error("Erro ao carregar modelos:", err)
        setError("Não foi possível carregar os modelos de reconhecimento facial.")
        setLoading(false)
      }
    }

    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setLoading(false)
        }
      } catch (err) {
        console.error("Erro ao acessar câmera:", err)
        setError("Não foi possível acessar a câmera.")
        setLoading(false)
      }
    }

    loadModels()

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const verifyFace = async () => {
    if (!videoRef.current) return
    setStatus("verifying")

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        setStatus("failed")
        setError("Nenhum rosto detectado. Tente novamente.")
        return
      }

      // Comparar descriptors
      const storedFloat = new Float32Array(storedDescriptor)
      const dist = faceapi.euclideanDistance(detection.descriptor, storedFloat)
      setDistance(dist)

      if (dist < MATCH_THRESHOLD) {
        setStatus("success")
        // Parar câmera
        if (videoRef.current?.srcObject) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop())
        }
        setTimeout(() => onResult(true), 1500)
      } else {
        setStatus("failed")
        setError("Rosto não confere com o cadastro.")
      }
    } catch (err) {
      console.error("Erro na verificação:", err)
      setStatus("failed")
      setError("Erro ao processar rosto.")
    }
  }

  const retry = () => {
    setStatus("idle")
    setError(null)
    setDistance(null)
  }

  return (
    <div className="space-y-5 flex flex-col items-center">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-white">Assinatura Facial</h3>
        <p className="text-slate-400 text-sm">
          <span className="text-blue-400 font-medium">{personName}</span> deve posicionar o rosto na câmera
        </p>
      </div>

      <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-2xl">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carregando Biometria...</p>
          </div>
        )}

        {status === "success" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-900/80 z-20">
            <CheckCircle className="h-16 w-16 text-green-400 mb-3" />
            <p className="text-lg font-bold text-green-400">Identidade Confirmada!</p>
            <p className="text-xs text-green-500/70 mt-1">Confiança: {distance ? ((1 - distance) * 100).toFixed(0) : 0}%</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
        />

        {/* Overlay do Rosto */}
        <div className={`absolute inset-0 border-[40px] pointer-events-none transition-colors duration-300 ${
          status === "success" ? "border-green-900/60" :
          status === "failed" ? "border-red-900/60" : "border-slate-900/60"
        }`}>
          <div className={`w-full h-full border-2 border-dashed rounded-full transition-colors duration-300 ${
            status === "success" ? "border-green-500/50" :
            status === "failed" ? "border-red-500/50" : "border-blue-500/50"
          }`} />
        </div>
      </div>

      {error && status === "failed" && (
        <div className="flex items-center gap-2 text-red-400 text-sm font-medium bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {status === "idle" && !loading && (
        <button
          onClick={verifyFace}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-all hover:scale-105"
        >
          <Camera className="h-5 w-5" />
          Verificar Identidade
        </button>
      )}

      {status === "verifying" && (
        <div className="flex items-center gap-2 text-blue-400 text-sm font-bold">
          <Loader2 className="h-5 w-5 animate-spin" />
          Analisando rosto...
        </div>
      )}

      {status === "failed" && (
        <button
          onClick={retry}
          className="flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-sm font-bold text-white hover:bg-slate-700 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar Novamente
        </button>
      )}

      <p className="text-xs text-slate-500 text-center max-w-xs">
        Posicione o rosto dentro do círculo em um local bem iluminado. O sistema vai comparar com a biometria do cadastro.
      </p>
    </div>
  )
}
