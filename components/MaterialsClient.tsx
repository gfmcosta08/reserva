"use client"

import { useState } from "react"
import { Package, Plus, Search, Filter, Edit2, Download, Upload, QrCode } from "lucide-react"
import * as XLSX from "xlsx"
import MaterialForm from "./MaterialForm"
import QRCodeModal from "./QRCodeModal"
import { useRouter, useSearchParams } from "next/navigation"
import { importMaterialsTable } from "@/app/actions/materials"

type FilterOption = {
  value: string
  label: string
}

const TEMPLATE_COLUMNS = [
  "name",
  "patrimony_number",
  "internal_code",
  "serial_number",
  "reservation_id",
  "categories",
  "size",
  "model",
  "quantity",
  "color",
  "status",
  "notes",
] as const

const STATUS_OPTIONS: FilterOption[] = [
  { value: "available", label: "Disponivel" },
  { value: "cautelado", label: "Em Uso" },
  { value: "in_use", label: "Em Uso (in_use)" },
  { value: "maintenance", label: "Manutencao" },
  { value: "unavailable", label: "Indisponivel" },
  { value: "blocked", label: "Bloqueado" },
]

const STATUS_LABELS: Record<string, string> = {
  available: "Disponivel",
  cautelado: "Em Uso",
  in_use: "Em Uso",
  maintenance: "Manutencao",
  unavailable: "Indisponivel",
  blocked: "Indisponivel",
}

function getParamValues(searchParams: Pick<URLSearchParams, "getAll">, key: string): string[] {
  const chunks = searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return Array.from(new Set(chunks))
}

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  const content = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  const blob = new Blob([content], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildTemplateWorkbook() {
  const modelRows = [
    {
      name: "Algema Tatica",
      patrimony_number: "PAT-001",
      internal_code: "ALG-01",
      serial_number: "12345",
      reservation_id: "RESERVA-01",
      categories: "Armamento Menos Letal",
      size: "M",
      model: "Tatical 2026",
      quantity: 1,
      color: "Preta",
      status: "available",
      notes: "Opcional",
    },
    {
      name: "Colete Balistico",
      patrimony_number: "PAT-002",
      internal_code: "COL-01",
      serial_number: "",
      reservation_id: "RESERVA-02",
      categories: "Protecao Balistica",
      size: "G",
      model: "N3A",
      quantity: 2,
      color: "Azul Marinho",
      status: "available",
      notes: "Opcional",
    },
  ]

  const instructionsRows = [
    { coluna: "name", obrigatorio: "Sim", descricao: "Nome do equipamento/material." },
    { coluna: "patrimony_number", obrigatorio: "Sim", descricao: "Numero de patrimonio." },
    { coluna: "internal_code", obrigatorio: "Sim", descricao: "Codigo interno/QR unico." },
    { coluna: "serial_number", obrigatorio: "Nao", descricao: "Numero de serie, quando existir." },
    {
      coluna: "reservation_id",
      obrigatorio: "Nao",
      descricao: "Identificacao de local/reserva (armario, sala, base, etc).",
    },
    { coluna: "categories", obrigatorio: "Nao", descricao: "Categoria textual. Padrao: Sem Categoria." },
    { coluna: "size", obrigatorio: "Nao", descricao: "Tamanho do material." },
    { coluna: "model", obrigatorio: "Nao", descricao: "Modelo do material." },
    { coluna: "quantity", obrigatorio: "Nao", descricao: "Quantidade. Padrao: 1." },
    { coluna: "color", obrigatorio: "Nao", descricao: "Cor do material." },
    {
      coluna: "status",
      obrigatorio: "Nao",
      descricao: "available, cautelado/em uso, maintenance, unavailable/bloqueado.",
    },
    { coluna: "notes", obrigatorio: "Nao", descricao: "Observacoes livres." },
  ]

  const workbook = XLSX.utils.book_new()
  const modelSheet = XLSX.utils.json_to_sheet(modelRows, { header: [...TEMPLATE_COLUMNS] })
  const instructionsSheet = XLSX.utils.json_to_sheet(instructionsRows)

  XLSX.utils.book_append_sheet(workbook, modelSheet, "modelo_materiais")
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "instrucoes")

  return workbook
}

function buildExportWorkbook(materials: any[]) {
  const rows = materials.map((material) => ({
    name: material.name || "",
    patrimony_number: material.patrimony_number || "",
    internal_code: material.internal_code || "",
    serial_number: material.serial_number || "",
    reservation_id: material.reservation_id || "",
    categories: material.categories || "Sem Categoria",
    size: material.size || "",
    model: material.model || "",
    quantity: material.quantity ?? 1,
    color: material.color || "",
    status: material.status || "available",
    notes: material.notes || "",
  }))

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...TEMPLATE_COLUMNS] })
  XLSX.utils.book_append_sheet(workbook, worksheet, "materiais_filtrados")

  return workbook
}

