"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase-client"
import { createPerson } from "@/app/actions/persons"
import Tesseract from "tesseract.js"
import { 
  Camera, 
  Upload, 
  Search, 
  Check, 
  X, 
  UserPlus, 
  Fingerprint, 
  Loader2,
  FileText,
  ScanFace,
  CheckCircle
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

export default function PersonRegistrationWizard({ onSuccess, onCancel, initialData }: PersonWizardProps) {
  const [step, setStep] = useState(1) // 1: Upload, 2: Review, 3: PIN, 4: Face
  const [loading, setLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [formData, setFormData] = useState({
    full_name: initialData?.name || "",
    rg: initialData?.rg || "",
    registration_number: "",
    function: "",
    pin: "",
    photo_url: "",
    face_descriptor: [] as number[]
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setStep(1)

    try {
      // 1. OCR local com Tesseract.js
      const { data: { text } } = await Tesseract.recognize(file, 'por', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.floor(m.progress * 100))
          }
        }
      })

      // 2. Tentar extrair dados (Lógica simplificada para o exemplo)
      console.log("OCR Result:", text)
      
      // Extrair RG (procurando padrões de números)
      const rgMatch = text.match(/\d{2}\.\d{3}\b/g) // Ex: 06.433
      let extractedRg = rgMatch ? rgMatch[0].replace(/\D/g, "") : ""
      
      // Extrair Nome (assumindo que nomes grandes em maiúsculas são o nome)
      const names = text.split('\n').filter(line => line.length > 5 && line === line.toUpperCase())
      const extractedName = names.length > 0 ? names[0] : ""

      // Extrair Matrícula (números longos)
      const matriculaMatch = text.match(/\d{7,10}/g)
      const extractedMatricula = matriculaMatch ? matriculaMatch[0] : ""

      setFormData(prev => ({
        ...prev,
        full_name: extractedName || prev.full_name,
        rg: extractedRg || prev.rg,
        registration_number: extractedMatricula || prev.registration_number
      }))

      // 3. Upload para o Supabase Storage (opcional se configurado)
      // Por agora vamos apenas seguir para a revisão
      setStep(2)
    } catch (err) {
      console.error(err)
      alert("Erro ao processar imagem. Você pode preencher manualmente.")
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    const result = await createPerson(formData)
    setLoading(false)

    if (result.success) {
      onSuccess()
    } else {
      alert(result.error)
    }
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-w-2xl w-full mx-auto shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-500" />
          Novo Cadastro de Pessoa
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-white">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Steps Indicator */}
      <div className="px-6 py-4 flex items-center justify-center gap-4 bg-slate-950/30">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
              step >= s ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-500'
            }`}>
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 4 && <div className={`h-0.5 w-8 rounded ${step > s ? 'bg-blue-600' : 'bg-slate-800'}`} />}
          </div>
        ))}
      </div>

      <div className="p-8">
        {step === 1 && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-2xl bg-blue-500/10 flex items-center justify-center border-2 border-blue-500/20">
                <FileText className="h-10 w-10 text-blue-500" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Upload do Documento (RG)</h3>
              <p className="text-slate-400 mt-1 max-w-sm mx-auto">
                Tire uma foto nítida do RG para preenchimento automático dos dados.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-6 hover:border-blue-500 hover:bg-blue-500/5 cursor-pointer transition-all group">
                <Camera className="h-8 w-8 text-slate-500 group-hover:text-blue-500 mb-2" />
                <span className="text-sm font-medium text-slate-400 group-hover:text-white">Usar Câmera</span>
                <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-6 hover:border-blue-500 hover:bg-blue-500/5 cursor-pointer transition-all group">
                <Upload className="h-8 w-8 text-slate-500 group-hover:text-blue-500 mb-2" />
                <span className="text-sm font-medium text-slate-400 group-hover:text-white">Subir Foto</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>

            <button 
              onClick={() => setStep(2)}
              className="mt-4 text-sm font-medium text-slate-500 hover:text-white underline underline-offset-4"
            >
              Pular e preencher manualmente
            </button>

            {loading && (
              <div className="mt-6 p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <span>Processando OCR...</span>
                  <span>{ocrProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">RG (5 dígitos)</label>
                <input
                  type="text"
                  value={formData.rg}
                  onChange={e => setFormData({...formData, rg: e.target.value})}
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Matrícula</label>
                <input
                  type="text"
                  value={formData.registration_number}
                  onChange={e => setFormData({...formData, registration_number: e.target.value})}
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posto/Graduação</label>
                <input
                  type="text"
                  value={formData.function}
                  onChange={e => setFormData({...formData, function: e.target.value})}
                  placeholder="Ex: CABO QPPM"
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <button
              onClick={() => setStep(3)}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500"
            >
              Próximo: Cadastrar PIN
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 text-center max-w-sm mx-auto">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center border-2 border-green-500/20">
                <Fingerprint className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Criar PIN de Acesso</h3>
              <p className="text-slate-400 mt-1">
                A pessoa que está sendo cadastrada deve digitar um PIN de 4 dígitos para autorizar cautelas futuras.
              </p>
            </div>

            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`h-14 w-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold ${
                  formData.pin.length > i ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-700'
                }`}>
                  {formData.pin[i] ? '•' : ''}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'limpar', 0, 'confirmar'].map((key) => {
                if (key === 'limpar') {
                  return (
                    <button 
                      key={key}
                      onClick={() => setFormData({...formData, pin: ""})}
                      className="h-14 rounded-xl bg-slate-800 text-sm font-bold text-slate-300 hover:bg-slate-700"
                    >
                      Limpar
                    </button>
                  )
                }
                if (key === 'confirmar') {
                  return (
                    <button 
                      key={key}
                      onClick={() => setStep(4)}
                      disabled={formData.pin.length !== 4}
                      className="h-14 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                    </button>
                  )
                }
                return (
                  <button 
                    key={key}
                    onClick={() => formData.pin.length < 4 && setFormData({...formData, pin: formData.pin + key})}
                    className="h-14 rounded-xl bg-slate-800 text-xl font-bold text-white hover:bg-slate-700 active:bg-blue-600 transition-colors"
                  >
                    {key}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-white">Biometria Facial</h3>
              <p className="text-slate-400">
                Capture o rosto do usuário para autorizar cautelas futuras através de reconhecimento facial.
              </p>
            </div>

            <FaceRegistration 
              onCapture={(descriptor) => setFormData({...formData, face_descriptor: descriptor})} 
            />

            <div className="flex gap-4">
               <button
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white"
              >
                Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                Concluir Cadastro
              </button>
            </div>
            
            <button 
              onClick={handleSubmit}
              className="w-full text-xs font-bold text-slate-500 hover:text-slate-400 uppercase tracking-widest mt-2"
            >
              Ignorar e cadastrar apenas com PIN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
