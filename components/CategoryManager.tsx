"use client";

import { X, Settings2 } from "lucide-react";

export default function CategoryManager({
  categoryNames,
  onClose,
}: {
  categoryNames: string[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/10 rounded-lg text-blue-500">
              <Settings2 className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-bold text-white">Categorias em uso</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            As categorias são o texto informado em cada material. Para criar uma nova, cadastre ou edite um material e
            digite o nome da categoria (há sugestões conforme o que já existe no inventário).
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {categoryNames.length === 0 ? (
              <p className="text-center py-8 text-slate-500 text-sm italic">Nenhuma categoria ainda — cadastre um material.</p>
            ) : (
              categoryNames.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-800/50"
                >
                  <span className="text-sm font-medium text-slate-300">{name}</span>
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
