"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { ShieldAlert, AlertTriangle, CheckCircle, Zap, Plus, ArrowRightLeft, X, Check } from "lucide-react"
import { MaterialSearchField, normalizeWizardMaterial } from "./MaterialSearchField"
import { PackQtyInput, type PackQtyInputHandle } from "./PackQtyInput"
import { CautelaLinesSummary } from "./CautelaLinesSummary"
import {
  resolvePackAccessoriesForWeapon,
  resolvePackAccessoryForWeapon,
  validateMaterialQuantityForCautela,
  getDailyCautelaForMaterial,
  searchMaterials,
  type SearchableMaterial,
} from "@/app/actions/cautelas"
import { findPackAccessoryMergeLineIndex } from "@/lib/cautela-pack-accessories"
import { getMaterialCategoryOptions } from "@/app/actions/categories"
import {
  resolveCategoryNamesForGroup,
  type CautelaMaterialGroup,
} from "@/lib/cautela-material-groups"
import {
  validateAmmunitionCaliber,
  extractCaliber,
  isAmmunitionCategory,
  type CaliberMismatch,
} from "@/lib/cautela-caliber"

export type WizardMaterial = ReturnType<typeof normalizeWizardMaterial> & { id: string }

export type MaterialLine = {
  rowId: string
  material: WizardMaterial
  quantity: number
  /** Arma do pacote (pistola/arma longa) — evita fundir munição entre pacotes. */
  packWeaponId?: string
  packWeaponLabel?: string
  /** Carregadores do pool: N UUIDs distintos; quantity deve bater com length. */
  poolMaterialIds?: string[]
  /** Se este item está sendo transferido de outra cautela diária. */
  transferFromCautelaItemId?: string
  /** Nome da pessoa de origem na transferência. */
  transferFromPersonName?: string
  /** ID da cautela de origem. */
  transferFromCautelaId?: string
}

export type CautelaItemPayload = {
  material_id: string
  quantity: number
  transfer_from_cautela_item_id?: string
}

/** Expande linhas agregadas do pool em itens distintos para createCautela. */
export function materialLinesToCautelaItems(
  lines: MaterialLine[]
): CautelaItemPayload[] {
  return lines.flatMap((l) =>
    l.poolMaterialIds?.length
      ? l.poolMaterialIds.map((id) => ({
          material_id: id,
          quantity: 1,
          transfer_from_cautela_item_id: undefined,
        }))
      : [
          {
            material_id: l.material.id,
            quantity: l.quantity,
            transfer_from_cautela_item_id: l.transferFromCautelaItemId,
          },
        ]
  )
}

/** Retorna true se qualquer linha contém item de transferência. */
export function hasTransferItems(lines: MaterialLine[]): boolean {
  return lines.some((l) => Boolean(l.transferFromCautelaItemId))
}

function isPackChargerLine(row: MaterialLine): boolean {
  return Boolean(row.poolMaterialIds?.length && row.packWeaponId)
}

function upsertPackChargerLine(
  prev: MaterialLine[],
  weapon: SearchableMaterial,
  chargerMats: SearchableMaterial[],
  cq: number
): MaterialLine[] {
  const without = prev.filter(
    (l) => !(l.packWeaponId === weapon.id && isPackChargerLine(l))
  )
  if (chargerMats.length === 0) return without
  return [
    ...without,
    {
      rowId: crypto.randomUUID(),
      material: normalizeWizardMaterial(chargerMats[0]),
      quantity: cq,
      packWeaponId: weapon.id,
      packWeaponLabel: weapon.name,
      poolMaterialIds: chargerMats.map((m) => m.id),
    },
  ]
}

type Props = {
  lines: MaterialLine[]
  onLinesChange: (lines: MaterialLine[]) => void
  bornal: "yes" | "no" | null
  onBornalChange: (v: "yes" | "no" | null) => void
  outros: string
  onOutrosChange: (v: string) => void
  onCanProceedChange?: (canProceed: boolean) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 mb-2">
      {children}
    </h4>
  )
}

