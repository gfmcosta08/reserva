"use client";

import { useState } from "react";
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
  QrCode
} from "lucide-react";
import CategoryManager from "./CategoryManager";
import MaterialForm from "./MaterialForm";
import QRCodeModal from "./QRCodeModal";
import { useRouter, useSearchParams } from "next/navigation";
import { importMaterialsCsv } from "@/app/actions/materials";

export default function MaterialsClient({ 
  initialMaterials, 
  categories,
  userRole = "operator",
  materialNames = [],
  locations = []
}: { 
  initialMaterials: any[]; 
  categories: any[];
  userRole?: string;
  materialNames?: string[];
  locations?: string[];
}) {
  const [showCategories, setShowCategories] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [qrModalMaterial, setQrModalMaterial] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDownloadTemplate = () => {
    const headers = ["Nome", "Patrimonio", "CodigoInterno", "NumeroSerie", "IdentificacaoReserva", "Categoria", "Observacoes"];
    const csv = headers.join(",") + "\n" + 
                "Algema Tática,PAT-001,ALG-01,12345,RESERVA-01,Armamento Menos Letal,Opcional\n" +
                "Colete Balístico,PAT-002,COL-01,,RESERVA-02,Proteção Balística,Opcional";
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
    csvContent += "Nome,Patrimonio,Codigo Interno,Numero Serie,Identificacao Reserva,Categoria,Status,Observacoes\n";

    initialMaterials.forEach(m => {
      const catName = m.categories?.name || "";
      const statusMap: any = { available: "Disponivel", cautelado: "Em Uso", maintenance: "Manutencao", unavailable: "Bloqueado/Indisponível" };
      const statusLabel = statusMap[m.status] || m.status;

      csvContent += `"${m.name}","${m.patrimony_number}","${m.internal_code}","${m.serial_number || ''}","${m.reservation_id || ''}","${catName}","${statusLabel}","${m.notes || ''}"\n`;
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
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set("search", term);
    } else {
      params.delete("search");
    }
    router.push(`/materials?${params.toString()}`);
  }

  function handleFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/materials?${params.toString()}`);
  }

  return (
    <div className="p-8 space-y-8">
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
      <div className="flex min-h-14 py-2 items-center flex-wrap gap-4 bg-slate-900/50 border border-slate-800 rounded-2xl px-4 backdrop-blur-sm">
        <div className="flex-1 relative flex items-center min-w-[200px]">
          <Search className="absolute left-3 h-4 w-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome, patrimônio ou código..." 
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
          <select 
            className="bg-transparent border-none text-xs font-bold text-slate-300 focus:ring-0 cursor-pointer"
            defaultValue={searchParams.get("name") || ""}
            onChange={(e) => handleFilter("name", e.target.value)}
          >
            <option value="">Por Material</option>
            {materialNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select 
            className="bg-transparent border-none text-xs font-bold text-slate-300 focus:ring-0 cursor-pointer"
            defaultValue={searchParams.get("reservation_id") || ""}
            onChange={(e) => handleFilter("reservation_id", e.target.value)}
          >
            <option value="">Por Localização</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
          <select 
            className="bg-transparent border-none text-xs font-bold text-slate-300 focus:ring-0 cursor-pointer"
            defaultValue={searchParams.get("category_id") || ""}
            onChange={(e) => handleFilter("category_id", e.target.value)}
          >
            <option value="">Por Categoria</option>
            {categories.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select 
            className="bg-transparent border-none text-xs font-bold text-slate-300 focus:ring-0 cursor-pointer"
            defaultValue={searchParams.get("status") || ""}
            onChange={(e) => handleFilter("status", e.target.value)}
          >
            <option value="">Status</option>
            <option value="available">Disponível</option>
            <option value="cautelado">Em Uso</option>
            <option value="maintenance">Manutenção</option>
            <option value="unavailable">Indisponível</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl shadow-blue-900/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/30 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800">
              <th className="px-6 py-4">Equipamento</th>
              <th className="px-6 py-4">Patrimônio / Código</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {initialMaterials.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center">
                  <Package className="h-12 w-12 text-slate-800 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium text-sm">Nenhum material encontrado.</p>
                  <p className="text-slate-600 text-xs mt-1">Tente ajustar seus filtros ou cadastre um novo material.</p>
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
                    <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-[10px] font-bold text-slate-400 capitalize">
                      {m.categories?.name}
                    </span>
                  </td>
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
                          setEditingMaterial(m);
                          setShowMaterialForm(true);
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

      {showCategories && (
        <CategoryManager 
          categories={categories} 
          onClose={() => setShowCategories(false)} 
          userRole={userRole}
        />
      )}

      {showMaterialForm && (
        <MaterialForm
          categories={categories}
          material={editingMaterial}
          onClose={() => {
            setShowMaterialForm(false);
            setEditingMaterial(null);
          }}
        />
      )}

      {qrModalMaterial && (
        <QRCodeModal
          material={qrModalMaterial}
          onClose={() => setQrModalMaterial(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    available: { color: "bg-green-500/10 text-green-500", label: "Disponível" },
    cautelado: { color: "bg-blue-500/10 text-blue-500", label: "Em Uso" },
    maintenance: { color: "bg-amber-500/10 text-amber-500", label: "Manutenção" },
    unavailable: { color: "bg-red-500/10 text-red-500", label: "Indisponível" },
  };

  const config = configs[status] || configs.available;

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
      {config.label}
    </span>
  );
}
