"use client"

import { useState, useEffect, useCallback } from "react"
import { searchPersons, getAvailableMaterials, getAvailableMaterialsGrouped, createCautela, createCautelaFaceAuth, getPendingCautelasForPerson } from "@/app/actions/cautelas"
import { getCategories } from "@/app/actions/categories"
import FaceVerification from "./FaceVerification"
import {
  X, Search, ChevronRight, Check, ClipboardList, Users, Package,
  ScanFace, Loader2, AlertTriangle, Trash2, Plus, CheckCircle, Fingerprint,
  AlertCircle, Info, Clock, Image as ImageIcon, UserCheck, Calendar,
  MessageSquare, Hash, Building, AlertOctagon, ShieldAlert, Zap
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

// ===== TIPOS E INTERFACES =====

type Person = {
  id: string
  full_name: string
  rg: string
  registration_number: string
  function?: string
  status: string
  rg_front_url?: string
  rg_back_url?: string
  face_descriptor?: number[]
}

type Material = {
  id: string
  name: string
  patrimony_number: string
  serial_number?: string
  internal_code: string
  category_id?: string
  categories?: {
    id: string
    name: string
  }
}

type CategoryGroup = {
  id: string
  name: string
  materials: Material[]
}

// ===== CONSTANTES DE VALIDAÇÃO DE CALIBRE =====

// Calibres de armas de fogo (padrões brasileiros)
const CALIBER_PATTERNS = [
  { pattern: /9mm/i, caliber: "9mm" },
  { pattern: /\.40\b/i, caliber: ".40" },
  { pattern: /\.45\b/i, caliber: ".45" },
  { pattern: /\.38\b/i, caliber: ".38" },
  { pattern: /\.357\b/i, caliber: ".357" },
  { pattern: /\.380\b/i, caliber: ".380" },
  { pattern: /5\.7/i, caliber: "5.7" },
  { pattern: /7\.62/i, caliber: "7.62" },
  { pattern: /7\.62x51/i, caliber: "7.62x51" },
  { pattern: /12\s*gauge/i, caliber: "12" },
  { pattern: /\b12\b(?!mm)/i, caliber: "12" },
  { pattern: /16\s*gauge/i, caliber: "16" },
  { pattern: /20\s*gauge/i, caliber: "20" },
  { pattern: /\.223/i, caliber: ".223" },
  { pattern: /5\.56/i, caliber: "5.56" },
  { pattern: /6\.35/i, caliber: "6.35" },
  { pattern: /\.25\b/i, caliber: ".25" },
  { pattern: /\b9\.3\b/i, caliber: "9.3" },
]

// Categorias de armas (que contêm calibre)
const WEAPON_CATEGORIES = [
  "pistola", "revólver", "carabina", "escopeta", "submetralhadora",
  "rifle", "garrucha", " espingarda", "pistolete"
]

// Palavras-chave que indicam munição
const AMMUNITION_KEYWORDS = ["munição", "municao", "cartucho", "balote", "projectil"]

// Verifica se é uma categoria/arma
function isWeaponCategory(name: string): boolean {
  const lowerName = name.toLowerCase()
  return WEAPON_CATEGORIES.some(keyword => lowerName.includes(keyword))
}

// Verifica se é uma categoria de munição
function isAmmunitionCategory(name: string): boolean {
  const lowerName = name.toLowerCase()
  return AMMUNITION_KEYWORDS.some(keyword => lowerName.includes(keyword))
}

// Extrai calibre de um texto (nome da categoria ou material)
function extractCaliber(text: string): string | null {
  for (const { pattern, caliber } of CALIBER_PATTERNS) {
    if (pattern.test(text)) {
      return caliber
    }
  }
  return null
}

// Verifica compatibilidade entre calibre de arma e munição
function areCalibersCompatible(weaponCaliber: string, ammoCaliber: string): boolean {
  // Normalizar comparações
  const w = weaponCaliber.toLowerCase().replace(/\s*/g, "")
  const a = ammoCaliber.toLowerCase().replace(/\s*/g, "")
  return w === a
}

// Tipos de incompatibilidade
interface CaliberMismatch {
  materialId: string
  materialName: string
  ammoCaliber: string
  incompatibleWeapons: Array<{
    id: string
    name: string
    caliber: string
  }>
}

interface CautelaWizardProps {
  onSuccess: () => void
  onCancel: () => void
}

const STEPS = [
  { label: "Pessoa", icon: Users },
  { label: "Materiais", icon: Package },
  { label: "Resumo", icon: ClipboardList },
  { label: "Assinatura", icon: ScanFace },
]

// Estado para validação de calibre
interface CaliberValidation {
  weapons: Material[]
  ammunition: Material[]
  selectedWeapon: Material | null
  selectedAmmo: Material[]
  incompatibilities: CaliberMismatch[]
  warnings: string[]
}

// Função para validar calibre da munição selecionada
function validateAmmunitionCaliber(
  selectedItems: Material[],
  allMaterials: CategoryGroup[]
): { incompatibilities: CaliberMismatch[], warnings: string[], selectedWeapon: Material | null } {
  const incompatibilities: CaliberMismatch[] = []
  const warnings: string[] = []

  // Separar armas e munições selecionadas
  const selectedWeapons = selectedItems.filter(item => {
    const categoryName = item.categories?.name || ""
    return isWeaponCategory(categoryName) || isWeaponCategory(item.name)
  })

  const selectedAmmunition = selectedItems.filter(item => {
    const categoryName = item.categories?.name || ""
    return isAmmunitionCategory(categoryName) || isAmmunitionCategory(item.name)
  })

  // Se não há armas ou munições, não há validação
  if (selectedWeapons.length === 0 || selectedAmmunition.length === 0) {
    return { incompatibilities, warnings, selectedWeapon: null }
  }

  // Pegar a primeira arma selecionada como referência
  const primaryWeapon = selectedWeapons[0]
  const weaponName = primaryWeapon.categories?.name || primaryWeapon.name

  // Extrair calibre da arma
  const weaponCaliber = extractCaliber(weaponName) || extractCaliber(primaryWeapon.name)

  if (!weaponCaliber) {
    warnings.push(`Não foi possível identificar o calibre da arma ${primaryWeapon.name}`)
    return { incompatibilities, warnings, selectedWeapon: primaryWeapon }
  }

  // Verificar cada munição selecionada
  for (const ammo of selectedAmmunition) {
    const ammoName = ammo.categories?.name || ammo.name
    const ammoCaliber = extractCaliber(ammoName) || extractCaliber(ammo.name)

    if (!ammoCaliber) {
      warnings.push(`Não foi possível identificar o calibre da munição ${ammo.name}`)
      continue
    }

    if (!areCalibersCompatible(weaponCaliber, ammoCaliber)) {
      incompatibilities.push({
        materialId: ammo.id,
        materialName: ammo.name,
        ammoCaliber,
        incompatibleWeapons: [{
          id: primaryWeapon.id,
          name: primaryWeapon.name,
          caliber: weaponCaliber
        }]
      })
    }
  }

  return { incompatibilities, warnings, selectedWeapon: primaryWeapon }
}

type Person = {
  id: string
  full_name: string
  rg: string
  registration_number: string
  function?: string
  status: string
  rg_front_url?: string
  rg_back_url?: string
  face_descriptor?: number[]
}

type Material = {
  id: string
  name: string
  patrimony_number: string
  serial_number?: string
  internal_code: string
  categories?: any
}

export default function CautelaWizard({ onSuccess, onCancel }: CautelaWizardProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1: Pessoa
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [searching, setSearching] = useState(false)
  const [photoWarning, setPhotoWarning] = useState(false)
  const [pendingCautelas, setPendingCautelas] = useState<any[]>([])
  const [loadingPending, setLoadingPending] = useState(false)

  // Step 2: Materiais
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([])
  const [groupedMaterials, setGroupedMaterials] = useState<CategoryGroup[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<Material[]>([])
  const [materialSearch, setMaterialSearch] = useState("")
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [otherMaterial, setOtherMaterial] = useState("")

  // Validação de calibre (INCOMPATIBILIDADES NÃO SÃO BLOQUEANTES)
  const [caliberIncompatibilities, setCaliberIncompatibilities] = useState<CaliberMismatch[]>([])
  const [caliberWarnings, setCaliberWarnings] = useState<string[]>([])
  const [selectedWeaponForCaliber, setSelectedWeaponForCaliber] = useState<Material | null>(null)

  // Step 3: Resumo
  const [cautelaType, setCautelaType] = useState<"daily" | "permanent">("daily")
  const [notes, setNotes] = useState("")

  // Sugestões de observações comuns
  const observationSuggestions = [
    { label: "Operação", icon: AlertOctagon, text: "Operação no Setor Norte" },
    { label: "Treinamento", icon: Building, text: "Treinamento/Ginástica" },
    { label: "Escala", icon: Hash, text: "Escala de serviço plantão" },
    { label: "Diligência", icon: MessageSquare, text: "Diligência judicial" },
  ]

  const addObservation = (text: string) => {
    setNotes(prev => prev ? `${prev}\n${text}` : text)
  }

  // Step 4: Assinatura
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState("")
  const [useFace, setUseFace] = useState(true)

  // Buscar categorias e materiais agrupados ao abrir Step 2
  useEffect(() => {
    if (step === 2) {
      setLoadingMaterials(true)
      Promise.all([
        getCategories(),
        getAvailableMaterialsGrouped()
      ])
        .then(([cats, grouped]) => {
          setCategories(cats)
          setGroupedMaterials(grouped)
        })
        .catch(console.error)
        .finally(() => setLoadingMaterials(false))
    }
  }, [step])

  // Buscar materiais quando muda categoria (para filtro)
  useEffect(() => {
    if (step === 2 && selectedCategory) {
      setLoadingMaterials(true)
      getAvailableMaterials(selectedCategory)
        .then(setAvailableMaterials)
        .catch(console.error)
        .finally(() => setLoadingMaterials(false))
    }
  }, [step, selectedCategory])

  // Buscar pessoas
  const handleSearch = async () => {
    if (searchQuery.length < 2) return
    setSearching(true)
    try {
      const results = await searchPersons(searchQuery)
      setSearchResults(results)
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }

  useEffect(() => {
    const timer = setTimeout(() => { if (searchQuery.length >= 2) handleSearch() }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Buscar cautelas pendentes ao selecionar pessoa
  useEffect(() => {
    if (selectedPerson) {
      setLoadingPending(true)
      getPendingCautelasForPerson(selectedPerson.id)
        .then(setPendingCautelas)
        .catch(() => setPendingCautelas([]))
        .finally(() => setLoadingPending(false))
    } else {
      setPendingCautelas([])
    }
  }, [selectedPerson])

  const selectPerson = (person: Person) => {
    setSelectedPerson(person)
    setSearchResults([])
    setSearchQuery("")
    setPendingCautelas([])
    // Verificar fotos
    if (!person.rg_front_url || !person.rg_back_url) {
      setPhotoWarning(true)
    } else {
      setPhotoWarning(false)
    }
    // Decidir método de assinatura
    if (person.face_descriptor && Array.isArray(person.face_descriptor) && person.face_descriptor.length > 0) {
      setUseFace(true)
    } else {
      setUseFace(false)
    }
  }

  const toggleMaterial = (mat: Material) => {
    let newSelected: Material[]
    if (selectedMaterials.find(m => m.id === mat.id)) {
      newSelected = selectedMaterials.filter(m => m.id !== mat.id)
    } else {
      newSelected = [...selectedMaterials, mat]
    }
    setSelectedMaterials(newSelected)

    // Validar calibre após mudança de seleção (NÃO bloqueia, apenas alerta)
    const validation = validateAmmunitionCaliber(newSelected, groupedMaterials)
    setCaliberIncompatibilities(validation.incompatibilities)
    setCaliberWarnings(validation.warnings)
    setSelectedWeaponForCaliber(validation.selectedWeapon)
  }

  const handleNextStep = () => {
    if (step === 1 && selectedPerson) setStep(2)
    else if (step === 2 && selectedMaterials.length > 0) setStep(3)
    else if (step === 3) setStep(4)
  }

  // Submeter cautela com PIN (fallback)
  const handleSubmitWithPin = async () => {
    if (pin.length !== 4) return
    setLoading(true)
    setPinError("")
    try {
      const result = await createCautela({
        person_id: selectedPerson!.id,
        type: cautelaType,
        material_ids: selectedMaterials.map(m => m.id),
        notes: notes || undefined,
        pin,
      })
      if (result.success) {
        // Enviar e-mail em background
        fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cautelaId: result.cautelaId }) }).catch(() => {})
        onSuccess()
      } else {
        setPinError(result.error || "Erro ao criar cautela")
        setPin("")
      }
    } catch (err: any) {
      setPinError(err.message || "Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  // Submeter cautela com verificação facial
  const handleFaceVerified = async (matched: boolean) => {
    if (!matched) return
    setLoading(true)
    try {
      const result = await createCautelaFaceAuth({
        person_id: selectedPerson!.id,
        type: cautelaType,
        material_ids: selectedMaterials.map(m => m.id),
        notes: notes || undefined,
      })
      if (result.success) {
        // Enviar e-mail em background
        fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cautelaId: result.cautelaId }) }).catch(() => {})
        onSuccess()
      } else {
        setPinError(result.error || "Erro ao criar cautela")
      }
    } catch (err: any) {
      setPinError(err.message || "Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  const filteredMaterials = availableMaterials.filter((m: any) =>
    !materialSearch ||
    m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
    m.patrimony_number.toLowerCase().includes(materialSearch.toLowerCase()) ||
    m.internal_code.toLowerCase().includes(materialSearch.toLowerCase())
  )

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-w-2xl w-full mx-auto shadow-2xl max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-500" /> Nova Cautela
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-white p-1"><X className="h-5 w-5" /></button>
      </div>

      {/* Steps */}
      <div className="px-4 py-2.5 flex items-center justify-center gap-1 bg-slate-950/30 border-b border-slate-800/50">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
              step > i + 1 ? "bg-green-600 border-green-600 text-white" :
              step === i + 1 ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 text-slate-600"
            }`}>{step > i + 1 ? <Check className="h-2.5 w-2.5" /> : i + 1}</div>
            <span className={`text-[9px] font-bold uppercase tracking-wider hidden sm:block ${step === i + 1 ? "text-white" : "text-slate-600"}`}>{s.label}</span>
            {i < 3 && <ChevronRight className="h-3 w-3 text-slate-700 mx-0.5" />}
          </div>
        ))}
      </div>

      <div className="p-5 sm:p-6">
        {/* ===== STEP 1: Selecionar Pessoa ===== */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-white">Selecionar Pessoa</h3>
              <p className="text-slate-400 text-sm">Busque por nome, RG ou matrícula.</p>
            </div>

            {!selectedPerson ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar pessoa..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />}
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map(person => (
                      <button
                        key={person.id}
                        onClick={() => selectPerson(person)}
                        className="w-full text-left p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
                      >
                        <p className="text-sm font-bold text-white">{person.full_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          RG: {person.rg} • Matrícula: {person.registration_number}
                          {person.function && <span> • {person.function}</span>}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-center text-sm text-slate-500">Nenhuma pessoa encontrada.</p>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-white">{selectedPerson.full_name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        RG: {selectedPerson.rg} • Matrícula: {selectedPerson.registration_number}
                      </p>
                      {selectedPerson.function && <p className="text-xs text-blue-400 mt-0.5">{selectedPerson.function}</p>}
                    </div>
                    <button onClick={() => { setSelectedPerson(null); setPhotoWarning(false); setPendingCautelas([]) }}
                      className="text-xs text-slate-500 hover:text-red-400 font-bold">Trocar</button>
                  </div>
                </div>

                {/* ===== ALERTAS NÃO BLOQUEANTES ===== */}

                {/* Cautelas Pendentes (apenas DIÁRIAS) */}
                {loadingPending ? (
                  <div className="flex items-center gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                    <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                    <p className="text-xs text-slate-400">Verificando cautelas pendentes...</p>
                  </div>
                ) : pendingCautelas.length > 0 ? (
                  <div className="space-y-2">
                    {pendingCautelas.map(cautela => (
                      <div
                        key={cautela.id}
                        className={`flex items-start gap-2 p-3 rounded-lg border ${
                          cautela.is_overdue
                            ? "bg-red-500/5 border-red-500/20"
                            : "bg-yellow-500/5 border-yellow-500/20"
                        }`}
                      >
                        {cautela.is_overdue ? (
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className={`text-xs font-medium ${
                            cautela.is_overdue ? "text-red-400" : "text-yellow-400"
                          }`}>
                            Cautela Diária {cautela.is_overdue ? "VENCIDA" : "em aberto"}
                            {cautela.items_count > 0 && ` (${cautela.items_count} item(ns))`}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Criada em {format(new Date(cautela.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            {cautela.profiles?.name && ` • Operador: ${cautela.profiles.name}`}
                          </p>
                          {/* Lista de itens pendentes */}
                          {cautela.items && cautela.items.length > 0 && (
                            <div className="mt-2 space-y-1 pl-1">
                              {cautela.items.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                                  <Package className="h-3 w-3 text-slate-500" />
                                  <span>{item.materials?.name || "Material"}</span>
                                  {item.materials?.patrimony_number && (
                                    <span className="text-slate-500">Pat: {item.materials.patrimony_number}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <Link
                            href={`/cautelas?id=${cautela.id}`}
                            className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 mt-2"
                          >
                            Ver detalhes <ChevronRight className="h-2.5 w-2.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-green-400">Nenhuma cautela diária pendente</p>
                  </div>
                )}

                {/* Pendências Cadastrais */}
                {(photoWarning || !useFace) && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-yellow-400">
                        Pendências cadastrais detectadas:
                      </p>
                      <ul className="text-[10px] text-yellow-300/80 mt-1 space-y-0.5">
                        {photoWarning && <li>• Fotos do RG incompletas</li>}
                        {!useFace && <li>• Biometria facial não cadastrada</li>}
                      </ul>
                      <Link
                        href={`/persons?edit=${selectedPerson.id}`}
                        className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 mt-2"
                      >
                        Regularizar cadastro <ChevronRight className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Info sobre método de assinatura */}
                {!useFace ? (
                  <div className="flex items-start gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                    <Fingerprint className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-400">
                      Biometria facial não cadastrada. A assinatura será feita com <strong className="text-slate-300">PIN</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <UserCheck className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-400">
                      Biometria facial disponível. Assinatura será feita com <strong>reconhecimento facial</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            <button onClick={handleNextStep} disabled={!selectedPerson}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50"
            >Próximo: Materiais <ChevronRight className="h-4 w-4" /></button>
          </div>
        )}

        {/* ===== STEP 2: Selecionar Materiais ===== */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-white">Selecionar Materiais</h3>
              <p className="text-slate-400 text-sm">Escolha os materiais a serem cautelados.</p>
            </div>

            {/* Busca por material */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={materialSearch}
                onChange={e => setMaterialSearch(e.target.value)}
                placeholder="Buscar material por nome, patrimônio ou código..."
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* ===== ALERTAS DE VALIDAÇÃO DE CALIBRE (NÃO BLOQUEANTES) ===== */}
            {selectedWeaponForCaliber && (
              <div className="space-y-2">
                {/* Info: Arma selecionada */}
                <div className="flex items-center gap-2 p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <Zap className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-400">
                    Arma selecionada: <strong className="text-white">{selectedWeaponForCaliber.name}</strong>
                    {extractCaliber(selectedWeaponForCaliber.categories?.name || selectedWeaponForCaliber.name) && (
                      <span className="ml-1 text-blue-300">— Calibre: {extractCaliber(selectedWeaponForCaliber.categories?.name || selectedWeaponForCaliber.name)}</span>
                    )}
                  </p>
                </div>

                {/* Incompatibilidades de calibre */}
                {caliberIncompatibilities.length > 0 && (
                  <div className="p-3 bg-red-500/5 border border-red-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-red-400">
                          Incompatibilidade de calibre detectada
                        </p>
                        <p className="text-[10px] text-red-300/80 mt-1 space-y-1">
                          {caliberIncompatibilities.map((inc, idx) => (
                            <span key={idx} className="block">
                              • <strong>{inc.materialName}</strong> (calibre {inc.ammoCaliber}) incompatível com {selectedWeaponForCaliber.name} (calibre {extractCaliber(selectedWeaponForCaliber.categories?.name || selectedWeaponForCaliber.name)})
                            </span>
                          ))}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Avisos de calibre não identificado */}
                {caliberWarnings.length > 0 && (
                  <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-yellow-400">
                          Calibre não identificado
                        </p>
                        <p className="text-[10px] text-yellow-300/80 mt-1 space-y-0.5">
                          {caliberWarnings.map((warning, idx) => (
                            <span key={idx} className="block">• {warning}</span>
                          ))}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status: compatível */}
                {caliberIncompatibilities.length === 0 && caliberWarnings.length === 0 && selectedMaterials.some(m => {
                  const catName = m.categories?.name || m.name
                  return isAmmunitionCategory(catName)
                }) && (
                  <div className="flex items-center gap-2 p-2 bg-green-500/5 border border-green-500/20 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <p className="text-xs text-green-400">Munições compatíveis com a arma selecionada</p>
                  </div>
                )}
              </div>
            )}

            {/* Lista de materiais por categoria */}
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {loadingMaterials ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 text-blue-500 animate-spin" /></div>
              ) : groupedMaterials.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-4">Nenhuma categoria encontrada.</p>
              ) : (
                groupedMaterials
                  .filter(group => {
                    // Se há busca, filtrar grupos que têm materiais correspondentes
                    if (!materialSearch) return group.materials.length > 0
                    return group.materials.some((m: any) =>
                      m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
                      m.patrimony_number.toLowerCase().includes(materialSearch.toLowerCase()) ||
                      m.internal_code.toLowerCase().includes(materialSearch.toLowerCase())
                    )
                  })
                  .map(group => {
                    const filteredMaterialsInGroup = materialSearch
                      ? group.materials.filter((m: any) =>
                          m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
                          m.patrimony_number.toLowerCase().includes(materialSearch.toLowerCase()) ||
                          m.internal_code.toLowerCase().includes(materialSearch.toLowerCase())
                        )
                      : group.materials

                    if (filteredMaterialsInGroup.length === 0) return null

                    const selectedInGroup = filteredMaterialsInGroup.filter((m: any) =>
                      selectedMaterials.some(sm => sm.id === m.id)
                    ).length

                    return (
                      <div key={group.id} className="space-y-2">
                        {/* Header da categoria */}
                        <div className="flex items-center justify-between px-1">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {group.name}
                          </h4>
                          {selectedInGroup > 0 && (
                            <span className="text-[10px] text-blue-400 font-medium">
                              {selectedInGroup} selecionado(s)
                            </span>
                          )}
                        </div>

                        {/* Materiais da categoria */}
                        <div className="space-y-1">
                          {filteredMaterialsInGroup.map((mat: any) => {
                            const isSelected = selectedMaterials.some(m => m.id === mat.id)
                            const categoryName = mat.categories?.name || ""
                            const materialName = mat.name
                            const isAmmunition = isAmmunitionCategory(categoryName) || isAmmunitionCategory(materialName)
                            const isWeapon = isWeaponCategory(categoryName) || isWeaponCategory(materialName)

                            // Extrair calibre
                            const caliber = extractCaliber(categoryName) || extractCaliber(materialName)
                            const weaponCaliber = selectedWeaponForCaliber
                              ? extractCaliber(selectedWeaponForCaliber.categories?.name || selectedWeaponForCaliber.name)
                              : null

                            // Verificar compatibilidade (para munição)
                            let isCompatible: boolean | null = null
                            if (isAmmunition && caliber && weaponCaliber) {
                              isCompatible = areCalibersCompatible(caliber, weaponCaliber)
                            }

                            // Cor do item baseada na compatibilidade
                            let itemBorderColor = ""
                            let itemBgColor = ""
                            let badgeColor = ""

                            if (isSelected && caliberIncompatibilities.some(inc => inc.materialId === mat.id)) {
                              itemBorderColor = "border-red-500/50"
                              itemBgColor = "bg-red-500/5"
                            }

                            return (
                              <button
                                key={mat.id}
                                onClick={() => toggleMaterial(mat)}
                                className={`w-full text-left p-2.5 rounded-lg border transition-all flex justify-between items-start ${
                                  isSelected
                                    ? `bg-blue-500/10 border-blue-500/30 text-white ${itemBorderColor} ${itemBgColor}`
                                    : `bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 ${itemBorderColor}`
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium truncate">{mat.name}</p>
                                    {/* Badge de calibre */}
                                    {caliber && (
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                                        isWeapon
                                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                          : "bg-slate-700/50 text-slate-400"
                                      }`}>
                                        {caliber}
                                      </span>
                                    )}
                                    {/* Indicador de compatibilidade para munição */}
                                    {isAmmunition && selectedWeaponForCaliber && caliber && isCompatible !== null && (
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                                        isCompatible
                                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                                      }`}>
                                        {isCompatible ? "Compatível" : "Incompatível"}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    Pat: {mat.patrimony_number} • Cód: {mat.internal_code}
                                  </p>
                                </div>
                                <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ml-2 ${
                                  isSelected ? "bg-blue-600 border-blue-600" : "border-slate-700"
                                }`}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
              )}
            </div>

            {/* Selecionados */}
            {selectedMaterials.length > 0 && (
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">
                  {selectedMaterials.length} material(is) selecionado(s)
                </p>
                <div className="space-y-1">
                  {selectedMaterials.map(m => (
                    <div key={m.id} className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">{m.name}</span>
                      <button onClick={() => toggleMaterial(m)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white">Voltar</button>
              <button onClick={handleNextStep} disabled={selectedMaterials.length === 0}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50"
              >Próximo: Resumo <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: Resumo ===== */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-white">Resumo da Cautela</h3>
              <p className="text-slate-400 text-sm">Confira tudo antes de prosseguir.</p>
            </div>

            <div className="space-y-3">
              {/* Pessoa */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cautelado</p>
                <p className="text-sm font-bold text-white">{selectedPerson?.full_name}</p>
                <p className="text-xs text-slate-400">RG: {selectedPerson?.rg} • Mat: {selectedPerson?.registration_number}</p>
              </div>

              {/* Materiais */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Materiais ({selectedMaterials.length})
                </p>
                <div className="space-y-1.5">
                  {selectedMaterials.map(m => {
                    // Verificar se este material tem incompatibilidade de calibre
                    const hasIncompatibility = caliberIncompatibilities.some(inc => inc.materialId === m.id)
                    const caliber = extractCaliber(m.categories?.name || m.name)
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-xs">
                        <Package className={`h-3 w-3 flex-shrink-0 ${hasIncompatibility ? "text-red-500" : "text-blue-500"}`} />
                        <span className={`font-medium ${hasIncompatibility ? "text-red-300" : "text-slate-300"}`}>
                          {m.name}
                        </span>
                        {caliber && (
                          <span className={`text-[9px] px-1 py-0.5 rounded ${
                            hasIncompatibility ? "bg-red-500/20 text-red-400" : "bg-slate-700/50 text-slate-400"
                          }`}>
                            {caliber}
                          </span>
                        )}
                        <span className="text-slate-600">—</span>
                        <span className="text-slate-500">Pat: {m.patrimony_number}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Aviso de Incompatibilidade de Calibre */}
              {caliberIncompatibilities.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-red-400">
                        Atenção: Incompatibilidade de calibre
                      </p>
                      <p className="text-[10px] text-red-300/80 mt-1">
                        As seguintes munições são incompatíveis com a arma selecionada. Deseja continuar?
                      </p>
                      <ul className="text-[10px] text-red-300/80 mt-1 space-y-0.5 ml-2">
                        {caliberIncompatibilities.map((inc, idx) => (
                          <li key={idx}>• {inc.materialName} (calibre {inc.ammoCaliber})</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Tipo */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo da Cautela</p>
                <div className="flex gap-2">
                  <button onClick={() => setCautelaType("daily")}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                      cautelaType === "daily" ? "bg-blue-600/10 border-blue-500 text-blue-400" : "border-slate-700 text-slate-500 hover:border-slate-600"
                    }`}>Diária</button>
                  <button onClick={() => setCautelaType("permanent")}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                      cautelaType === "permanent" ? "bg-blue-600/10 border-blue-500 text-blue-400" : "border-slate-700 text-slate-500 hover:border-slate-600"
                    }`}>Permanente</button>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Observações
                  </label>
                  <p className="text-[9px] text-slate-600 mt-0.5">Adicione informações relevantes para rastreabilidade</p>
                </div>

                {/* Sugestões rápidas */}
                <div className="flex flex-wrap gap-1.5">
                  {observationSuggestions.map((suggestion, index) => {
                    const Icon = suggestion.icon
                    return (
                      <button
                        key={index}
                        onClick={() => addObservation(suggestion.text)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 rounded-md text-[10px] text-slate-400 hover:text-slate-300 transition-all"
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {suggestion.label}
                      </button>
                    )
                  })}
                </div>

                {/* Campo de observação */}
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Material para operação no Setor Norte, em horário noturno..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                  rows={3}
                />

                {/* Contador de caracteres */}
                <div className="flex justify-end">
                  <span className="text-[9px] text-slate-600">
                    {notes.length} / 500 caracteres
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white">Voltar</button>
              <button onClick={handleNextStep}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500"
              >Próximo: {useFace ? "Assinatura Facial" : "PIN"} <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* ===== STEP 4: Assinatura (Facial ou PIN) ===== */}
        {step === 4 && (
          <div className="space-y-5">
            {useFace && selectedPerson?.face_descriptor ? (
              <FaceVerification
                storedDescriptor={selectedPerson.face_descriptor}
                onResult={handleFaceVerified}
                personName={selectedPerson.full_name}
              />
            ) : (
              /* Fallback: PIN */
              <div className="space-y-6 text-center max-w-xs mx-auto">
                <div className="flex justify-center">
                  <div className="h-14 w-14 rounded-full bg-blue-500/10 flex items-center justify-center border-2 border-blue-500/20">
                    <Fingerprint className="h-7 w-7 text-blue-500" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Validar PIN</h3>
                  <p className="text-slate-400 text-sm">
                    <span className="text-blue-400 font-medium">{selectedPerson?.full_name}</span> deve digitar o PIN de 4 dígitos.
                  </p>
                </div>

                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`h-12 w-10 rounded-xl border-2 flex items-center justify-center text-xl font-bold ${
                      pin.length > i ? "border-blue-500 bg-blue-500/10 text-white" : "border-slate-800 bg-slate-900 text-slate-700"
                    }`}>{pin[i] ? "•" : ""}</div>
                  ))}
                </div>

                {pinError && (
                  <div className="text-xs text-red-400 font-medium bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                    {pinError}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "✓"].map(key => {
                    if (key === "C") return <button key={key} onClick={() => { setPin(""); setPinError("") }} className="h-12 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700">Limpar</button>
                    if (key === "✓") return (
                      <button key={key} onClick={handleSubmitWithPin} disabled={pin.length !== 4 || loading}
                        className="h-12 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                      </button>
                    )
                    return (
                      <button key={key} onClick={() => pin.length < 4 && setPin(pin + key)}
                        className="h-12 rounded-xl bg-slate-800 text-lg font-bold text-white hover:bg-slate-700 active:bg-blue-600 transition-colors"
                      >{key}</button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white">Voltar</button>
              {useFace && (
                <button onClick={() => setUseFace(false)} className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-400 hover:text-white">
                  Usar PIN
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
