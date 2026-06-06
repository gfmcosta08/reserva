"use client";

import { useState, useRef, useEffect } from "react";
import { X, Package, Save, Loader2, AlertCircle, ScanLine, ArrowLeft } from "lucide-react";
import { createMaterial, updateMaterial } from "@/app/actions/materials";

export default function MaterialForm({
  categorySuggestions,
  material,
  onClose,
}: {
  categorySuggestions: string[];
  material?: any;
  onClose: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState<string | null>(null);
  const listId = "material-category-datalist";
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const patrimonyRef = useRef<HTMLInputElement>(null);
  const serialRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function handleOcrScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrLoading(true);
    setOcrSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const json = await res.json();
      if (json.success && json.extracted) {
        const { rg, registration } = json.extracted;
        const filled = [];
        if (rg && serialRef.current && !serialRef.current.value) {
          serialRef.current.value = rg;
          filled.push("Nº de Série");
        }
        if (registration && patrimonyRef.current && !patrimonyRef.current.value) {
          patrimonyRef.current.value = registration;
          filled.push("Patrimônio");
        }
        setOcrSuccess(filled.length > 0 ? `Preenchido: ${filled.join(", ")}` : "Nenhum campo extraído automaticamente");
      } else {
        setOcrSuccess("Não foi possível extrair dados da imagem");
      }
    } catch {
      setOcrSuccess("Erro ao processar imagem");
    } finally {
      setIsOcrLoading(false);
      if (ocrInputRef.current) ocrInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      category: (formData.get("category") as string).trim(),
      patrimony_number: formData.get("patrimony_number") as string,
      serial_number: formData.get("serial_number") as string,
      internal_code: formData.get("internal_code") as string,
      reservation_id: formData.get("reservation_id") as string,
      marca: formData.get("marca") as string,
      modelo: formData.get("modelo") as string,
      calibre: formData.get("calibre") as string,
      notes: formData.get("notes") as string,
      stock_quantity: Number(formData.get("stock_quantity") || 1),
    };

    const result = material ? await updateMaterial(material.id, data) : await createMaterial(data as any);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-form-title"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full sm:max-w-2xl max-h-[min(92dvh,900px)] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="shrink-0 flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="sm:hidden flex items-center gap-1.5 px-2 py-2 -ml-1 text-slate-400 hover:text-white rounded-lg"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-bold">Voltar</span>
              </button>
              <div className="hidden sm:flex p-1.5 bg-blue-600/10 rounded-lg text-blue-500 shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <h3 id="material-form-title" className="text-base sm:text-lg font-bold text-white truncate">
                {material ? "Editar Material" : "Novo Material"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-white transition-colors shrink-0"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
            <div className="px-4 sm:px-8 pt-4 flex flex-wrap items-center gap-3">
              <input ref={ocrInputRef} type="file" accept="image/*" capture="environment" onChange={handleOcrScan} className="hidden" />
              <button
                type="button"
                onClick={() => ocrInputRef.current?.click()}
                disabled={isOcrLoading}
                className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
              >
                {isOcrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                {isOcrLoading ? "Lendo etiqueta..." : "Escanear Etiqueta (OCR)"}
              </button>
              {ocrSuccess && <span className="text-xs text-emerald-400 font-semibold">{ocrSuccess}</span>}
            </div>

            <div className="p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
                <input
                  name="category"
                  list={listId}
                  defaultValue={material?.category ?? ""}
                  required
                  minLength={2}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  placeholder="Ex: Pistola, Carregador, Munição"
                />
                <datalist id={listId}>
                  {categorySuggestions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nº de Patrimônio</label>
                <input
                  ref={patrimonyRef}
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
                  ref={serialRef}
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

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marca</label>
                <input
                  name="marca"
                  defaultValue={material?.marca}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  placeholder="Ex: Glock, Taurus, Imbel"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modelo</label>
                <input
                  name="modelo"
                  defaultValue={material?.modelo}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  placeholder="Ex: G17 Gen 5, PT840, M964"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Calibre</label>
                <input
                  name="calibre"
                  defaultValue={material?.calibre}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  placeholder="Ex: .40, 9mm, 5.56"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantidade em estoque</label>
                <input
                  name="stock_quantity"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={material?.stock_quantity ?? 1}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  placeholder="Ex: 1 para arma, 500 para munição"
                />
                <p className="text-[11px] text-slate-500">
                  Armas e coletes: 1. Carregadores fungíveis e munição: total em estoque (ex. 100 projéteis ou 50 carregadores).
                </p>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observações</label>
                <textarea
                  name="notes"
                  defaultValue={material?.notes}
                  rows={3}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all resize-y min-h-[80px]"
                  placeholder="Detalhes técnicos, estado de conservação, etc."
                />
              </div>
            </div>

            {error && (
              <div className="mx-4 sm:mx-8 mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-xs font-semibold">{error}</p>
              </div>
            )}
          </div>

          <div className="shrink-0 p-4 sm:p-6 bg-slate-800/30 border-t border-slate-800 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 sm:py-2 min-h-[44px] bg-slate-800 text-slate-300 rounded-xl font-bold hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 sm:py-2 min-h-[44px] bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-50 transition-all"
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
