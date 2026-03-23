"use client";

import { useState } from "react";
import { 
  Plus, 
  Trash2, 
  X, 
  Settings2,
  Check,
  Loader2
} from "lucide-react";
import { createCategory, deleteCategory } from "@/app/actions/categories";

export default function CategoryManager({ 
  categories, 
  onClose 
}: { 
  categories: any[]; 
  onClose: () => void 
}) {
  const [newCategory, setNewCategory] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategory.trim()) return;

    setIsLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("name", newCategory);
    
    const result = await createCategory(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setNewCategory("");
    }
    setIsLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    
    setIsLoading(true);
    const result = await deleteCategory(id);
    if (result.error) {
      alert(result.error);
    }
    setIsLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/10 rounded-lg text-blue-500">
              <Settings2 className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-bold text-white">Gerenciar Categorias</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input 
              type="text" 
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nova categoria..."
              className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
              disabled={isLoading}
            />
            <button 
              type="submit"
              disabled={isLoading || !newCategory.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 transition-all"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
            </button>
          </form>

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {categories.length === 0 ? (
              <p className="text-center py-8 text-slate-500 text-sm italic">Nenhuma categoria cadastrada.</p>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-800/50 group hover:border-slate-700 transition-all">
                  <span className="text-sm font-medium text-slate-300">{cat.name}</span>
                  <button 
                    onClick={() => handleDelete(cat.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-800/30 text-right">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:text-white transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
