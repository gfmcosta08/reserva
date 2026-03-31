"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Loader2 } from "lucide-react"
import { searchMaterials, type SearchableMaterial } from "@/app/actions/cautelas"

type Props = {
  label: string
  placeholder?: string
  onSelect: (m: SearchableMaterial) => void
  disabled?: boolean
  /** Se definido, filtra materiais por `category_id` (UUIDs). Array vazio = nenhum resultado. */
  categoryIds?: string[]
}

export function normalizeWizardMaterial(m: SearchableMaterial) {
  const raw = m as SearchableMaterial & { categories?: { name: string }[] | { name: string } | null }
  let cats: { name: string }[] = []
  if (Array.isArray(raw.categories)) {
    cats = raw.categories
  } else if (raw.categories && typeof raw.categories === "object" && "name" in raw.categories) {
    cats = [{ name: (raw.categories as { name: string }).name }]
  }
  return {
    ...m,
    patrimony_number: m.patrimony_number ?? "",
    internal_code: m.internal_code ?? "",
    categories: cats,
  }
}

export function MaterialSearchField({
  label,
  placeholder = "Digite patrimônio, serial, código ou nome...",
  onSelect,
  disabled,
  categoryIds,
}: Props) {
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchableMaterial[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  useEffect(() => {
    if (q.trim().length < 1) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      setLoading(true)
      searchMaterials(q.trim(), { categoryIds })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 280)
    return () => clearTimeout(t)
  }, [q, categoryIds])

  const pick = (m: SearchableMaterial) => {
    onSelect(m)
    setQ("")
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="space-y-1.5 relative">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
        <input
          type="text"
          value={q}
          disabled={disabled}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-500 animate-spin" />}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-0.5 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => pick(m)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 border-b border-slate-800/50 last:border-0"
              >
                <span className="text-white font-medium">{m.name}</span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Pat {m.patrimony_number} • Cód {m.internal_code}
                  {m.serial_number ? ` • SN ${m.serial_number}` : ""}
                </span>
                {(Array.isArray(m.categories) ? m.categories[0]?.name : m.categories?.name) && (
                  <span className="text-[9px] text-slate-600">
                    {Array.isArray(m.categories) ? m.categories[0]?.name : m.categories?.name}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && q.trim().length >= 1 && results.length === 0 && (
        <p className="text-[10px] text-slate-500">Nenhum material encontrado.</p>
      )}
    </div>
  )
}
