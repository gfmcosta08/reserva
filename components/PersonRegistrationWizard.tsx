"use client"

import { useState, useEffect, useMemo } from "react"
import { createPerson, regularizePerson, uploadRgPhoto } from "@/app/actions/persons"
import {
  personMissingFace,
  personMissingRgPhotos,
} from "@/lib/person-registration-status"
import imageCompression from "browser-image-compression"
import { 
  Check, X, UserPlus, Fingerprint, Loader2,
  FileText, ScanFace, CheckCircle, ChevronRight, ImagePlus,
  Mail, AlertTriangle
} from "lucide-react"
import FaceRegistration from "./FaceRegistration"

export type PersonWizardEditTarget = {
  id: string
  full_name: string
  email: string
  rg: string
  registration_number: string
  function?: string | null
  phone?: string | null
  rg_front_url?: string | null
  rg_back_url?: string | null
  face_descriptor?: number[] | null
}

interface PersonWizardProps {
  onSuccess: () => void
  onCancel: () => void
  initialData?: { rg?: string; name?: string }
  /** Quando informado, abre em modo regularização (cadastro existente). */
  person?: PersonWizardEditTarget
}

const STEPS = [
  { label: "Documentos", icon: FileText },
  { label: "Dados", icon: UserPlus },
  { label: "PIN", icon: Fingerprint },
  { label: "Biometria", icon: ScanFace },
]

async function compressImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: "image/webp",
  })
}

