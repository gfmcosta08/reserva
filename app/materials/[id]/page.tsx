// ========================================
// ARQUIVO: src/app/materials/[id]/page.tsx
// ========================================

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Package, 
  Hash,
  Calendar,
  MapPin,
  AlertTriangle,
  Check,
  Loader2,
  QRCode,
  History
} from "lucide-react";
import { clsx } from "clsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeGenerator } from "@/components/material/QRCodeGenerator";
import { toast } from "sonner";

interface Material {
  id: string;
  name: string;
  patrimony_number: string;
  serial_number: string | null;
  internal_code: string;
  caliber: string | null;
  subcategoria: string | null;
  status: string;
  notes: string | null;
  category_id: string;
  categories: { name: string } | null;
  created_at: string;
  updated_at: string;
}

interface CautelaItem {
  id: string;
  cautela_id: string;
  status: string;
  quantity_delivered: number;
  created_at: string;
  cautelum?: {
    person_id: string;
    persons: {
      full_name: string;
      rg: string;
    };
  };
}

export default function MaterialDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [material, setMaterial] = useState<Material | null>(null);
  const [historico, setHistorico] = useState<CautelaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    fetchMaterial();
    fetchHistorico();
  }, [id]);

  const fetchMaterial = async () => {
    try {
      const response = await fetch(`/api/materials/${id}`);
      const data = await response.json();
      if (data.material) {
        setMaterial(data.material);
      }
    } catch (err) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorico = async () => {
    try {
      const response = await fetch(`/api/materials/${id}/historico`);
      const data = await response.json();
      setHistorico(data.historico || []);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Material não encontrado</p>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; class: string }> = {
    available: { label: "Disponível", class: "bg-green-500/20 text-green-400" },
    cautelado: { label: "Cautelado", class: "bg-blue-500/20 text-blue-400" },
    maintenance: { label: "Em Manutenção", class: "bg-amber-500/20 text-amber-400" },
    unavailable: { label: "Indisponível", class: "bg-red-500/20 text-red-400" },
    baixado: { label: "Baixado", class: "bg-slate-500/20 text-slate-400" },
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{material.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={clsx("text-xs px-3 py-1 rounded-full", statusConfig[material.status]?.class || "bg-slate-500/20 text-slate-400")}>
              {statusConfig[material.status]?.label || material.status}
            </span>
            {material.caliber && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                Calibre: {material.caliber}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowQR(!showQR)}
          className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <QRCode className="h-5 w-5" />
        </button>
      </div>

      {showQR && (
        <div className="mb-6 flex justify-center">
          <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <QRCodeGenerator
              value={material.internal_code}
              title={`QR Code - ${material.name}`}
              size={200}
            />
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Informações</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nome</label>
              <p className="text-white">{material.name}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Categoria</label>
              <p className="text-white">
                {material.categories?.name || "Não categorizada"}
              </p>
            </div>
            {material.subcategoria && (
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Subcategoria</label>
                <p className="text-white capitalize">{material.subcategoria.replace(/_/g, " ")}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Identificação</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">
                <Hash className="h-3 w-3 inline mr-1" />
                Código Interno
              </label>
              <p className="text-white font-mono">{material.internal_code}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Patrimônio</label>
              <p className="text-white font-mono">{material.patrimony_number}</p>
            </div>
            {material.serial_number && (
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Número de Série</label>
                <p className="text-white font-mono">{material.serial_number}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Observações */}
      {material.notes && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Observações</h2>
          <p className="text-slate-300 whitespace-pre-wrap">{material.notes}</p>
        </div>
      )}

      {/* Histórico */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <History className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Histórico de Cautelas</h2>
        </div>
        
        {historico.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-500">Nenhum registro de cautela</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historico.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">
                      {item.cautelum?.persons?.full_name || "Pessoa não identificada"}
                    </p>
                    <p className="text-sm text-slate-400">
                      RG: {item.cautelum?.persons?.rg || "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={clsx(
                      "text-xs px-2 py-1 rounded-full",
                      item.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                      item.status === "returned" ? "bg-green-500/20 text-green-400" :
                      item.status === "damaged" ? "bg-red-500/20 text-red-400" :
                      "bg-slate-500/20 text-slate-400"
                    )}>
                      {item.status === "pending" ? "Pendente" :
                       item.status === "returned" ? "Devolvido" :
                       item.status === "damaged" ? "Danificado" :
                       item.status === "missing" ? "Extraviado" : item.status}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="mt-6 text-xs text-slate-500 text-center">
        Criado em {format(new Date(material.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} • 
        Atualizado em {format(new Date(material.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
      </div>
    </div>
  );
}
