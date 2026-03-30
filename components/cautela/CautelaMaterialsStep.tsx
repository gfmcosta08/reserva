"use client"

import { useMemo, useState, useEffect } from "react"
import { Trash2, ShieldAlert, AlertTriangle, CheckCircle, Zap, ChevronRight } from "lucide-react"
import { MaterialSearchField, normalizeWizardMaterial } from "./MaterialSearchField"
import type { SearchableMaterial } from "@/app/actions/cautelas"
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
  /** Quando o operador pode avançar (itens + calibre ok ou override marcado). */
  onCanProceedChange?: (canProceed: boolean) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 mb-2">
      {children}
    </h4>
  )
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
  const [chargerQty, setChargerQty] = useState(1)
  const [ammoQty, setAmmoQty] = useState(15)
  const [longChargerQty, setLongChargerQty] = useState(1)
  const [longAmmoQty, setLongAmmoQty] = useState(20)
  const [taserAmmoQty, setTaserAmmoQty] = useState(1)

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

  const addOrMerge = (m: SearchableMaterial, qty: number) => {
    const norm = normalizeWizardMaterial(m)
    onLinesChange(
      (() => {
        const i = lines.findIndex((x) => x.material.id === m.id)
        if (i >= 0) {
          const copy = [...lines]
          copy[i] = { ...copy[i], quantity: copy[i].quantity + qty }
          return copy
        }
        return [...lines, { rowId: crypto.randomUUID(), material: norm, quantity: qty }]
      })()
    )
  }

  const removeRow = (rowId: string) => {
    onLinesChange(lines.filter((l) => l.rowId !== rowId))
  }

  const setQty = (rowId: string, q: number) => {
    const n = Math.max(1, Math.min(99999, Math.floor(q)))
    onLinesChange(lines.map((l) => (l.rowId === rowId ? { ...l, quantity: n } : l)))
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-white">Materiais</h3>
        <p className="text-slate-400 text-sm">
          Digite patrimônio, serial ou código para buscar. Ajuste quantidades nas linhas.
        </p>
      </div>

      <div className="space-y-4 max-h-[min(52vh,480px)] overflow-y-auto pr-1">
        <div>
          <SectionTitle>Pistola — arma</SectionTitle>
          <MaterialSearchField
            label="Identificação da arma"
            onSelect={(m) => addOrMerge(m, 1)}
            placeholder="Patrimônio, serial, código interno ou nome..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd carregadores</label>
            <input
              type="number"
              min={1}
              max={99}
              value={chargerQty}
              onChange={(e) => setChargerQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="mt-1 w-full py-2 px-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
            />
          </div>
          <div>
            <MaterialSearchField
              label="Carregador (buscar e adicionar)"
              onSelect={(m) => addOrMerge(m, chargerQty)}
              placeholder="Buscar carregador..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd projéteis (munição)</label>
            <input
              type="number"
              min={1}
              max={9999}
              value={ammoQty}
              onChange={(e) => setAmmoQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="mt-1 w-full py-2 px-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
            />
          </div>
          <div>
            <MaterialSearchField
              label="Identificação da munição (cadastro)"
              onSelect={(m) => addOrMerge(m, ammoQty)}
              placeholder="Número / lote no sistema..."
            />
          </div>
        </div>

        <div>
          <SectionTitle>Arma longa</SectionTitle>
          <MaterialSearchField
            label="Identificação da arma longa"
            onSelect={(m) => addOrMerge(m, 1)}
            placeholder="Patrimônio, serial, código..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd carregadores</label>
            <input
              type="number"
              min={1}
              max={99}
              value={longChargerQty}
              onChange={(e) => setLongChargerQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="mt-1 w-full py-2 px-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
            />
          </div>
          <div>
            <MaterialSearchField
              label="Carregador (arma longa)"
              onSelect={(m) => addOrMerge(m, longChargerQty)}
              placeholder="Buscar carregador..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd projéteis</label>
            <input
              type="number"
              min={1}
              max={9999}
              value={longAmmoQty}
              onChange={(e) => setLongAmmoQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="mt-1 w-full py-2 px-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
            />
          </div>
          <div>
            <MaterialSearchField
              label="Identificação da munição (cadastro)"
              onSelect={(m) => addOrMerge(m, longAmmoQty)}
              placeholder="Número / lote no sistema..."
            />
          </div>
        </div>

        <div>
          <SectionTitle>Colete / placa</SectionTitle>
          <MaterialSearchField label="Buscar colete" onSelect={(m) => addOrMerge(m, 1)} placeholder="Tamanho, código..." />
        </div>

        <div>
          <SectionTitle>HT (rádio)</SectionTitle>
          <MaterialSearchField label="Buscar HT" onSelect={(m) => addOrMerge(m, 1)} />
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

        <div>
          <SectionTitle>Taser</SectionTitle>
          <MaterialSearchField label="Equipamento Taser" onSelect={(m) => addOrMerge(m, 1)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd munição Taser</label>
              <input
                type="number"
                min={1}
                max={99}
                value={taserAmmoQty}
                onChange={(e) => setTaserAmmoQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="mt-1 w-full py-2 px-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
              />
            </div>
            <div>
              <MaterialSearchField
                label="Cartucho / munição Taser (cadastro)"
                onSelect={(m) => addOrMerge(m, taserAmmoQty)}
                placeholder="Opcional — se houver no estoque"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <SectionTitle>Celular</SectionTitle>
            <MaterialSearchField label="Identificação do aparelho" onSelect={(m) => addOrMerge(m, 1)} />
          </div>
          <div>
            <SectionTitle>Impressora</SectionTitle>
            <MaterialSearchField label="Identificação da impressora" onSelect={(m) => addOrMerge(m, 1)} />
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
            Itens ({lines.length} linha(s))
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {lines.map((row) => (
              <div key={row.rowId} className="flex items-center gap-2 text-xs bg-slate-950/80 rounded-lg px-2 py-1.5 border border-slate-800">
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
                  className="w-16 py-1 px-1 bg-slate-900 border border-slate-700 rounded text-right text-white text-xs"
                />
                <button type="button" onClick={() => removeRow(row.rowId)} className="text-red-400 hover:text-red-300 p-1">
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
