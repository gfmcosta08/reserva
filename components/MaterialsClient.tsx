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
  Tag
} from "lucide-react";
import CategoryManager from "./CategoryManager";
import MaterialForm from "./MaterialForm";
import { useRouter, useSearchParams } from "next/navigation";

export default function MaterialsClient({ 
  initialMaterials, 
  categories 
}: { 
  initialMaterials: any[]; 
  categories: any[] 
}) {
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

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
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 rounded-xl font-medium border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <Tag className="h-4 w-4" />
            Categorias
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
      <div className="flex h-14 items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-2xl px-4 backdrop-blur-sm">
        <div className="flex-1 relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome, patrimônio ou código..." 
            className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-200 pl-10 underline-offset-4"
            defaultValue={searchParams.get("search") || ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="h-6 w-px bg-slate-800" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg text-xs font-semibold text-slate-400">
            <Filter className="h-3 w-3" />
            Filtrar
          </div>
          <select 
            className="bg-transparent border-none text-xs font-bold text-slate-300 focus:ring-0 cursor-pointer"
            defaultValue={searchParams.get("category_id") || ""}
            onChange={(e) => handleFilter("category_id", e.target.value)}
          >
            <option value="">Todas Categorias</option>
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
            <option value="in_use">Em Uso</option>
            <option value="maintenance">Manutenção</option>
            <option value="blocked">Bloqueado</option>
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
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{m.serial_number || 'S/N'}</p>
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

      {showCategoryManager && (
        <CategoryManager 
          categories={categories} 
          onClose={() => setShowCategoryManager(false)} 
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
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    available: { color: "bg-green-500/10 text-green-500", label: "Disponível" },
    in_use: { color: "bg-blue-500/10 text-blue-500", label: "Em Uso" },
    maintenance: { color: "bg-amber-500/10 text-amber-500", label: "Manutenção" },
    blocked: { color: "bg-red-500/10 text-red-500", label: "Bloqueado" },
  };

  const config = configs[status] || configs.available;

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
      {config.label}
    </span>
  );
}
