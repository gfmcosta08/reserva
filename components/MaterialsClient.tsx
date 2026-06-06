"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  Tag,
  Download,
  Upload,
  QrCode,
  X,
} from "lucide-react";
import CategoryManager from "./CategoryManager";
import MaterialForm from "./MaterialForm";
import MaterialCautelaDetailModal from "./MaterialCautelaDetailModal";
import QRCodeModal from "./QRCodeModal";
import { useRouter } from "next/navigation";
import { importMaterialsCsv } from "@/app/actions/materials";
import { MATERIALS_LIST_ROW_LIMIT } from "@/lib/materials-list-limit";
import type { MaterialActiveDetail } from "@/lib/material-active-detail";

export type MaterialRow = {
  id: string;
  name: string;
  patrimony_number: string;
  serial_number?: string;
  internal_code: string;
  reservation_id?: string;
  category?: string;
  status: string;
  notes?: string;
  marca?: string;
  modelo?: string;
  calibre?: string;
  activeDetail?: MaterialActiveDetail;
};

export type MaterialsUrlQuery = {
  search?: string;
  name?: string;
  reservation_id?: string;
  category?: string;
  status?: string;
  marca?: string;
  modelo?: string;
  calibre?: string;
};

function pushMaterialsRoute(
  router: ReturnType<typeof useRouter>,
  current: MaterialsUrlQuery,
  patch: Partial<MaterialsUrlQuery>
) {
  const merged: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...current, ...patch })) {
    if (v != null && String(v).length > 0) merged[k] = String(v)
  }
  const q = new URLSearchParams(merged).toString()
  router.push(q ? `/materials?${q}` : "/materials")
}

const FILTER_SELECT_CLASS =
  "min-w-[9.5rem] max-w-[12rem] rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 cursor-pointer shadow-sm hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500 [&>option]:bg-slate-900 [&>option]:text-slate-100 [&>option]:py-1"

function mergeFilterOption(options: string[], current?: string): string[] {
  if (!current?.trim()) return options
  const set = new Set(options)
  set.add(current.trim())
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"))
}

function useDebouncedRoutePush(
  router: ReturnType<typeof useRouter>,
  urlQuery: MaterialsUrlQuery,
  delayMs = 400
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback(
    (patch: Partial<MaterialsUrlQuery>) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        pushMaterialsRoute(router, urlQuery, patch)
      }, delayMs)
    },
    [router, urlQuery, delayMs]
  )
}

