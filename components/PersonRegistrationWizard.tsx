"use client"

import { useState, useRef } from "react"
import { createPerson, uploadRgPhoto } from "@/app/actions/persons"
import Tesseract from "tesseract.js"
import { 
  Camera, 
  Upload, 
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
  Mail
} from "lucide-react"
import FaceRegistration from "./FaceRegistration"

interface PersonWizardProps {
  onSuccess: () => void
  onCancel: () => void
  initialData?: {
    rg?: string
    name?: string
  }
}

const STEPS = [
  { label: "Documentos", icon: FileText },
  { label: "Dados", icon: UserPlus },
  { label: "PIN", icon: Fingerprint },
  { label: "Biometria", icon: ScanFace },
]

export default function PersonRegistrationWizard({ onSuccess, onCancel, initialData }: PersonWizardProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrStatus, setOcrStatus] = useState("")

  // Fotos (File objects + preview URLs)
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string>("")
  const [backPreview, setBackPreview] = useState<string>("")

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

  // Processar foto (OCR + preview)
  const handlePhoto = async (file: File, side: "front" | "back") => {
    // Preview local
    const previewUrl = URL.createObjectURL(file)
    if (side === "front") {
      setFrontFile(file)
      setFrontPreview(previewUrl)
    } else {
      setBackFile(file)
      setBackPreview(previewUrl)
    }

    // OCR apenas na frente (contém os dados principais)
    if (side === "front") {
      setLoading(true)
      setOcrStatus("Processando documento...")
      try {
        const { data: { text } } = await Tesseract.recognize(file, 'por', {
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.floor(m.progress * 100))
            }
          }
        })

        console.log("OCR texto completo:", text)

        // ---- Extrair RG ----
        // Padrões: "06.433/3", "06.433", "06433"
        const rgPatterns = [
          /Registro\s*Geral[:\s]*([0-9.,/\-]+)/i,
          /R\.?\s*G\.?[:\s]*([0-9.,/\-]+)/i,
          /(\d{2}[.\s]?\d{3})[\/\-]?\d*/,
        ]
        let extractedRg = ""
        for (const pattern of rgPatterns) {
          const match = text.match(pattern)
          if (match) {
            // Limpar: remover pontos, barras e sufixo
            extractedRg = match[1].replace(/[^0-9]/g, "").slice(0, 5)
            break
          }
        }

        // ---- Extrair Nome ----
        // Linhas em maiúsculas com pelo menos 2 palavras
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 4)
        let extractedName = ""
        for (const line of lines) {
          const cleaned = line.replace(/[^A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ\s]/g, "").trim()
          if (cleaned.length > 8 && cleaned === cleaned.toUpperCase() && cleaned.split(/\s+/).length >= 2) {
            extractedName = cleaned
            break
          }
        }

        // ---- Extrair Matrícula (7+ dígitos seguidos) ----
        const matriculaMatch = text.match(/Matr[ií]cula[:\s]*(\d{6,12})/i)
          || text.match(/(\d{7,12})/)
        const extractedMatricula = matriculaMatch ? matriculaMatch[1] : ""

        setFormData(prev => ({
          ...prev,
          full_name: extractedName || prev.full_name,
          rg: extractedRg || prev.rg,
          registration_number: extractedMatricula || prev.registration_number,
        }))

        setOcrStatus("Documento processado!")
      } catch (err) {
        console.error("Erro no OCR:", err)
        setOcrStatus("OCR falhou. Preencha manualmente.")
      } finally {
        setLoading(false)
      }
    }
  }

  // Validar passo 1 (fotos obrigatórias)
  const validatePhotos = () => {
    const errs: Record<string, string> = {}
    if (!frontFile) errs.front = "Foto da FRENTE do RG é obrigatória"
    if (!backFile) errs.back = "Foto do VERSO do RG é obrigatória"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Validar passo 2 (dados pessoais)
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
    if (step === 1 && validatePhotos()) setStep(2)
    else if (step === 2 && validateData()) setStep(3)
    else if (step === 3 && formData.pin.length === 4) setStep(4)
  }

  // Submit final: upload fotos + salvar pessoa
  const handleSubmit = async () => {
    setLoading(true)
    try {
      // 1. Upload frente
      const frontForm = new FormData()
      frontForm.append("file", frontFile!)
      frontForm.append("side", "front")
      const frontResult = await uploadRgPhoto(frontForm)
      if (frontResult.error) { alert(frontResult.error); setLoading(false); return }

      // 2. Upload verso
      const backForm = new FormData()
      backForm.append("file", backFile!)
      backForm.append("side", "back")
      const backResult = await uploadRgPhoto(backForm)
      if (backResult.error) { alert(backResult.error); setLoading(false); return }

      // 3. Criar pessoa
      const result = await createPerson({
        ...formData,
        rg_front_url: frontResult.url!,
        rg_back_url: backResult.url!,
      })

      if (result.success) {
        onSuccess()
      } else {
        alert(result.error)
      }
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Componente de upload de foto individual
  const PhotoUploadBox = ({ side, file, preview, label }: {
    side: "front" | "back"
    file: File | null
    preview: string
    label: string
  }) => (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-green-500/30 bg-slate-950">
          <img src={preview} alt={label} className="w-full h-40 object-cover" />
          <div className="absolute top-2 right-2 h-7 w-7 rounded-full bg-green-600 flex items-center justify-center shadow-lg">
            <Check className="h-4 w-4 text-white" />
          </div>
          <label className="absolute bottom-0 inset-x-0 py-2 bg-slate-950/80 text-center text-xs font-bold text-blue-400 cursor-pointer hover:text-blue-300">
            Trocar foto
            <input type="file" className="hidden" accept="image/*" capture="environment"
              onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0], side)} />
          </label>
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all group
          ${errors[side] ? "border-red-500/50 bg-red-500/5" : "border-slate-700 hover:border-blue-500 hover:bg-blue-500/5"}
        `}>
          <ImagePlus className={`h-10 w-10 mb-2 ${errors[side] ? "text-red-500" : "text-slate-500 group-hover:text-blue-500"}`} />
          <span className="text-sm font-medium text-slate-400 group-hover:text-white">Tirar foto ou selecionar</span>
          <input type="file" className="hidden" accept="image/*" capture="environment"
            onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0], side)} />
        </label>
      )}
      {errors[side] && <p className="text-xs text-red-500 font-medium">{errors[side]}</p>}
    </div>
  )

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-w-2xl w-full mx-auto shadow-2xl max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-500" />
          Novo Cadastro
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-white p-1">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Steps */}
      <div className="px-6 py-3 flex items-center justify-center gap-2 bg-slate-950/30 border-b border-slate-800/50">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              step > i + 1 ? "bg-green-600 border-green-600 text-white" :
              step === i + 1 ? "bg-blue-600 border-blue-600 text-white" :
              "border-slate-700 text-slate-600"
            }`}>
              {step > i + 1 ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block ${
              step === i + 1 ? "text-white" : "text-slate-600"
            }`}>{s.label}</span>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-slate-700 mx-1" />}
          </div>
        ))}
      </div>

      <div className="p-6 sm:p-8">
        {/* STEP 1: Fotos do RG */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-white">Documentos do RG</h3>
              <p className="text-slate-400 text-sm">Tire duas fotos nítidas: frente e verso do documento.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhotoUploadBox side="front" file={frontFile} preview={frontPreview} label="📄 Frente do RG" />
              <PhotoUploadBox side="back" file={backFile} preview={backPreview} label="📄 Verso do RG" />
            </div>

            {loading && (
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <span>{ocrStatus}</span>
                  <span>{ocrProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
                </div>
              </div>
            )}

            {ocrStatus && !loading && (
              <div className="text-center text-sm text-green-400 font-medium">✅ {ocrStatus}</div>
            )}

            <button onClick={handleNextStep} disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50 transition-all"
            >
              Próximo: Conferir Dados <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Dados Pessoais */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-white">Dados Pessoais</h3>
              <p className="text-slate-400 text-sm">Confira os dados extraídos e corrija se necessário.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome Completo *</label>
                <input type="text" value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.full_name ? "border-red-500" : "border-slate-800 focus:border-blue-500"}`}
                />
                {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
              </div>
              
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Mail className="h-3 w-3" /> E-mail *
                </label>
                <input type="email" value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="policial@email.com"
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.email ? "border-red-500" : "border-slate-800 focus:border-blue-500"}`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">RG (apenas números) *</label>
                <input type="text" value={formData.rg}
                  onChange={e => setFormData({...formData, rg: e.target.value})}
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.rg ? "border-red-500" : "border-slate-800 focus:border-blue-500"}`}
                />
                {errors.rg && <p className="text-xs text-red-500 mt-1">{errors.rg}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Matrícula *</label>
                <input type="text" value={formData.registration_number}
                  onChange={e => setFormData({...formData, registration_number: e.target.value})}
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.registration_number ? "border-red-500" : "border-slate-800 focus:border-blue-500"}`}
                />
                {errors.registration_number && <p className="text-xs text-red-500 mt-1">{errors.registration_number}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posto/Graduação</label>
                <input type="text" value={formData.function}
                  onChange={e => setFormData({...formData, function: e.target.value})}
                  placeholder="Ex: CABO QPPM"
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white"
              >Voltar</button>
              <button onClick={handleNextStep}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500"
              >Próximo: Cadastrar PIN <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* STEP 3: PIN */}
        {step === 3 && (
          <div className="space-y-6 text-center max-w-sm mx-auto">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center border-2 border-green-500/20">
                <Fingerprint className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Criar PIN de Acesso</h3>
              <p className="text-slate-400 mt-1 text-sm">Digite um PIN de 4 dígitos para autorizar cautelas.</p>
            </div>

            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`h-14 w-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold ${
                  formData.pin.length > i ? "border-blue-500 bg-blue-500/10 text-white" : "border-slate-800 bg-slate-900 text-slate-700"
                }`}>{formData.pin[i] ? "•" : ""}</div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[1,2,3,4,5,6,7,8,9,"limpar",0,"→"].map(key => {
                if (key === "limpar") return (
                  <button key={key} onClick={() => setFormData({...formData, pin: ""})}
                    className="h-14 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700">Limpar</button>
                )
                if (key === "→") return (
                  <button key={key} onClick={handleNextStep} disabled={formData.pin.length !== 4}
                    className="h-14 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )
                return (
                  <button key={key} onClick={() => formData.pin.length < 4 && setFormData({...formData, pin: formData.pin + key})}
                    className="h-14 rounded-xl bg-slate-800 text-xl font-bold text-white hover:bg-slate-700 active:bg-blue-600 transition-colors">{key}</button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Biometria Facial */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-white">Biometria Facial</h3>
              <p className="text-slate-400 text-sm">Capture o rosto para autorizar cautelas futuras com reconhecimento facial.</p>
            </div>

            <FaceRegistration onCapture={descriptor => setFormData({...formData, face_descriptor: descriptor})} />

            <div className="flex gap-3">
              <button onClick={() => setStep(3)}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white"
              >Voltar</button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                Concluir Cadastro
              </button>
            </div>

            <button onClick={handleSubmit} disabled={loading}
              className="w-full text-xs font-bold text-slate-500 hover:text-slate-400 uppercase tracking-widest"
            >Pular biometria e cadastrar apenas com PIN</button>
          </div>
        )}
      </div>
    </div>
  )
}