export default function MaterialsClient({
  initialMaterials,
  categories,
  materialNames = [],
  locations = [],
}: {
  initialMaterials: any[]
  categories: string[]
  materialNames?: string[]
  locations?: string[]
}) {
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<any>(null)
  const [qrModalMaterial, setQrModalMaterial] = useState<any>(null)
  const [isImporting, setIsImporting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const selectedNames = getParamValues(searchParams, "name")
  const selectedLocations = getParamValues(searchParams, "reservation_id")
  const selectedCategories = getParamValues(searchParams, "categories")
  const selectedStatuses = getParamValues(searchParams, "status")

  const materialOptions = materialNames.map((name) => ({ value: name, label: name }))
  const locationOptions = locations.map((location) => ({ value: location, label: location }))
  const categoryOptions = categories.map((category) => ({ value: category, label: category }))

  const updateParams = (mutator: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString())
    mutator(params)
    const nextQuery = params.toString()
    router.push(nextQuery ? `/materials?${nextQuery}` : "/materials")
  }

  const setFilterValues = (key: string, values: string[]) => {
    updateParams((params) => {
      params.delete(key)
      if (values.length > 0) {
        params.set(key, values.join(","))
      }
    })
  }

  const toggleFilterValue = (key: string, value: string) => {
    const currentValues = getParamValues(searchParams, key)
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((current) => current !== value)
      : [...currentValues, value]

    setFilterValues(key, nextValues)
  }

  const clearFilter = (key: string) => {
    setFilterValues(key, [])
  }

  const handleDownloadTemplate = () => {
    const workbook = buildTemplateWorkbook()
    downloadWorkbook(workbook, "modelo_importacao_materiais.xlsx")
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm(`Deseja importar os materiais do arquivo ${file.name}?`)) {
      e.target.value = ""
      return
    }

    setIsImporting(true)
    try {
      const lowerName = file.name.toLowerCase()
      const isTextTable = lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")

      let workbook: XLSX.WorkBook
      if (isTextTable) {
        const text = await file.text()
        workbook = XLSX.read(text, {
          type: "string",
          raw: false,
          FS: lowerName.endsWith(".tsv") ? "\t" : ",",
        })
      } else {
        const buffer = await file.arrayBuffer()
        workbook = XLSX.read(buffer, { type: "array", raw: false })
      }

      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        alert("Arquivo invalido: nao foi encontrada nenhuma aba.")
        return
      }

      const sheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      })

      const result = await importMaterialsTable(rows)
      if (result.error) {
        alert("Erro na importacao: " + result.error)
        return
      }

      const warnings = result.warnings && result.warnings.length > 0 ? `\nAvisos: ${result.warnings.join(" | ")}` : ""
      const skipped = result.skipped ? `\nLinhas ignoradas: ${result.skipped}` : ""
      alert(`Sucesso! ${result.count ?? 0} materiais importados/atualizados.${skipped}${warnings}`)
      router.refresh()
    } catch (err: any) {
      alert("Erro ao ler arquivo: " + err.message)
    } finally {
      setIsImporting(false)
      e.target.value = ""
    }
  }

  const exportFilteredTable = () => {
    const workbook = buildExportWorkbook(initialMaterials)
    downloadWorkbook(workbook, `materiais_filtrados_${Date.now()}.xlsx`)
  }

  function handleSearch(term: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (term) {
      params.set("search", term)
    } else {
      params.delete("search")
    }
    const nextQuery = params.toString()
    router.push(nextQuery ? `/materials?${nextQuery}` : "/materials")
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Materiais</h1>
          <p className="text-slate-400 mt-1">Gerencie o inventario de armas e equipamentos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xls,.ods,.csv,.tsv"
            id="tableUpload"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isImporting}
          />
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium border border-slate-700 hover:text-white transition-all text-xs"
          >
            <Download className="h-4 w-4" />
            Modelo Tabela
          </button>
          <label
            htmlFor="tableUpload"
            className={`flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium border border-slate-700 hover:text-white transition-all text-xs cursor-pointer ${
              isImporting ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Upload className="h-4 w-4" />
            {isImporting ? "Importando..." : "Importar Tabela"}
          </label>
          <button
            onClick={exportFilteredTable}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600/20 text-emerald-500 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-600/30 transition-all text-xs"
          >
            <Download className="h-4 w-4" />
            Exportar Filtrados
          </button>
          <button
            onClick={() => {
              setEditingMaterial(null)
              setShowMaterialForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/40 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="h-5 w-5" />
            Novo Material
          </button>
        </div>
      </div>

      <div className="flex min-h-14 py-2 items-center flex-wrap gap-4 bg-slate-900/50 border border-slate-800 rounded-2xl px-4 backdrop-blur-sm">
        <div className="flex-1 relative flex items-center min-w-[200px]">
          <Search className="absolute left-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, patrimonio ou codigo..."
            className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-200 pl-10 underline-offset-4"
            defaultValue={searchParams.get("search") || ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="hidden md:block h-6 w-px bg-slate-800" />
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg text-xs font-semibold text-slate-400">
            <Filter className="h-3 w-3" />
            Filtrar
          </div>

          <FilterMenu
            label="Por Material"
            options={materialOptions}
            selectedValues={selectedNames}
            onToggle={(value) => toggleFilterValue("name", value)}
            onClear={() => clearFilter("name")}
          />

          <FilterMenu
            label="Por Localizacao"
            options={locationOptions}
            selectedValues={selectedLocations}
            onToggle={(value) => toggleFilterValue("reservation_id", value)}
            onClear={() => clearFilter("reservation_id")}
          />

          <FilterMenu
            label="Por Categoria"
            options={categoryOptions}
            selectedValues={selectedCategories}
            onToggle={(value) => toggleFilterValue("categories", value)}
            onClear={() => clearFilter("categories")}
          />

          <FilterMenu
            label="Status"
            options={STATUS_OPTIONS}
            selectedValues={selectedStatuses}
            onToggle={(value) => toggleFilterValue("status", value)}
            onClear={() => clearFilter("status")}
          />
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl shadow-blue-900/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-800/30 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800">
                <th className="px-6 py-4">Equipamento</th>
                <th className="px-6 py-4">Patrimonio / Codigo</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Tamanho</th>
                <th className="px-6 py-4">Modelo</th>
                <th className="px-6 py-4">Quantidade</th>
                <th className="px-6 py-4">Cor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {initialMaterials.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <Package className="h-12 w-12 text-slate-800 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium text-sm">Nenhum material encontrado.</p>
                    <p className="text-slate-600 text-xs mt-1">
                      Tente ajustar seus filtros ou cadastre um novo material.
                    </p>
                  </td>
                </tr>
              ) : (
                initialMaterials.map((m: any) => (
                  <tr key={m.id} className="group hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-200">{m.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            ID Reserva:{" "}
                            <span className="text-blue-400 font-bold">{m.reservation_id || "Nao definido"}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-xs font-bold text-slate-300">{m.patrimony_number}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-tighter">
                          Interno: {m.internal_code}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-[10px] font-bold text-slate-400 capitalize">
                        {m.categories}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-300">{m.size || "-"}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-300">{m.model || "-"}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-300">{m.quantity ?? 1}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-300">{m.color || "-"}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setQrModalMaterial(m)}
                          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                          title="Gerar QR Code"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingMaterial(m)
                            setShowMaterialForm(true)
                          }}
                          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showMaterialForm && (
        <MaterialForm
          categories={categories}
          material={editingMaterial}
          onClose={() => {
            setShowMaterialForm(false)
            setEditingMaterial(null)
          }}
        />
      )}

      {qrModalMaterial && (
        <QRCodeModal material={qrModalMaterial} onClose={() => setQrModalMaterial(null)} />
      )}
    </div>
  )
}

function FilterMenu({
  label,
  options,
  selectedValues,
  onToggle,
  onClear,
}: {
  label: string
  options: FilterOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
  onClear: () => void
}) {
  const selectedSet = new Set(selectedValues)
  const summaryLabel = selectedValues.length > 0 ? `${label} (${selectedValues.length})` : label

  return (
    <details className="relative">
      <summary className="list-none bg-transparent border-none text-xs font-bold text-slate-300 cursor-pointer select-none">
        {summaryLabel}
      </summary>
      <div className="absolute right-0 mt-2 z-20 w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl shadow-black/40">
        {options.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma opcao disponivel.</p>
        ) : (
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs text-slate-300 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(option.value)}
                  onChange={() => onToggle(option.value)}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onClear}
          disabled={selectedValues.length === 0}
          className="mt-3 w-full px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Limpar filtro
        </button>
      </div>
    </details>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    available: { color: "bg-green-500/10 text-green-500", label: "Disponivel" },
    cautelado: { color: "bg-blue-500/10 text-blue-500", label: "Em Uso" },
    in_use: { color: "bg-blue-500/10 text-blue-500", label: "Em Uso" },
    maintenance: { color: "bg-amber-500/10 text-amber-500", label: "Manutencao" },
    unavailable: { color: "bg-red-500/10 text-red-500", label: "Indisponivel" },
    blocked: { color: "bg-red-500/10 text-red-500", label: "Indisponivel" },
  }

  const config = configs[status] || { color: "bg-slate-600/10 text-slate-400", label: STATUS_LABELS[status] || status }

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
      {config.label}
    </span>
  )
}