export default function MaterialsClient({
  initialMaterials,
  categoryOptions,
  materialNames = [],
  locations = [],
  marcaOptions = [],
  modeloOptions = [],
  calibreOptions = [],
  urlQuery,
  listTruncated = false,
  materialsTotalCount,
}: {
  initialMaterials: MaterialRow[];
  categoryOptions: { name: string }[];
  materialNames?: string[];
  locations?: string[];
  marcaOptions?: string[];
  modeloOptions?: string[];
  calibreOptions?: string[];
  urlQuery: MaterialsUrlQuery;
  listTruncated?: boolean;
  materialsTotalCount?: number;
}) {
  const [showCategories, setShowCategories] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialRow | null>(null);
  const [qrModalMaterial, setQrModalMaterial] = useState<MaterialRow | null>(null);
  const [cautelaDetailMaterial, setCautelaDetailMaterial] = useState<MaterialRow | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const router = useRouter();
  const debouncedPush = useDebouncedRoutePush(router, urlQuery);

  const marcaSelectOptions = useMemo(
    () => mergeFilterOption(marcaOptions, urlQuery.marca),
    [marcaOptions, urlQuery.marca]
  )
  const modeloSelectOptions = useMemo(
    () => mergeFilterOption(modeloOptions, urlQuery.modelo),
    [modeloOptions, urlQuery.modelo]
  )
  const calibreSelectOptions = useMemo(
    () => mergeFilterOption(calibreOptions, urlQuery.calibre),
    [calibreOptions, urlQuery.calibre]
  )

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        urlQuery.search ||
          urlQuery.name ||
          urlQuery.reservation_id ||
          urlQuery.category ||
          urlQuery.status ||
          urlQuery.marca ||
          urlQuery.modelo ||
          urlQuery.calibre
      ),
    [urlQuery]
  );

  const clearFilters = () => router.push("/materials");

  function openCautelaDetail(m: MaterialRow) {
    if (m.status !== "cautelado") return;
    if (m.activeDetail) {
      setCautelaDetailMaterial(m);
    } else {
      alert("Cautela ativa não encontrada para este material.");
    }
  }

  const handleDownloadTemplate = () => {
    const headers = ["Nome", "Patrimonio", "CodigoInterno", "NumeroSerie", "IdentificacaoReserva", "Categoria", "Marca", "Modelo", "Calibre", "Observacoes"];
    const csv = headers.join(",") + "\n" +
                "Pistola Glock,PAT-001,ARM-01,ABC123,RESERVA-01,ARMA CURTA,Glock,G17 Gen5,9mm,Opcional\n" +
                "Colete Balistico,PAT-002,COL-01,,RESERVA-02,COLETES,,,,Opcional";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_importacao_materiais.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Deseja importar os materiais do arquivo ${file.name}?`)) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      // O backend vai dar parse do CSV
      const result = await importMaterialsCsv(text);
      if (result.error) {
        alert("Erro na importação: " + result.error);
      } else {
        alert(`Sucesso! ${result.count} materiais importados/atualizados.`);
      }
    } catch (err: any) {
      alert("Erro ao ler arquivo: " + err.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const exportFilteredCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nome,Patrimonio,Codigo Interno,Numero Serie,Identificacao Reserva,Categoria,Marca,Modelo,Calibre,Status,Observacoes\n";

    initialMaterials.forEach(m => {
      const catName = m.category || "";
      const statusMap: any = { available: "Disponivel", cautelado: "Em Uso", maintenance: "Manutencao", unavailable: "Bloqueado/Indisponivel" };
      const statusLabel = statusMap[m.status] || m.status;

      csvContent += `"${m.name}","${m.patrimony_number}","${m.internal_code}","${m.serial_number || ''}","${m.reservation_id || ''}","${catName}","${m.marca || ''}","${m.modelo || ''}","${m.calibre || ''}","${statusLabel}","${m.notes || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `materiais_exportados_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function handleSearch(term: string) {
    debouncedPush({ search: term || undefined })
  }

  function handleFilter(key: string, value: string) {
    pushMaterialsRoute(router, urlQuery, { [key]: value || undefined })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
      {listTruncated && (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/95"
          role="status"
        >
          Lista limitada a <strong>{MATERIALS_LIST_ROW_LIMIT.toLocaleString("pt-BR")}</strong> itens por carregamento.
          {materialsTotalCount != null && (
            <>
              {" "}
              Total com os filtros atuais: <strong>{materialsTotalCount.toLocaleString("pt-BR")}</strong>. Use filtros
              para refinar.
            </>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Materiais</h1>
          <p className="text-slate-400 mt-1">Gerencie o inventário de armas e equipamentos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input 
            type="file" 
            accept=".csv" 
            id="csvUpload" 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={isImporting}
          />
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium border border-slate-700 hover:text-white transition-all text-xs"
          >
            <Download className="h-4 w-4" />
            Modelo CSV
          </button>
          <label 
            htmlFor="csvUpload"
            className={`flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium border border-slate-700 hover:text-white transition-all text-xs cursor-pointer ${isImporting ? "opacity-50 pointer-events-none" : ""}`}
          >
            <Upload className="h-4 w-4" />
            {isImporting ? "Importando..." : "Importar CSV"}
          </label>
          <button 
            onClick={() => setShowCategories(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium border border-slate-700 hover:text-white transition-all text-xs"
          >
            <Tag className="h-4 w-4" />
            Categorias
          </button>
          <button 
            onClick={exportFilteredCSV}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600/20 text-emerald-500 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-600/30 transition-all text-xs"
          >
            <Download className="h-4 w-4" />
            Exportar Filtrados
          </button>
          <button 
            onClick={() => {
              setEditingMaterial(null);
              setShowMaterialForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/40 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="h-5 w-5" />
            Novo Material
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex min-h-14 py-3 items-center flex-wrap gap-3 bg-slate-900/50 border border-slate-800 rounded-2xl px-4 backdrop-blur-sm">
        <div className="flex-1 relative flex items-center min-w-[200px]">
          <Search className="absolute left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, patrimônio ou código..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            key={`search-${urlQuery.search ?? ""}`}
            defaultValue={urlQuery.search || ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="hidden md:block h-8 w-px bg-slate-700" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-xs font-bold text-slate-300 border border-slate-700">
            <Filter className="h-3.5 w-3.5 text-blue-400" />
            Filtros
          </div>
          <select
            className={FILTER_SELECT_CLASS}
            value={urlQuery.category || ""}
            onChange={(e) => handleFilter("category", e.target.value)}
            aria-label="Categoria"
          >
            <option value="">Todas categorias</option>
            {categoryOptions.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            className={FILTER_SELECT_CLASS}
            value={urlQuery.status || ""}
            onChange={(e) => handleFilter("status", e.target.value)}
            aria-label="Status"
          >
            <option value="">Todos status</option>
            <option value="available">Disponível</option>
            <option value="cautelado">Em Uso</option>
            <option value="maintenance">Manutenção</option>
            <option value="unavailable">Indisponível</option>
          </select>
          {locations.length > 0 && (
            <select
              className={FILTER_SELECT_CLASS}
              value={urlQuery.reservation_id || ""}
              onChange={(e) => handleFilter("reservation_id", e.target.value)}
              aria-label="Localização"
            >
              <option value="">Todas localizações</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          )}
          {marcaSelectOptions.length > 0 && (
            <select
              className={FILTER_SELECT_CLASS}
              value={urlQuery.marca || ""}
              onChange={(e) => handleFilter("marca", e.target.value)}
              aria-label="Marca"
            >
              <option value="">Todas marcas</option>
              {marcaSelectOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          {modeloSelectOptions.length > 0 && (
            <select
              className={FILTER_SELECT_CLASS}
              value={urlQuery.modelo || ""}
              onChange={(e) => handleFilter("modelo", e.target.value)}
              aria-label="Modelo"
            >
              <option value="">Todos modelos</option>
              {modeloSelectOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          {calibreSelectOptions.length > 0 && (
            <select
              className={FILTER_SELECT_CLASS}
              value={urlQuery.calibre || ""}
              onChange={(e) => handleFilter("calibre", e.target.value)}
              aria-label="Calibre"
            >
              <option value="">Todos calibres</option>
              {calibreSelectOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Mobile / tablet cards */}
      <div className="md:hidden space-y-3">
        {initialMaterials.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-16 text-center">
            <Package className="h-12 w-12 text-slate-800 mx-auto mb-4" />
            <p className="text-slate-500 font-medium text-sm">Nenhum material encontrado.</p>
          </div>
        ) : (
          initialMaterials.map((m) => (
            <MaterialCard
              key={m.id}
              material={m}
              onEdit={() => {
                setEditingMaterial(m);
                setShowMaterialForm(true);
              }}
              onQr={() => setQrModalMaterial(m)}
              onCautelaDetail={() => openCautelaDetail(m)}
            />
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl shadow-blue-900/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/30 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800">
              <th className="px-6 py-4">Equipamento</th>
              <th className="px-6 py-4">Patrimônio / Código</th>
              <th className="px-6 py-4">Marca / Modelo</th>
              <th className="px-6 py-4">Calibre</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {initialMaterials.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center">
                  <Package className="h-12 w-12 text-slate-800 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium text-sm">Nenhum material encontrado.</p>
                  <p className="text-slate-600 text-xs mt-1">Tente ajustar seus filtros ou cadastre um novo material.</p>
                </td>
              </tr>
            ) : (
              initialMaterials.map((m) => (
                <tr key={m.id} className="group hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-200">{m.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          ID Reserva: <span className="text-blue-400 font-bold">{m.reservation_id || 'Não definido'}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-xs font-bold text-slate-300">{m.patrimony_number}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-tighter">Interno: {m.internal_code}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-xs font-bold text-slate-300">{m.marca || <span className="text-slate-600">—</span>}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{m.modelo || ""}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {m.calibre ? (
                      <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-[10px] font-bold text-blue-400">
                        {m.calibre}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-[10px]">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-[10px] font-bold text-slate-400 capitalize">
                      {m.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={m.status}
                      onCautelaClick={m.status === "cautelado" ? () => openCautelaDetail(m) : undefined}
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setQrModalMaterial(m)}
                        className="p-2.5 min-h-[44px] min-w-[44px] hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                        title="Gerar QR Code"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingMaterial(m);
                          setShowMaterialForm(true);
                        }}
                        className="p-2.5 min-h-[44px] min-w-[44px] hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Editar material"
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

      {showCategories && (
        <CategoryManager
          categoryNames={categoryOptions.map((c) => c.name)}
          onClose={() => setShowCategories(false)}
        />
      )}

      {showMaterialForm && (
        <MaterialForm
          categorySuggestions={categoryOptions.map((c) => c.name)}
          material={editingMaterial}
          onClose={() => {
            setShowMaterialForm(false);
            setEditingMaterial(null);
          }}
        />
      )}

      {qrModalMaterial && (
        <QRCodeModal
          material={{
            id: qrModalMaterial.id,
            name: qrModalMaterial.name,
            patrimony_number: qrModalMaterial.patrimony_number ?? null,
            internal_code: qrModalMaterial.internal_code ?? null,
            serial_number: qrModalMaterial.serial_number ?? null,
            status: qrModalMaterial.status,
            category: qrModalMaterial.category,
          }}
          onClose={() => setQrModalMaterial(null)}
        />
      )}

      {cautelaDetailMaterial?.activeDetail && (
        <MaterialCautelaDetailModal
          material={cautelaDetailMaterial}
          activeDetail={cautelaDetailMaterial.activeDetail}
          onClose={() => setCautelaDetailMaterial(null)}
        />
      )}
    </div>
  );
}

function MaterialCard({
  material: m,
  onEdit,
  onQr,
  onCautelaDetail,
}: {
  material: MaterialRow;
  onEdit: () => void;
  onQr: () => void;
  onCautelaDetail: () => void;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center text-blue-500 shrink-0">
          <Package className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-200 truncate">{m.name}</p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {m.patrimony_number} • {m.internal_code}
          </p>
          {(m.marca || m.modelo || m.calibre) && (
            <p className="text-[10px] text-slate-500 mt-1">
              {[m.marca, m.modelo, m.calibre].filter(Boolean).join(" • ")}
            </p>
          )}
        </div>
        <StatusBadge
          status={m.status}
          onCautelaClick={m.status === "cautelado" ? onCautelaDetail : undefined}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
        <button
          type="button"
          onClick={onQr}
          className="flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
          title="Gerar QR Code"
        >
          <QrCode className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-colors"
        >
          <Edit2 className="h-4 w-4" />
          Editar
        </button>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  onCautelaClick,
}: {
  status: string;
  onCautelaClick?: () => void;
}) {
  const configs: any = {
    available: { color: "bg-green-500/10 text-green-500", label: "Disponível" },
    cautelado: { color: "bg-blue-500/10 text-blue-500", label: "Em Uso" },
    maintenance: { color: "bg-amber-500/10 text-amber-500", label: "Manutenção" },
    unavailable: { color: "bg-red-500/10 text-red-500", label: "Indisponível" },
  };

  const config = configs[status] || configs.available;

  if (onCautelaClick) {
    return (
      <button
        type="button"
        onClick={onCautelaClick}
        title="Ver quem está com este material"
        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.color} hover:ring-2 hover:ring-blue-500/40 transition-all cursor-pointer`}
      >
        {config.label}
      </button>
    );
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
      {config.label}
    </span>
  );
}
