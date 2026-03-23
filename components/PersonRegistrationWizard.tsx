"use client"

import { useState } from "react"
import { createPerson, uploadRgPhoto } from "@/app/actions/persons"
import imageCompression from "browser-image-compression"
import Tesseract from "tesseract.js"
import { 
  Camera, 
  Check, 
  X, 
  UserPlus, 
  Fingerprint, 
  Loader2,
  FileText,
  ScanFace,
  CheckCircle,
  ChevronRight,
  ImagePlus,
  Mail,
  AlertTriangle
} from "lucide-react"
import FaceRegistration from "./FaceRegistration"

interface PersonWizardProps {
  onSuccess: () => void
  onCancel: () => void
  initialData?: { rg?: string; name?: string }
}

const STEPS = [
  { label: "Documentos", icon: FileText },
  { label: "Dados", icon: UserPlus },
  { label: "PIN", icon: Fingerprint },
  { label: "Biometria", icon: ScanFace },
]

async function compressImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.3,          // Máximo 300KB
    maxWidthOrHeight: 1200,  // Redimensionar
    useWebWorker: true,
    fileType: "image/webp",  // WebP = menor tamanho
  })
}

export default function PersonRegistrationWizard({ onSuccess, onCancel, initialData }: PersonWizardProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrStatus, setOcrStatus] = useState("")

  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState("")
  const [backPreview, setBackPreview] = useState("")

  const [formData, setFormData] = useState({
    full_name: initialData?.name || "",
    email: "",
    rg: initialData?.rg || "",
    registration_number: "",
    function: "",
    pin: "",
    face_descriptor: [] as number[],
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handlePhoto = async (file: File, side: "front" | "back") => {
    setLoading(true)
    setOcrProgress(0)

    try {
      // ======= 1. PREVIEW IMEDIATO (imagem original) =======
      const previewUrl = URL.createObjectURL(file)
      if (side === "front") setFrontPreview(previewUrl)
      else setBackPreview(previewUrl)

      // ======= 2. OCR NA IMAGEM ORIGINAL (alta qualidade) =======
      if (side === "front") {
        setOcrStatus("Lendo documento (pode levar alguns segundos)...")
        try {
          const { data: { text } } = await Tesseract.recognize(file, 'por', {
            logger: m => {
              if (m.status === 'recognizing text') {
                setOcrProgress(Math.floor(m.progress * 100))
              }
            }
          })

          console.log("===== OCR TEXTO COMPLETO =====")
          console.log(text)
          console.log("==============================")

          // ---- Extrair NOME ----
          // Padrões para documentos militares e civis
          let extractedName = ""
          const namePatterns = [
            /Nome[:\s]+([A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ][A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ\s]{5,})/i,
            /NOME[:\s]*\n?\s*([A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ][A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ\s]{5,})/,
          ]
          for (const p of namePatterns) {
            const m = text.match(p)
            if (m) {
              extractedName = m[1].trim().replace(/\s+/g, " ")
              break
            }
          }
          // Fallback: procurar linha longa em maiúsculas com pelo menos 2 palavras
          if (!extractedName) {
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 6)
            for (const line of lines) {
              const cleaned = line.replace(/[^A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ\s]/g, "").trim()
              const words = cleaned.split(/\s+/).filter(w => w.length > 1)
              if (cleaned.length > 10 && words.length >= 3 && cleaned === cleaned.toUpperCase()) {
                extractedName = cleaned
                break
              }
            }
          }

          // ---- Extrair RG ----
          let extractedRg = ""
          const rgPatterns = [
            /Registro\s*Geral[:\s.,]*(\d[\d.,\/\-\s]*\d)/i,
            /R[\.\s]*G[\.\s]*[:\s]*(\d[\d.,\/\-\s]*)/i,
            /(\d{2}[\.\s]?\d{3})\s*[\/\-]?\s*\d*/,
          ]
          for (const p of rgPatterns) {
            const m = text.match(p)
            if (m) {
              // Limpar: apenas dígitos base, sem barra e sufixo
              const raw = m[1].replace(/[\/\-].*/g, "") // Remove tudo após barra
              extractedRg = raw.replace(/\D/g, "").slice(0, 5)
              if (extractedRg.length >= 4) break
              else extractedRg = ""
            }
          }

          // ---- Extrair MATRÍCULA ----
          let extractedMat = ""
          const matPatterns = [
            /Matr[ií]cula[:\s]*(\d{5,12})/i,
            /MAT[:\s]*(\d{5,12})/i,
          ]
          for (const p of matPatterns) {
            const m = text.match(p)
            if (m) { extractedMat = m[1]; break }
          }
          // Fallback: número longo (7+ dígitos) que não é o RG
          if (!extractedMat) {
            const allNums = text.match(/\d{7,12}/g) || []
            const rgDigits = extractedRg
            extractedMat = allNums.find(n => !n.startsWith(rgDigits)) || allNums[0] || ""
          }

          console.log("Extraído => Nome:", extractedName, "| RG:", extractedRg, "| Mat:", extractedMat)

          setFormData(prev => ({
            ...prev,
            full_name: extractedName || prev.full_name,
            rg: extractedRg || prev.rg,
            registration_number: extractedMat || prev.registration_number,
          }))

          setOcrStatus(
            extractedName || extractedRg
              ? `✅ Encontrado: ${[extractedName && "Nome", extractedRg && "RG", extractedMat && "Matrícula"].filter(Boolean).join(", ")}`
              : "⚠️ Não conseguiu ler. Tente com mais luz ou preencha manualmente."
          )
        } catch (err) {
          console.error("Erro OCR:", err)
          setOcrStatus("⚠️ OCR falhou. Preencha manualmente.")
        }
      } else {
        setOcrStatus("✅ Verso anexado!")
      }

      // ======= 3. COMPRIMIR PARA STORAGE (após OCR) =======
      setOcrStatus(prev => prev + " Comprimindo...")
      const compressed = await compressImage(file)
      if (side === "front") setFrontFile(compressed)
      else setBackFile(compressed)

    } catch (err) {
      console.error(err)
      setOcrStatus("Erro ao processar imagem.")
    } finally {
      setLoading(false)
    }
  }


  const validateData = () => {
    const errs: Record<string, string> = {}
    if (!formData.full_name || formData.full_name.length < 3) errs.full_name = "Nome obrigatório"
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) errs.email = "E-mail válido obrigatório"
    if (!formData.rg || formData.rg.replace(/\D/g, "").length < 4) errs.rg = "RG obrigatório"
    if (!formData.registration_number) errs.registration_number = "Matrícula obrigatória"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNextStep = () => {
    if (step === 1) setStep(2) // fotos são opcionais agora
    else if (step === 2 && validateData()) setStep(3)
    else if (step === 3 && formData.pin.length === 4) setStep(4)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      let frontUrl: string | undefined
      let backUrl: string | undefined

      // Upload fotos (se existirem)
      if (frontFile) {
        const fd = new FormData()
        fd.append("file", frontFile)
        fd.append("side", "front")
        const r = await uploadRgPhoto(fd)
        if (r.error) { alert(r.error); setLoading(false); return }
        frontUrl = r.url
      }
      if (backFile) {
        const fd = new FormData()
        fd.append("file", backFile)
        fd.append("side", "back")
        const r = await uploadRgPhoto(fd)
        if (r.error) { alert(r.error); setLoading(false); return }
        backUrl = r.url
      }

      const result = await createPerson({
        ...formData,
        rg_front_url: frontUrl,
        rg_back_url: backUrl,
      })

      if (result.success) onSuccess()
      else alert(result.error)
    } catch (err: any) {
      alert("Erro: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const PhotoUploadBox = ({ side, preview, label }: {
    side: "front" | "back"; preview: string; label: string
  }) => (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-green-500/30 bg-slate-950">
          <img src={preview} alt={label} className="w-full h-36 object-cover" />
          <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-green-600 flex items-center justify-center shadow-lg">
            <Check className="h-3 w-3 text-white" />
          </div>
          <label className="absolute bottom-0 inset-x-0 py-1.5 bg-slate-950/80 text-center text-xs font-bold text-blue-400 cursor-pointer hover:text-blue-300">
            Trocar foto
            <input type="file" className="hidden" accept="image/*" capture="environment"
              onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0], side)} />
          </label>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-6 cursor-pointer transition-all group hover:border-blue-500 hover:bg-blue-500/5">
          <ImagePlus className="h-8 w-8 mb-1 text-slate-600 group-hover:text-blue-500" />
          <span className="text-xs font-medium text-slate-500 group-hover:text-white">Tirar foto ou selecionar</span>
          <input type="file" className="hidden" accept="image/*" capture="environment"
            onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0], side)} />
        </label>
      )}
    </div>
  )

  const photosAttached = !!(frontFile && backFile)

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-w-2xl w-full mx-auto shadow-2xl max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-500" /> Novo Cadastro
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-white p-1"><X className="h-5 w-5" /></button>
      </div>

      {/* Steps */}
      <div className="px-4 py-2.5 flex items-center justify-center gap-1 bg-slate-950/30 border-b border-slate-800/50">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
              step > i+1 ? "bg-green-600 border-green-600 text-white" :
              step === i+1 ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 text-slate-600"
            }`}>{step > i+1 ? <Check className="h-2.5 w-2.5" /> : i+1}</div>
            <span className={`text-[9px] font-bold uppercase tracking-wider hidden sm:block ${step === i+1 ? "text-white" : "text-slate-600"}`}>{s.label}</span>
            {i < 3 && <ChevronRight className="h-3 w-3 text-slate-700 mx-0.5" />}
          </div>
        ))}
      </div>

      <div className="p-5 sm:p-6">
        {/* STEP 1: Fotos */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-white">Documentos do RG</h3>
              <p className="text-slate-400 text-sm">Tire fotos da frente e verso. <span className="text-yellow-500 font-medium">Opcional agora, cobrado na cautela.</span></p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhotoUploadBox side="front" preview={frontPreview} label="📄 Frente do RG" />
              <PhotoUploadBox side="back" preview={backPreview} label="📄 Verso do RG" />
            </div>

            {!photosAttached && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-400">
                  As fotos ficarão <strong>pendentes</strong>. O sistema vai cobrar o envio sempre que esta pessoa fizer uma cautela.
                </p>
              </div>
            )}

            {loading && (
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <span>{ocrStatus}</span><span>{ocrProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all" style={{ width: `${ocrProgress}%` }} />
                </div>
              </div>
            )}
            {ocrStatus && !loading && <div className="text-center text-xs text-green-400 font-medium">✅ {ocrStatus}</div>}

            <button onClick={handleNextStep} disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50"
            >Próximo: Dados Pessoais <ChevronRight className="h-4 w-4" /></button>
          </div>
        )}

        {/* STEP 2: Dados */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-white">Dados Pessoais</h3>
              <p className="text-slate-400 text-sm">Confira e corrija se necessário.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome Completo *</label>
                <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})}
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.full_name ? "border-red-500" : "border-slate-800"}`} />
                {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Mail className="h-3 w-3" /> E-mail *</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="policial@email.com"
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.email ? "border-red-500" : "border-slate-800"}`} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">RG (números) *</label>
                <input type="text" value={formData.rg} onChange={e => setFormData({...formData, rg: e.target.value})}
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.rg ? "border-red-500" : "border-slate-800"}`} />
                {errors.rg && <p className="text-xs text-red-500 mt-1">{errors.rg}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Matrícula *</label>
                <input type="text" value={formData.registration_number} onChange={e => setFormData({...formData, registration_number: e.target.value})}
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.registration_number ? "border-red-500" : "border-slate-800"}`} />
                {errors.registration_number && <p className="text-xs text-red-500 mt-1">{errors.registration_number}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posto/Graduação</label>
                <input type="text" value={formData.function} onChange={e => setFormData({...formData, function: e.target.value})}
                  placeholder="Ex: CABO QPPM"
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white">Voltar</button>
              <button onClick={handleNextStep} className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500">
                Próximo: PIN <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PIN */}
        {step === 3 && (
          <div className="space-y-6 text-center max-w-xs mx-auto">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center border-2 border-green-500/20">
                <Fingerprint className="h-7 w-7 text-green-500" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Criar PIN</h3>
              <p className="text-slate-400 text-sm">4 dígitos para autorizar cautelas.</p>
            </div>
            <div className="flex justify-center gap-3">
              {[0,1,2,3].map(i => (
                <div key={i} className={`h-12 w-10 rounded-xl border-2 flex items-center justify-center text-xl font-bold ${
                  formData.pin.length > i ? "border-blue-500 bg-blue-500/10 text-white" : "border-slate-800 bg-slate-900 text-slate-700"
                }`}>{formData.pin[i] ? "•" : ""}</div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1,2,3,4,5,6,7,8,9,"C",0,"→"].map(key => {
                if (key === "C") return <button key={key} onClick={() => setFormData({...formData, pin: ""})} className="h-12 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700">Limpar</button>
                if (key === "→") return <button key={key} onClick={handleNextStep} disabled={formData.pin.length !== 4} className="h-12 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center"><ChevronRight className="h-5 w-5" /></button>
                return <button key={key} onClick={() => formData.pin.length < 4 && setFormData({...formData, pin: formData.pin + key})} className="h-12 rounded-xl bg-slate-800 text-lg font-bold text-white hover:bg-slate-700 active:bg-blue-600 transition-colors">{key}</button>
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Biometria */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-white">Biometria Facial</h3>
              <p className="text-slate-400 text-sm">Opcional. Pode pular e cadastrar apenas com PIN.</p>
            </div>
            <FaceRegistration onCapture={d => setFormData({...formData, face_descriptor: d})} />
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white">Voltar</button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />} Concluir
              </button>
            </div>
            <button onClick={handleSubmit} disabled={loading}
              className="w-full text-xs font-bold text-slate-500 hover:text-slate-400 uppercase tracking-widest">
              Pular biometria
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