export default function PersonRegistrationWizard({ onSuccess, onCancel, initialData, person }: PersonWizardProps) {
  const isRegularize = !!person

  const initialStep = useMemo(() => {
    if (!person) return 1
    if (personMissingRgPhotos(person)) return 1
    if (personMissingFace(person)) return 4
    return 2
  }, [person])

  const [step, setStep] = useState(initialStep)
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

  useEffect(() => {
    if (!person) return
    setStep(initialStep)
    setFormData({
      full_name: person.full_name || "",
      email: person.email || "",
      rg: person.rg || "",
      registration_number: person.registration_number || "",
      function: person.function || "",
      pin: "",
      face_descriptor: person.face_descriptor?.length ? [...person.face_descriptor] : [],
      phone: person.phone || "",
    } as typeof formData & { phone: string })
    setFrontPreview(person.rg_front_url || "")
    setBackPreview(person.rg_back_url || "")
  }, [person, initialStep])

  // ===== OCR VIA API SERVER-SIDE =====
  const runServerOCR = async (file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/ocr", { method: "POST", body: fd })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || "Erro no OCR")
    return data
  }

  // ===== HANDLER PRINCIPAL: FOTO + OCR =====
  const handlePhoto = async (file: File, side: "front" | "back") => {
    setLoading(true)
    setOcrProgress(0)
    try {
      // 1. Preview imediato
      const previewUrl = URL.createObjectURL(file)
      if (side === "front") setFrontPreview(previewUrl)
      else setBackPreview(previewUrl)

      // 2. OCR em qualquer imagem anexada
      setOcrStatus("Lendo dados da imagem (OCR)...")
      setOcrProgress(30)

      try {
        // Envia o arquivo original (ou já comprimido conforme preferência)
        const ocrResult = await runServerOCR(file)
        setOcrProgress(90)

        const { name, rg, registration } = ocrResult.extracted
        console.log(`OCR Resultado (${side}) =>`, ocrResult.extracted)

        setFormData(prev => ({
          ...prev,
          full_name: name || prev.full_name,
          rg: rg || prev.rg,
          registration_number: registration || prev.registration_number,
        }))

        const found = [name && "Nome", rg && "RG", registration && "Matrícula"].filter(Boolean)
        setOcrStatus(
          found.length > 0
            ? `✅ Encontrado: ${found.join(", ")}`
            : "⚠️ Nenhum dado legível nesta imagem."
        )
      } catch (err: any) {
        console.error("Erro OCR:", err)
        setOcrStatus("⚠️ Falha na leitura OCR desta imagem.")
      }

      setOcrProgress(100)

      // 3. Comprimir para storage
      const compressed = await compressImage(file)
      if (side === "front") setFrontFile(compressed)
      else setBackFile(compressed)

    } catch (err) {
      console.error("Erro no processamento:", err)
      setOcrStatus("⚠️ Erro ao processar. Preencha manualmente.")
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
    if (step === 1) setStep(2)
    else if (step === 2 && validateData()) setStep(3)
    else if (step === 3 && formData.pin.length === 4) setStep(4)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      let frontUrl: string | undefined
      let backUrl: string | undefined
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
      if (isRegularize && person) {
        const result = await regularizePerson(person.id, {
          full_name: formData.full_name,
          email: formData.email,
          function: formData.function || undefined,
          phone: (formData as { phone?: string }).phone || undefined,
          pin: formData.pin.length === 4 ? formData.pin : undefined,
          face_descriptor: formData.face_descriptor.length ? formData.face_descriptor : undefined,
          rg_front_url: frontUrl,
          rg_back_url: backUrl,
        })
        if (result.success) onSuccess()
        else alert(result.error)
      } else {
        if (formData.pin.length !== 4) {
          alert("Informe um PIN de 4 dígitos")
          setLoading(false)
          return
        }
        const result = await createPerson({ ...formData, rg_front_url: frontUrl, rg_back_url: backUrl })
        if (result.success) onSuccess()
        else alert(result.error)
      }
    } catch (err: any) {
      alert("Erro: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const PhotoUploadBox = ({ side, preview, label }: { side: "front" | "back"; preview: string; label: string }) => (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-green-500/30 bg-slate-950">
          <img src={preview} alt={label} className="w-full h-36 object-cover" />
          <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-green-600 flex items-center justify-center shadow-lg"><Check className="h-3 w-3 text-white" /></div>
          <label className="absolute bottom-0 inset-x-0 py-1.5 bg-slate-950/80 text-center text-xs font-bold text-blue-400 cursor-pointer hover:text-blue-300">
            Trocar foto
            <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0], side)} />
          </label>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-6 cursor-pointer transition-all group hover:border-blue-500 hover:bg-blue-500/5">
          <ImagePlus className="h-8 w-8 mb-1 text-slate-600 group-hover:text-blue-500" />
          <span className="text-xs font-medium text-slate-500 group-hover:text-white">Tirar foto ou selecionar</span>
          <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0], side)} />
        </label>
      )}
    </div>
  )

  const photosAttached = !!(frontFile && backFile)

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-w-2xl w-full mx-auto shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-500" />
          {isRegularize ? "Regularizar Cadastro" : "Novo Cadastro"}
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-white p-1"><X className="h-5 w-5" /></button>
      </div>

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
              <h3 className="text-lg font-semibold text-white">Documento de Identificação</h3>
              <p className="text-slate-400 text-sm">
                {isRegularize
                  ? "Anexe as fotos que ainda faltam. As já cadastradas permanecem no sistema."
                  : <>Fotografe frente e verso do documento em qualquer ordem. <span className="text-yellow-500 font-medium">Opcional agora, alertado na cautela.</span></>}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhotoUploadBox side="front" preview={frontPreview} label="📄 Imagem 1 do Documento" />
              <PhotoUploadBox side="back" preview={backPreview} label="📄 Imagem 2 do Documento" />
            </div>
            {!photosAttached && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-400">As fotos ficarão <strong>pendentes</strong>. O sistema vai cobrar o envio sempre que esta pessoa fizer uma cautela.</p>
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
            {ocrStatus && !loading && <div className="text-center text-xs text-green-400 font-medium">{ocrStatus}</div>}
            <button onClick={handleNextStep} disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50"
            >Próximo: Dados Pessoais <ChevronRight className="h-4 w-4" /></button>
            {isRegularize && person?.rg_front_url && person?.rg_back_url && (
              <button type="button" onClick={() => setStep(2)} className="w-full text-xs text-slate-500 hover:text-slate-300 underline">
                Fotos já completas — ir para dados
              </button>
            )}
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
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="policial@email.com"
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.email ? "border-red-500" : "border-slate-800"}`} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">RG (números) *</label>
                <input type="text" value={formData.rg} readOnly={isRegularize} onChange={e => setFormData({...formData, rg: e.target.value})}
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.rg ? "border-red-500" : "border-slate-800"} ${isRegularize ? "opacity-70 cursor-not-allowed" : ""}`} />
                {errors.rg && <p className="text-xs text-red-500 mt-1">{errors.rg}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Matrícula *</label>
                <input type="text" value={formData.registration_number} readOnly={isRegularize} onChange={e => setFormData({...formData, registration_number: e.target.value})}
                  className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white focus:ring-1 focus:ring-blue-500 ${errors.registration_number ? "border-red-500" : "border-slate-800"} ${isRegularize ? "opacity-70 cursor-not-allowed" : ""}`} />
                {errors.registration_number && <p className="text-xs text-red-500 mt-1">{errors.registration_number}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posto/Graduação</label>
                <input type="text" value={formData.function} onChange={e => setFormData({...formData, function: e.target.value})} placeholder="Ex: CABO QPPM"
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">WhatsApp / Telefone</label>
                <input type="tel" value={(formData as any).phone ?? ""} onChange={e => setFormData({...formData, phone: e.target.value} as any)} placeholder="Ex: 11999990000"
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                <p className="text-[10px] text-slate-500 mt-1">Usado para envio de resumo de cautela por WhatsApp</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white">Voltar</button>
              <button onClick={handleNextStep} className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500">
                {isRegularize ? <>Próximo: Biometria <ChevronRight className="h-4 w-4" /></> : <>Próximo: PIN <ChevronRight className="h-4 w-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PIN (somente cadastro novo) */}
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
              <p className="text-slate-400 text-sm">
                {isRegularize
                  ? "Cadastre ou atualize a biometria para assinar cautelas com reconhecimento facial."
                  : <>Capture o rosto para usar como <span className="text-blue-400 font-medium">assinatura nas cautelas</span>.</>}
              </p>
            </div>
            <FaceRegistration onCapture={d => setFormData({...formData, face_descriptor: d})} />
            <div className="flex gap-3">
              <button onClick={() => setStep(isRegularize ? 2 : 3)} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white">Voltar</button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />} {isRegularize ? "Salvar regularização" : "Concluir Cadastro"}
              </button>
            </div>
            {formData.face_descriptor.length === 0 && (
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-[10px] text-yellow-500 font-bold uppercase tracking-wider">
                  <AlertTriangle className="h-3 w-3" />
                  Sem biometria, a cautela usará PIN como assinatura
                </div>
                <button onClick={handleSubmit} disabled={loading}
                  className="text-[10px] font-medium text-slate-600 hover:text-slate-400 underline underline-offset-2">
                  Pular e usar apenas PIN
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