/** Inputs numéricos sem spinners; mínimo 0 quando aplicável */
const inputNoSpinner =
  "mt-1 w-full py-2 px-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

type MergeLineOpts = {
  packWeaponId?: string
  packWeaponLabel?: string
}

function mergeLines(
  prev: MaterialLine[],
  m: SearchableMaterial,
  qty: number,
  opts?: MergeLineOpts
): MaterialLine[] {
  const norm = normalizeWizardMaterial(m)
  const mergeTarget = {
    materialId: m.id,
    category: norm.category,
    materialName: norm.name,
    packWeaponId: opts?.packWeaponId,
  }
  const i = findPackAccessoryMergeLineIndex(
    prev.map((row) => ({
      materialId: row.material.id,
      category: row.material.category,
      materialName: row.material.name,
      packWeaponId: row.packWeaponId,
    })),
    mergeTarget
  )
  if (i >= 0) {
    return prev.map((row, idx) =>
      idx === i ? { ...row, quantity: row.quantity + qty } : row
    )
  }
  return [
    ...prev,
    {
      rowId: crypto.randomUUID(),
      material: norm,
      quantity: qty,
      packWeaponId: opts?.packWeaponId,
      packWeaponLabel: opts?.packWeaponLabel,
    },
  ]
}

export function CautelaMaterialsStep({
  lines,
  onLinesChange,
  bornal,
  onBornalChange,
  outros,
  onOutrosChange,
  onCanProceedChange,
}: Props) {
  const [distinctCategoryNames, setDistinctCategoryNames] = useState<string[]>([])

  useEffect(() => {
    getMaterialCategoryOptions()
      .then((rows) => setDistinctCategoryNames((rows ?? []).map((r) => r.name)))
      .catch(() => setDistinctCategoryNames([]))
  }, [])

  const cat = useCallback(
    (g: CautelaMaterialGroup) => resolveCategoryNamesForGroup(distinctCategoryNames, g),
    [distinctCategoryNames]
  )

  const pistolWeaponCategoryNames = useMemo(() => cat("pistol_weapon"), [cat])
  const longWeaponCategoryNames = useMemo(() => cat("long_weapon"), [cat])
  const vestCategoryNames = useMemo(() => cat("vest_plate"), [cat])
  const radioCategoryNames = useMemo(() => cat("radio_ht"), [cat])
  const taserEqCategoryNames = useMemo(() => cat("taser_equipment"), [cat])
  const taserAmmoCategoryNames = useMemo(() => cat("taser_ammo"), [cat])
  const cellCategoryNames = useMemo(() => cat("cellphone"), [cat])
  const printerCategoryNames = useMemo(() => cat("printer"), [cat])

  /** Se não houver categoria mapeada, busca sem filtro (evita tela vazia). */
  const opt = (names: string[]) => (names.length > 0 ? names : undefined)

  const [pistolWeapon, setPistolWeapon] = useState<SearchableMaterial | null>(null)
  const [chargerQty, setChargerQty] = useState(3)
  const [ammoQty, setAmmoQty] = useState(0)

  const [longWeapon, setLongWeapon] = useState<SearchableMaterial | null>(null)
  const [longChargerQty, setLongChargerQty] = useState(0)
  const [longAmmoQty, setLongAmmoQty] = useState(0)

  const pistolChargerQtyRef = useRef<PackQtyInputHandle>(null)
  const pistolAmmoQtyRef = useRef<PackQtyInputHandle>(null)
  const longChargerQtyRef = useRef<PackQtyInputHandle>(null)
  const longAmmoQtyRef = useRef<PackQtyInputHandle>(null)
  const taserAmmoQtyRef = useRef<PackQtyInputHandle>(null)

  const [taserAmmoQty, setTaserAmmoQty] = useState(0)
  const [taserAmmoMat, setTaserAmmoMat] = useState<SearchableMaterial | null>(null)

  const [packError, setPackError] = useState<string | null>(null)
  const [packApplying, setPackApplying] = useState(false)
  const [addedToast, setAddedToast] = useState<string | null>(null)

  const [caliberIncompatibilities, setCaliberIncompatibilities] = useState<CaliberMismatch[]>([])
  const [caliberWarnings, setCaliberWarnings] = useState<string[]>([])
  const [selectedWeaponForCaliber, setSelectedWeaponForCaliber] = useState<WizardMaterial | null>(null)
  const [caliberOverrideConfirmed, setCaliberOverrideConfirmed] = useState(false)

  const [transferPat, setTransferPat] = useState("")
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferOrigin, setTransferOrigin] = useState<{
    cautela_id: string
    person_id: string
    person_name: string
    items: Array<{
      cautela_item_id: string
      material_id: string
      material_name: string
      patrimony_number: string
      quantity_delivered: number
      quantity_returned: number
      quantity_available: number
      category: string
      checked: boolean
      transferQty: number
    }>
  } | null>(null)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [permanentBlockMsg, setPermanentBlockMsg] = useState<string | null>(null)

  const selectedAsMaterialLike = useMemo(
    () =>
      lines.map((l) => ({
        id: l.material.id,
        name: l.material.name,
        category: l.material.category,
      })),
    [lines]
  )

  useEffect(() => {
    const v = validateAmmunitionCaliber(selectedAsMaterialLike)
    setCaliberIncompatibilities(v.incompatibilities)
    setCaliberWarnings(v.warnings)
    setSelectedWeaponForCaliber(
      v.selectedWeapon
        ? (lines.find((l) => l.material.id === v.selectedWeapon!.id)?.material ?? null)
        : null
    )
    if (v.incompatibilities.length === 0) setCaliberOverrideConfirmed(false)
  }, [selectedAsMaterialLike, lines])

  const canProceed =
    lines.length > 0 && (caliberIncompatibilities.length === 0 || caliberOverrideConfirmed)

  useEffect(() => {
    onCanProceedChange?.(canProceed)
  }, [canProceed, onCanProceedChange])

  const applyPistolPack = async () => {
    setPackError(null)
    if (!pistolWeapon) {
      setPackError("Selecione a arma (pistola) acima.")
      return
    }
    setPackApplying(true)
    try {
      const cq = pistolChargerQtyRef.current?.commit() ?? chargerQty
      const aq = pistolAmmoQtyRef.current?.commit() ?? ammoQty

      let chargerMats: SearchableMaterial[] = []
      let ammoMat: SearchableMaterial | null = null

      if (cq > 0) {
        const r = await resolvePackAccessoriesForWeapon(pistolWeapon.id, "charger", cq)
        if (r.error || r.materials.length < cq) {
          setPackError(r.error ?? "Carregador não encontrado no cadastro.")
          return
        }
        chargerMats = r.materials
      }
      if (aq > 0) {
        const r = await resolvePackAccessoryForWeapon(pistolWeapon.id, "ammunition")
        if (!r.material) {
          setPackError(r.error ?? "Munição não encontrada no cadastro.")
          return
        }
        const stockCheck = await validateMaterialQuantityForCautela(r.material.id, aq)
        if (stockCheck.ok === false) {
          setPackError(stockCheck.error)
          return
        }
        ammoMat = r.material
      }

      let next = [...lines]
      if (!next.some((l) => l.material.id === pistolWeapon.id)) {
        next = mergeLines(next, pistolWeapon, 1)
      }
      next = upsertPackChargerLine(next, pistolWeapon, chargerMats, cq)
      if (aq > 0 && ammoMat) {
        next = mergeLines(next, ammoMat, aq, {
          packWeaponId: pistolWeapon.id,
          packWeaponLabel: pistolWeapon.name,
        })
      }
      onLinesChange(next)
    } finally {
      setPackApplying(false)
    }
  }

  const applyLongPack = async () => {
    setPackError(null)
    if (!longWeapon) {
      setPackError("Selecione a arma longa acima.")
      return
    }
    setPackApplying(true)
    try {
      const cq = longChargerQtyRef.current?.commit() ?? longChargerQty
      const aq = longAmmoQtyRef.current?.commit() ?? longAmmoQty

      let chargerMats: SearchableMaterial[] = []
      let ammoMat: SearchableMaterial | null = null

      if (cq > 0) {
        const r = await resolvePackAccessoriesForWeapon(longWeapon.id, "charger", cq)
        if (r.error || r.materials.length < cq) {
          setPackError(r.error ?? "Carregador não encontrado no cadastro.")
          return
        }
        chargerMats = r.materials
      }
      if (aq > 0) {
        const r = await resolvePackAccessoryForWeapon(longWeapon.id, "ammunition")
        if (!r.material) {
          setPackError(r.error ?? "Munição não encontrada no cadastro.")
          return
        }
        const stockCheck = await validateMaterialQuantityForCautela(r.material.id, aq)
        if (stockCheck.ok === false) {
          setPackError(stockCheck.error)
          return
        }
        ammoMat = r.material
      }

      let next = [...lines]
      if (!next.some((l) => l.material.id === longWeapon.id)) {
        next = mergeLines(next, longWeapon, 1)
      }
      next = upsertPackChargerLine(next, longWeapon, chargerMats, cq)
      if (aq > 0 && ammoMat) {
        next = mergeLines(next, ammoMat, aq, {
          packWeaponId: longWeapon.id,
          packWeaponLabel: longWeapon.name,
        })
      }
      onLinesChange(next)
    } finally {
      setPackApplying(false)
    }
  }

  const addOrMerge = (m: SearchableMaterial, qty: number) => {
    onLinesChange(mergeLines(lines, m, qty))
  }

  const addWithFeedback = (m: SearchableMaterial, qty: number) => {
    addOrMerge(m, qty)
    setPackError(null)
    setAddedToast(`${m.name} incluído no resumo`)
    setTimeout(() => setAddedToast(null), 3500)
  }

  const includeWeaponOnly = (weapon: SearchableMaterial) => {
    if (!lines.some((l) => l.material.id === weapon.id)) {
      addWithFeedback(weapon, 1)
    }
  }

  const removeRow = (rowId: string) => {
    onLinesChange(lines.filter((l) => l.rowId !== rowId))
  }

  const setQty = async (rowId: string, q: number) => {
    const n = Math.max(1, Math.min(99999, Math.floor(q)))
    const row = lines.find((l) => l.rowId === rowId)
    if (!row) return

    if (row.poolMaterialIds?.length && row.packWeaponId) {
      if (n === row.quantity && row.poolMaterialIds.length === n) return
      setPackApplying(true)
      try {
        const r = await resolvePackAccessoriesForWeapon(row.packWeaponId, "charger", n)
        if (r.error || r.materials.length < n) {
          setPackError(r.error ?? "Carregador não encontrado no cadastro.")
          return
        }
        onLinesChange(
          lines.map((l) =>
            l.rowId === rowId
              ? {
                  ...l,
                  quantity: n,
                  poolMaterialIds: r.materials.map((m) => m.id),
                  material: normalizeWizardMaterial(r.materials[0]),
                }
              : l
          )
        )
        setPackError(null)
      } finally {
        setPackApplying(false)
      }
      return
    }

    const stockCheck = await validateMaterialQuantityForCautela(row.material.id, n)
    if (stockCheck.ok === false) {
      setPackError(stockCheck.error)
      return
    }
    onLinesChange(lines.map((l) => (l.rowId === rowId ? { ...l, quantity: n } : l)))
    setPackError(null)
  }

  const applyTaserAmmoPack = () => {
    setPackError(null)
    const tq = taserAmmoQtyRef.current?.commit() ?? taserAmmoQty
    if (tq <= 0) {
      setPackError("Informe quantidade de munição Taser maior que zero ou ignore.")
      return
    }
    if (!taserAmmoMat) {
      setPackError("Selecione o cartucho / munição Taser no cadastro.")
      return
    }
    onLinesChange(mergeLines(lines, taserAmmoMat, tq))
  }

  const handleTransferPatSearch = async () => {
    const pat = transferPat.trim()
    if (!pat) return
    setTransferLoading(true)
    setTransferError(null)
    setPermanentBlockMsg(null)
    setTransferOrigin(null)
    try {
      const rows = await searchMaterials(pat)
      if (rows.length === 0) {
        setTransferError("Nenhum material encontrado com esse patrimônio.")
        return
      }
      const mat = rows[0]
      const result = await getDailyCautelaForMaterial(mat.id)
      if (result.error) {
        setTransferError(result.error)
        return
      }
      if (result.permanentBlock) {
        setPermanentBlockMsg("Este material está em cautela Permanente. Transferência não permitida para cautelas Diárias.")
        return
      }
      if (!result.origin) {
        setTransferError("Este material não está em uma cautela Diária ativa de outra pessoa.")
        return
      }
      const alreadyAdded = lines.find((l) => l.material.id === mat.id)
      if (alreadyAdded) {
        setTransferError("Este material já está na lista desta cautela.")
        return
      }
      setTransferOrigin({
        cautela_id: result.origin.cautela_id,
        person_id: result.origin.person_id,
        person_name: result.origin.person_name,
        items: result.origin.items.map((item) => ({
          ...item,
          checked: item.material_id === mat.id,
          transferQty: item.quantity_available,
        })),
      })
    } catch {
      setTransferError("Erro ao buscar dados do material.")
    } finally {
      setTransferLoading(false)
    }
  }

  const toggleTransferItem = (idx: number) => {
    if (!transferOrigin) return
    const items = [...transferOrigin.items]
    items[idx] = { ...items[idx], checked: !items[idx].checked }
    if (items[idx].checked) {
      items[idx].transferQty = items[idx].quantity_available
    }
    setTransferOrigin({ ...transferOrigin, items })
  }

  const updateTransferQty = (idx: number, qty: number) => {
    if (!transferOrigin) return
    const items = [...transferOrigin.items]
    const max = items[idx].quantity_available
    items[idx] = { ...items[idx], transferQty: Math.max(1, Math.min(qty, max)) }
    setTransferOrigin({ ...transferOrigin, items })
  }

  const confirmTransferItems = () => {
    if (!transferOrigin) return
    const selected = transferOrigin.items.filter((i) => i.checked)
    if (selected.length === 0) {
      setTransferError("Selecione pelo menos um item para transferir.")
      return
    }
    const duplicateInList = selected.find((s) =>
      lines.some((l) => l.material.id === s.material_id)
    )
    if (duplicateInList) {
      setTransferError(`${duplicateInList.material_name} já está na lista desta cautela.`)
      return
    }
    const newLines: MaterialLine[] = selected.map((item) => ({
      rowId: crypto.randomUUID(),
      material: {
        id: item.material_id,
        name: item.material_name,
        patrimony_number: item.patrimony_number,
        serial_number: null,
        internal_code: "",
        category: item.category,
        stock_quantity: undefined,
      },
      quantity: item.transferQty,
      transferFromCautelaItemId: item.cautela_item_id,
      transferFromPersonName: transferOrigin.person_name,
      transferFromCautelaId: transferOrigin.cautela_id,
    }))
    onLinesChange([...lines, ...newLines])
    setTransferOrigin(null)
    setTransferPat("")
    setTransferError(null)
    setAddedToast(`${selected.length} item(ns) transferido(s) de ${transferOrigin.person_name}`)
    setTimeout(() => setAddedToast(null), 3500)
  }

  const cancelTransfer = () => {
    setTransferOrigin(null)
    setTransferPat("")
    setTransferError(null)
    setPermanentBlockMsg(null)
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-white">Materiais</h3>
        <p className="text-slate-400 text-sm">
          Use cada bloco abaixo para incluir materiais. Colete, HT, celular e impressora entram ao <strong className="text-slate-300">clicar no resultado da busca</strong>.
          Pistola e arma longa: pacote completo ou só a arma.
        </p>
      </div>

      <CautelaLinesSummary
        lines={lines}
        onQtyChange={(rowId, qty) => void setQty(rowId, qty)}
        onRemove={removeRow}
      />

      {addedToast && (
        <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">
          {addedToast}
        </p>
      )}

      {distinctCategoryNames.length === 0 && (
        <p className="text-[10px] text-amber-400/90 text-center">
          Carregando categorias… Se não houver categorias com nomes reconhecidos (ex.: Pistola, Carregador), os filtros podem ficar vazios.
        </p>
      )}

      {packError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{packError}</div>
      )}

      {permanentBlockMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-red-400">{permanentBlockMsg}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
        <SectionTitle>Transferência de Cautela Diária</SectionTitle>
        <p className="text-[10px] text-slate-500">
          Se o material está em posse de outra pessoa (cautela Diária ativa), digite o PAT para detectar e transferir diretamente.
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              data-testid="transfer-search-input"
              value={transferPat}
              onChange={(e) => { setTransferPat(e.target.value); setTransferError(null); setPermanentBlockMsg(null) }}
              placeholder="Digitar PAT do material em cautela..."
              className="w-full pl-3 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              disabled={transferLoading}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleTransferPatSearch()}
            disabled={transferLoading || !transferPat.trim()}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2"
          >
            {transferLoading ? <span className="animate-spin">⟳</span> : <ArrowRightLeft className="h-4 w-4" />}
            Buscar
          </button>
        </div>

        {transferError && (
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
            {transferError}
          </div>
        )}

        {transferOrigin && (
          <div className="p-3 bg-slate-900 border border-amber-500/30 rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-400">
                  Material em cautela Diária com {transferOrigin.person_name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Selecione os itens para transferir. Itens marcados serão movidos da cautela de {transferOrigin.person_name} para esta.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              {transferOrigin.items.map((item, idx) => (
                <div
                  key={item.cautela_item_id}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    item.checked ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-950/50 border-slate-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleTransferItem(idx)}
                    className="h-4 w-4 rounded accent-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{item.material_name}</p>
                    <p className="text-[10px] text-slate-400">
                      Pat: {item.patrimony_number} • Disponível: {item.quantity_available}
                    </p>
                  </div>
                  {item.checked && item.quantity_available > 1 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] text-slate-500">Qtd:</span>
                      <input
                        type="number"
                        min={1}
                        max={item.quantity_available}
                        value={item.transferQty}
                        onChange={(e) => updateTransferQty(idx, parseInt(e.target.value) || 1)}
                        className="w-14 py-0.5 px-1 bg-slate-900 border border-slate-700 rounded text-xs text-white text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmTransferItems}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-bold text-white"
              >
                <Check className="h-4 w-4" />
                Confirmar Transferência
              </button>
              <button
                type="button"
                onClick={cancelTransfer}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-sm font-bold text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6 max-h-[min(52vh,520px)] overflow-y-auto pr-1">
        <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
          <SectionTitle>Pistola</SectionTitle>
          <MaterialSearchField
            label="Identificação da arma"
            categoryNames={opt(pistolWeaponCategoryNames)}
            onSelect={(m) => {
              setPistolWeapon(m)
              setPackError(null)
            }}
            placeholder="Patrimônio, serial, código — só pistolas"
          />
          {pistolWeapon && (
            <p className="text-[10px] text-slate-500">
              Selecionada: <span className="text-red-400 font-medium">{pistolWeapon.name}</span> • Pat {pistolWeapon.patrimony_number}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd carregadores</label>
              <PackQtyInput
                ref={pistolChargerQtyRef}
                value={chargerQty}
                onChange={setChargerQty}
                max={99}
                className={inputNoSpinner}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd projéteis (munição)</label>
              <PackQtyInput
                ref={pistolAmmoQtyRef}
                value={ammoQty}
                onChange={setAmmoQty}
                max={9999}
                className={inputNoSpinner}
              />
            </div>
          </div>

          {(chargerQty > 0 || ammoQty > 0) && (
            <p className="text-[10px] text-slate-500">
              Carregador e munição serão vinculados automaticamente ao calibre/modelo da arma selecionada.
            </p>
          )}

          {pistolWeapon && (
            <button
              type="button"
              onClick={() => includeWeaponOnly(pistolWeapon)}
              className="w-full py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Incluir só a pistola (sem carregador/munição)
            </button>
          )}
          <button
            type="button"
            disabled={packApplying}
            onClick={() => void applyPistolPack()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 disabled:opacity-50 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            {packApplying ? "Incluindo pacote…" : "Adicionar pacote pistola à cautela"}
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
          <SectionTitle>Arma longa</SectionTitle>
          <MaterialSearchField
            label="Identificação da arma longa"
            categoryNames={opt(longWeaponCategoryNames)}
            onSelect={(m) => {
              setLongWeapon(m)
              setPackError(null)
            }}
            placeholder="Fuzil, carabina…"
          />
          {longWeapon && (
            <p className="text-[10px] text-slate-500">
              Selecionada: <span className="text-red-400 font-medium">{longWeapon.name}</span>
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd carregadores</label>
              <PackQtyInput
                ref={longChargerQtyRef}
                value={longChargerQty}
                onChange={setLongChargerQty}
                max={99}
                className={inputNoSpinner}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd projéteis</label>
              <PackQtyInput
                ref={longAmmoQtyRef}
                value={longAmmoQty}
                onChange={setLongAmmoQty}
                max={9999}
                className={inputNoSpinner}
              />
            </div>
          </div>

          {(longChargerQty > 0 || longAmmoQty > 0) && (
            <p className="text-[10px] text-slate-500">
              Carregadores e munição limitados ao calibre e à marca da arma selecionada.
            </p>
          )}

          {longWeapon && (
            <button
              type="button"
              onClick={() => includeWeaponOnly(longWeapon)}
              className="w-full py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Incluir só a arma longa (sem acessórios)
            </button>
          )}

          <button
            type="button"
            disabled={packApplying}
            onClick={() => void applyLongPack()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 disabled:opacity-50 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            {packApplying ? "Incluindo pacote…" : "Adicionar pacote arma longa à cautela"}
          </button>
        </div>

        <div>
          <SectionTitle>Colete / placa</SectionTitle>
          <p className="text-[10px] text-slate-500 mb-2">Busque por patrimônio ou código e clique no item — entra no resumo acima.</p>
          <MaterialSearchField
            label="Buscar colete ou placa"
            categoryNames={opt(vestCategoryNames)}
            onSelect={(m) => addWithFeedback(m, 1)}
            placeholder="Tamanho, código…"
          />
        </div>

        <div>
          <SectionTitle>HT (rádio)</SectionTitle>
          <p className="text-[10px] text-slate-500 mb-2">Busque e clique no HT — entra no resumo acima.</p>
          <MaterialSearchField
            label="Buscar HT"
            categoryNames={opt(radioCategoryNames)}
            onSelect={(m) => addWithFeedback(m, 1)}
            placeholder="Código do rádio"
          />
        </div>

        <div>
          <SectionTitle>Bornal</SectionTitle>
          <p className="text-[10px] text-slate-500 mb-2">
            Não é patrimônio: fica registrado nas observações da cautela (passo Resumo).
          </p>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="bornal"
                checked={bornal === "yes"}
                onChange={() => onBornalChange("yes")}
                className="accent-blue-500"
              />
              Sim
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="bornal"
                checked={bornal === "no"}
                onChange={() => onBornalChange("no")}
                className="accent-blue-500"
              />
              Não
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
          <SectionTitle>Taser</SectionTitle>
          <MaterialSearchField
            label="Equipamento Taser"
            categoryNames={opt(taserEqCategoryNames)}
            onSelect={(m) => addWithFeedback(m, 1)}
            placeholder="Somente equipamento Taser"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd munição Taser</label>
              <PackQtyInput
                ref={taserAmmoQtyRef}
                value={taserAmmoQty}
                onChange={setTaserAmmoQty}
                max={99}
                className={inputNoSpinner}
              />
            </div>
          </div>
          {taserAmmoQty > 0 && (
            <>
              <MaterialSearchField
                label="Cartucho / munição Taser (cadastro)"
                categoryNames={opt(
                  taserAmmoCategoryNames.length > 0 ? taserAmmoCategoryNames : taserEqCategoryNames
                )}
                onSelect={(m) => {
                  setTaserAmmoMat(m)
                  setPackError(null)
                }}
                placeholder="Cartucho Taser"
              />
              <button
                type="button"
                onClick={applyTaserAmmoPack}
                className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white"
              >
                Adicionar munição Taser à cautela
              </button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <SectionTitle>Celular</SectionTitle>
            <MaterialSearchField
              label="Identificação do aparelho"
              categoryNames={opt(cellCategoryNames)}
              onSelect={(m) => addWithFeedback(m, 1)}
              placeholder="Somente celular / smartphone"
            />
          </div>
          <div>
            <SectionTitle>Impressora</SectionTitle>
            <MaterialSearchField
              label="Identificação da impressora"
              categoryNames={opt(printerCategoryNames)}
              onSelect={(m) => addWithFeedback(m, 1)}
              placeholder="Somente impressoras"
            />
          </div>
        </div>

        <div>
          <SectionTitle>Outros (texto livre)</SectionTitle>
          <textarea
            value={outros}
            onChange={(e) => onOutrosChange(e.target.value)}
            placeholder="Descreva outros itens ou observações..."
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 resize-none"
          />
        </div>
      </div>

      {selectedWeaponForCaliber && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <Zap className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-400">
              Arma de referência: <strong className="text-white">{selectedWeaponForCaliber.name}</strong>
              {extractCaliber(selectedWeaponForCaliber.category || selectedWeaponForCaliber.name) && (
                <span className="ml-1 text-blue-300">
                  — Calibre:{" "}
                  {extractCaliber(selectedWeaponForCaliber.category || selectedWeaponForCaliber.name)}
                </span>
              )}
            </p>
          </div>

          {caliberIncompatibilities.length > 0 && (
            <div className="p-3 bg-red-500/5 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-red-400">Incompatibilidade de calibre</p>
                  <p className="text-[10px] text-red-300/80 mt-1 space-y-1">
                    {caliberIncompatibilities.map((inc, idx) => (
                      <span key={idx} className="block">
                        • <strong>{inc.materialName}</strong> (calibre {inc.ammoCaliber}) incompatível com{" "}
                        {selectedWeaponForCaliber.name}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {caliberWarnings.length > 0 && (
            <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-yellow-400">Calibre não identificado</p>
                  {caliberWarnings.map((w, idx) => (
                    <p key={idx} className="text-[10px] text-yellow-300/80 mt-0.5">
                      • {w}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {caliberIncompatibilities.length === 0 &&
            caliberWarnings.length === 0 &&
            lines.some((l) => {
              const cat = l.material.category || ""
              return isAmmunitionCategory(cat) || isAmmunitionCategory(l.material.name)
            }) && (
              <div className="flex items-center gap-2 p-2 bg-green-500/5 border border-green-500/20 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <p className="text-xs text-green-400">Munições compatíveis com a arma de referência</p>
              </div>
            )}

          {caliberIncompatibilities.length > 0 && (
            <div className="p-4 bg-red-500/10 border-2 border-red-500/40 rounded-lg space-y-3">
              <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={caliberOverrideConfirmed}
                  onChange={(e) => setCaliberOverrideConfirmed(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-600 bg-slate-800 text-red-500"
                />
                <span className="text-sm text-white">Declaro ciência da incompatibilidade de calibre</span>
              </label>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
