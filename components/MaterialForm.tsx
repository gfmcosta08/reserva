"use client";

import { useState } from "react";
import { 
  X, 
  Package, 
  Save,
  Loader2,
  AlertCircle
} from "lucide-react";
import { createMaterial, updateMaterial } from "@/app/actions/materials";

export default function MaterialForm({ 
  categories, 
  material,
  onClose 
}: { 
  categories: any[]; 
  material?: any;
  onClose: () => void 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      category_id: formData.get("category_id") as string,
      patrimony_number: formData.get("patrimony_number") as string,
      serial_number: formData.get("serial_number") as string,
      internal_code: formData.get("internal_code") as string,
      reservation_id: formData.get("reservation_id") as string,
      notes: formData.get("notes") as string,
    };

    const result = material 
      ? await updateMaterial(material.id, data)
      : await createMaterial(data as any);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-6 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-600/10 rounded-lg text-blue-500">
                <Package className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-bold text-white">
                {material ? "Editar Material" : "Novo Material"}
              </h3>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome do Equipamento</label>
              <input 
                name="name"
                defaultValue={material?.name}
                required
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                placeholder="Ex: Glock G17 Gen 5"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</label>
              <select 
                name="category_id"
                defaultValue={material?.category_id}
                required
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer"
              >
                <option value="">Selecione...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nº de Patrimônio</label>
              <input 
                name="patrimony_number"
                defaultValue={material?.patrimony_number}
                required
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                placeholder="Ex: PAT-2024-001"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nº de Série</label>
              <input 
                name="serial_number"
                defaultValue={material?.serial_number}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                placeholder="Ex: ABC123456"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Código Interno / QR</label>
              <input 
                name="internal_code"
                defaultValue={material?.internal_code}
                required
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                placeholder="Ex: ARMA-001"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Identificação da Reserva</label>
              <input 
                name="reservation_id"
                defaultValue={material?.reservation_id}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                placeholder="Ex: ARMARIO-A-01 ou Numeração antiga"
              />
            </div>

            <div className="md:col-span-1 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observações</label>
              <textarea 
                name="notes"
                defaultValue={material?.notes}
                rows={2}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all resize-none"
                placeholder="Detalhes técnicos, estado de conservação, etc."
              />
            </div>
          </div>

          {error && (
            <div className="mx-8 mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          <div className="p-6 bg-slate-800/30 flex justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-8 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Salvar Material
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
