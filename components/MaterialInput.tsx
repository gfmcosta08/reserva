"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Package, Search, Camera, X, Check, AlertCircle, Loader2 } from "lucide-react"
import BarcodeScanner from "./BarcodeScanner"

interface Material {
  id: string
  name: string
  patrimony_number: string | null
  internal_code: string | null
  serial_number: string | null
  status: string
  category?: { name: string }
}

interface MaterialInputProps {
  onSelect: (material: Material) => void
  selectedMaterials: Material[]
  availableMaterials: Material[]
  placeholder?: string
  label?: string
}

export default function MaterialInput({
  onSelect,
  selectedMaterials,
  availableMaterials,
  placeholder = "Buscar material por código ou patrimônio...",
  label = "Selecionar Material"
}: MaterialInputProps) {
  const [search, setSearch] = useState("")
  const [showScanner, setShowScanner] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filtrar materiais disponíveis baseado na busca
  const filteredMaterials = availableMaterials.filter(m => {
    if (selectedMaterials.some(s => s.id === m.id)) return false

    const searchLower = search.toLowerCase()
    return (
      m.name.toLowerCase().includes(searchLower) ||
      m.patrimony_number?.toLowerCase().includes(searchLower) ||
      m.internal_code?.toLowerCase().includes(searchLower) ||
      m.serial_number?.toLowerCase().includes(searchLower)
    )
  })

  // Detectar quando código escaneado corresponde a um material
  const handleScan = useCallback((code: string) => {
    setShowScanner(false)
    setError(null)

    // Buscar material pelo código escaneado
    const found = availableMaterials.find(m =>
      !selectedMaterials.some(s => s.id === m.id) &&
      (m.patrimony_number === code ||
       m.internal_code === code ||
       m.serial_number === code)
    )

    if (found) {
      onSelect(found)
      setSearch("")
      setShowDropdown(false)
    } else {
      setError(`Material com código "${code}" não encontrado ou já selecionado`)
      setSearch(code)
      setShowDropdown(true)
    }
  }, [availableMaterials, selectedMaterials, onSelect])

  // Selecionar material da lista
  const handleSelect = (material: Material) => {
    onSelect(material)
    setSearch("")
    setShowDropdown(false)
    setError(null)
  }

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold text-slate-300">
        {label}
      </label>

      {/* Input Container */}
      <div className="relative">
        <div className="flex gap-2">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setShowDropdown(true)
                setError(null)
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={placeholder}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Scanner Button */}
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
            title="Escanear código de barras"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Scanner</span>
          </button>
        </div>

        {/* Dropdown de resultados */}
        {showDropdown && (search || filteredMaterials.length > 0) && (
          <div
            ref={dropdownRef}
            className="absolute z-20 top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto"
          >
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : filteredMaterials.length > 0 ? (
              <div className="divide-y divide-slate-700/50">
                {filteredMaterials.slice(0, 10).map((material) => (
                  <button
                    key={material.id}
                    onClick={() => handleSelect(material)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
                      <Package className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {material.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        Patrimônio: {material.patrimony_number || "N/A"} | Código: {material.internal_code || "N/A"}
                      </p>
                    </div>
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  </button>
                ))}
                {filteredMaterials.length > 10 && (
                  <div className="p-3 text-center text-xs text-slate-500">
                    Mostrando 10 de {filteredMaterials.length} materiais
                  </div>
                )}
              </div>
            ) : search ? (
              <div className="p-4 text-center">
                <p className="text-sm text-slate-400">
                  Nenhum material encontrado para "{search}"
                </p>
                <button
                  onClick={() => setShowScanner(true)}
                  className="mt-2 text-sm text-blue-400 hover:text-blue-300"
                >
                  Escaneie o código de barras
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          title="Escanear Código do Material"
        />
      )}

      {/* Materiais Selecionados */}
      {selectedMaterials.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {selectedMaterials.length} material(is) selecionado(s)
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedMaterials.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2"
              >
                <Package className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-white">{m.name}</span>
                <span className="text-xs text-slate-400">
                  ({m.patrimony_number || m.internal_code || "N/A"})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
