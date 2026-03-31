"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { Trash2, ShieldAlert, AlertTriangle, CheckCircle, Zap, Plus } from "lucide-react"
import { MaterialSearchField, normalizeWizardMaterial } from "./MaterialSearchField"
import type { SearchableMaterial } from "@/app/actions/cautelas"
import { getCategories } from "@/app/actions/categories"
import {
  resolveCategoryIdsForGroup,
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
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    getCategories()
      .then((rows) => setCategories(rows ?? []))
      .catch(() => setCategories([]))
  }, [])

  const cat = useCallback(
    (g: CautelaMaterialGroup) => resolveCategoryIdsForGroup(categories, g),
    [categories]
  )

  const pistolWeaponIds = useMemo(() => cat("pistol_weapon"), [cat])
  const longWeaponIds = useMemo(() => cat("long_weapon"), [cat])
  const chargerIds = useMemo(() => cat("charger"), [cat])
  const ammoIds = useMemo(() => cat("ammunition"), [cat])
  const vestIds = useMemo(() => cat("vest_plate"), [cat])
  const radioIds = useMemo(() => cat("radio_ht"), [cat])
  const taserEqIds = useMemo(() => cat("taser_equipment"), [cat])
  const taserAmmoIds = useMemo(() => cat("taser_ammo"), [cat])
  const cellIds = useMemo(() => cat("cellphone"), [cat])
  const printerIds = useMemo(() => cat("printer"), [cat])

  /** Se não houver categoria mapeada, busca sem filtro (evita tela vazia). */
  const opt = (ids: string[]) => (ids.length > 0 ? ids : undefined)

  const [pistolWeapon, setPistolWeapon] = useState<SearchableMaterial | null>(null)
  const [chargerQty, setChargerQty] = useState(0)
  const [ammoQty, setAmmoQty] = useState(0)
  const [pistolChargerMat, setPistolChargerMat] = useState<SearchableMaterial | null>(null)
  const [pistolAmmoMat, setPistolAmmoMat] = useState<SearchableMaterial | null>(null)

  const [longWeapon, setLongWeapon] = useState<SearchableMaterial | null>(null)
  const [longChargerQty, setLongChargerQty] = useState(0)
  const [longAmmoQty, setLongAmmoQty] = useState(0)
  const [longChargerMat, setLongChargerMat] = useState<SearchableMaterial | null>(null)
  const [longAmmoMat, setLongAmmoMat] = useState<SearchableMaterial | null>(null)

  const [taserAmmoQty, setTaserAmmoQty] = useState(0)
  const [taserAmmoMat, setTaserAmmoMat] = useState<SearchableMaterial | null>(null)

  const [packError, setPackError] = useState<string | null>(null)

  const [caliberIncompatibilities, setCaliberIncompatibilities] = useState<CaliberMismatch[]>([])
  const [caliberWarnings, setCaliberWarnings] = useState<string[]>([])
  const [selectedWeaponForCaliber, setSelectedWeaponForCaliber] = useState<WizardMaterial | null>(null)
  const [caliberOverrideConfirmed, setCaliberOverrideConfirmed] = useState(false)

  const selectedAsMaterialLike = useMemo(
    () =>
      lines.map((l) => ({
        id: l.material.id,
        name: l.material.name,
        categories: l.material.categories,
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

  const applyPistolPack = () => {
    setPackError(null)
    if (!pistolWeapon) {
      setPackError("Selecione a arma (pistola) acima.")
      return
    }
    if (chargerQty > 0 && !pistolChargerMat) {
      setPackError("Com quantidade de carregadores maior que zero, selecione o modelo do carregador no cadastro.")
      return
    }
    if (ammoQty > 0 && !pistolAmmoMat) {
      setPackError("Com quantidade de projéteis maior que zero, selecione a munição no cadastro.")
      return
    }
    let next = [...lines]
    next = mergeLines(next, pistolWeapon, 1)
    if (chargerQty > 0 && pistolChargerMat) next = mergeLines(next, pistolChargerMat, chargerQty)
    if (ammoQty > 0 && pistolAmmoMat) next = mergeLines(next, pistolAmmoMat, ammoQty)
    onLinesChange(next)
  }

  const applyLongPack = () => {
    setPackError(null)
    if (!longWeapon) {
      setPackError("Selecione a arma longa acima.")
      return
    }
    if (longChargerQty > 0 && !longChargerMat) {
      setPackError("Com carregadores > 0, selecione o modelo do carregador.")
      return
    }
    if (longAmmoQty > 0 && !longAmmoMat) {
      setPackError("Com projéteis > 0, selecione a munição no cadastro.")
      return
    }
    let next = [...lines]
    next = mergeLines(next, longWeapon, 1)
    if (longChargerQty > 0 && longChargerMat) next = mergeLines(next, longChargerMat, longChargerQty)
    if (longAmmoQty > 0 && longAmmoMat) next = mergeLines(next, longAmmoMat, longAmmoQty)
    onLinesChange(next)
  }

  const addOrMerge = (m: SearchableMaterial, qty: number) => {
    onLinesChange(mergeLines(lines, m, qty))
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
    if (taserAmmoQty <= 0) {
      setPackError("Informe quantidade de munição Taser maior que zero ou ignore.")
      return
    }
    if (!taserAmmoMat) {
      setPackError("Selecione o cartucho / munição Taser no cadastro.")
      return
    }
    onLinesChange(mergeLines(lines, taserAmmoMat, taserAmmoQty))
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-white">Materiais</h3>
        <p className="text-slate-400 text-sm">
          Cada bloco filtra a busca pela categoria. Em pistola/arma longa, use &quot;Adicionar pacote&quot; para incluir arma + carregadores + munição.
        </p>
      </div>

      {categories.length === 0 && (
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
            categoryIds={opt(pistolWeaponIds)}
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
              <input
                type="number"
                min={0}
                max={99}
                value={chargerQty}
                onChange={(e) => setChargerQty(Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))}
                className={inputNoSpinner}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd projéteis (munição)</label>
              <input
                type="number"
                min={0}
                max={9999}
                value={ammoQty}
                onChange={(e) => setAmmoQty(Math.max(0, Math.min(9999, parseInt(e.target.value, 10) || 0)))}
                className={inputNoSpinner}
              />
            </div>
          </div>

          {chargerQty > 0 && (
            <MaterialSearchField
              label="Modelo do carregador (cadastro)"
              categoryIds={opt(chargerIds)}
              onSelect={(m) => {
                setPistolChargerMat(m)
                setPackError(null)
              }}
              placeholder="Buscar só carregadores/pentes"
            />
          )}

          {ammoQty > 0 && (
            <MaterialSearchField
              label="Munição (cadastro)"
              categoryIds={opt(ammoIds)}
              onSelect={(m) => {
                setPistolAmmoMat(m)
                setPackError(null)
              }}
              placeholder="Lote / tipo de munição"
            />
          )}

          <button
            type="button"
            onClick={applyPistolPack}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Adicionar pacote pistola à cautela
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
          <SectionTitle>Arma longa</SectionTitle>
          <MaterialSearchField
            label="Identificação da arma longa"
            categoryIds={opt(longWeaponIds)}
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
              <input
                type="number"
                min={0}
                max={99}
                value={longChargerQty}
                onChange={(e) =>
                  setLongChargerQty(Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))
                }
                className={inputNoSpinner}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd projéteis</label>
              <input
                type="number"
                min={0}
                max={9999}
                value={longAmmoQty}
                onChange={(e) =>
                  setLongAmmoQty(Math.max(0, Math.min(9999, parseInt(e.target.value, 10) || 0)))
                }
                className={inputNoSpinner}
              />
            </div>
          </div>

          {longChargerQty > 0 && (
            <MaterialSearchField
              label="Modelo do carregador (cadastro)"
              categoryIds={opt(chargerIds)}
              onSelect={(m) => {
                setLongChargerMat(m)
                setPackError(null)
              }}
              placeholder="Carregador compatível"
            />
          )}

          {longAmmoQty > 0 && (
            <MaterialSearchField
              label="Munição (cadastro)"
              categoryIds={opt(ammoIds)}
              onSelect={(m) => {
                setLongAmmoMat(m)
                setPackError(null)
              }}
              placeholder="Tipo de munição"
            />
          )}

          <button
            type="button"
            onClick={applyLongPack}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Adicionar pacote arma longa à cautela
          </button>
        </div>

        <div>
          <SectionTitle>Colete / placa</SectionTitle>
          <MaterialSearchField
            label="Buscar colete ou placa"
            categoryIds={opt(vestIds)}
            onSelect={(m) => addOrMerge(m, 1)}
            placeholder="Tamanho, código…"
          />
        </div>

        <div>
          <SectionTitle>HT (rádio)</SectionTitle>
          <MaterialSearchField
            label="Buscar HT"
            categoryIds={opt(radioIds)}
            onSelect={(m) => addOrMerge(m, 1)}
            placeholder="Código do rádio"
          />
        </div>

        <div>
          <SectionTitle>Bornal</SectionTitle>
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
            categoryIds={opt(taserEqIds)}
            onSelect={(m) => addOrMerge(m, 1)}
            placeholder="Somente equipamento Taser"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd munição Taser</label>
              <input
                type="number"
                min={0}
                max={99}
                value={taserAmmoQty}
                onChange={(e) =>
                  setTaserAmmoQty(Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))
                }
                className={inputNoSpinner}
              />
            </div>
          </div>
          {taserAmmoQty > 0 && (
            <>
              <MaterialSearchField
                label="Cartucho / munição Taser (cadastro)"
                categoryIds={opt(taserAmmoIds.length > 0 ? taserAmmoIds : taserEqIds)}
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
              categoryIds={opt(cellIds)}
              onSelect={(m) => addOrMerge(m, 1)}
              placeholder="Somente celular / smartphone"
            />
          </div>
          <div>
            <SectionTitle>Impressora</SectionTitle>
            <MaterialSearchField
              label="Identificação da impressora"
              categoryIds={opt(printerIds)}
              onSelect={(m) => addOrMerge(m, 1)}
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
              {extractCaliber(selectedWeaponForCaliber.categories?.[0]?.name || selectedWeaponForCaliber.name) && (
                <span className="ml-1 text-blue-300">
                  — Calibre:{" "}
                  {extractCaliber(selectedWeaponForCaliber.categories?.[0]?.name || selectedWeaponForCaliber.name)}
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
              const cat = l.material.categories?.[0]?.name || ""
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

      {lines.length > 0 && (
        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-2">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
            Itens na cautela ({lines.length} linha(s))
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {lines.map((row) => (
              <div
                key={row.rowId}
                className="flex items-center gap-2 text-xs bg-slate-950/80 rounded-lg px-2 py-1.5 border border-slate-800"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-slate-200 truncate block">{row.material.name}</span>
                  <span className="text-[10px] text-slate-500">Pat {row.material.patrimony_number}</span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={99999}
                  value={row.quantity}
                  onChange={(e) => setQty(row.rowId, parseInt(e.target.value, 10) || 1)}
                  className={`w-16 py-1 px-1 bg-slate-900 border border-slate-700 rounded text-right text-white text-xs ${inputNoSpinner}`}
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.rowId)}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
