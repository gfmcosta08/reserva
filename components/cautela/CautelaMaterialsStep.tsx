"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { ShieldAlert, AlertTriangle, CheckCircle, Zap, Plus } from "lucide-react"
import { MaterialSearchField, normalizeWizardMaterial } from "./MaterialSearchField"
import { PackQtyInput, type PackQtyInputHandle } from "./PackQtyInput"
import { CautelaLinesSummary } from "./CautelaLinesSummary"
import { resolvePackAccessoryForWeapon, type SearchableMaterial } from "@/app/actions/cautelas"
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

function mergeLines(
  prev: MaterialLine[],
  m: SearchableMaterial,
  qty: number
): MaterialLine[] {
  const norm = normalizeWizardMaterial(m)
  const i = prev.findIndex((x) => x.material.id === m.id)
  if (i >= 0) {
    return prev.map((row, idx) =>
      idx === i ? { ...row, quantity: row.quantity + qty } : row
    )
  }
  return [...prev, { rowId: crypto.randomUUID(), material: norm, quantity: qty }]
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
  const [chargerQty, setChargerQty] = useState(0)
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

      let chargerMat: SearchableMaterial | null = null
      let ammoMat: SearchableMaterial | null = null

      if (cq > 0) {
        const r = await resolvePackAccessoryForWeapon(pistolWeapon.id, "charger")
        if (!r.material) {
          setPackError(r.error ?? "Carregador não encontrado no cadastro.")
          return
        }
        chargerMat = r.material
      }
      if (aq > 0) {
        const r = await resolvePackAccessoryForWeapon(pistolWeapon.id, "ammunition")
        if (!r.material) {
          setPackError(r.error ?? "Munição não encontrada no cadastro.")
          return
        }
        ammoMat = r.material
      }

      let next = [...lines]
      if (!next.some((l) => l.material.id === pistolWeapon.id)) {
        next = mergeLines(next, pistolWeapon, 1)
      }
      if (cq > 0 && chargerMat) next = mergeLines(next, chargerMat, cq)
      if (aq > 0 && ammoMat) next = mergeLines(next, ammoMat, aq)
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

      let chargerMat: SearchableMaterial | null = null
      let ammoMat: SearchableMaterial | null = null

      if (cq > 0) {
        const r = await resolvePackAccessoryForWeapon(longWeapon.id, "charger")
        if (!r.material) {
          setPackError(r.error ?? "Carregador não encontrado no cadastro.")
          return
        }
        chargerMat = r.material
      }
      if (aq > 0) {
        const r = await resolvePackAccessoryForWeapon(longWeapon.id, "ammunition")
        if (!r.material) {
          setPackError(r.error ?? "Munição não encontrada no cadastro.")
          return
        }
        ammoMat = r.material
      }

      let next = [...lines]
      if (!next.some((l) => l.material.id === longWeapon.id)) {
        next = mergeLines(next, longWeapon, 1)
      }
      if (cq > 0 && chargerMat) next = mergeLines(next, chargerMat, cq)
      if (aq > 0 && ammoMat) next = mergeLines(next, ammoMat, aq)
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

  const setQty = (rowId: string, q: number) => {
    const n = Math.max(1, Math.min(99999, Math.floor(q)))
    onLinesChange(lines.map((l) => (l.rowId === rowId ? { ...l, quantity: n } : l)))
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

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-white">Materiais</h3>
        <p className="text-slate-400 text-sm">
          Use cada bloco abaixo para incluir materiais. Colete, HT, celular e impressora entram ao <strong className="text-slate-300">clicar no resultado da busca</strong>.
          Pistola e arma longa: pacote completo ou só a arma.
        </p>
      </div>

      <CautelaLinesSummary lines={lines} onQtyChange={setQty} onRemove={removeRow} />

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
              Selecionada: <span className="text-slate-300">{pistolWeapon.name}</span> • Pat {pistolWeapon.patrimony_number}
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
              Selecionada: <span className="text-slate-300">{longWeapon.name}</span>
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
              Carregador e munição serão vinculados automaticamente ao calibre/modelo da arma selecionada.
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
