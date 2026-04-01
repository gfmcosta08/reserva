// ========================================
// ARQUIVO: src/app/persons/[id]/page.tsx
// ========================================

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  Lock, 
  Shield,
  Camera,
  Upload,
  AlertTriangle,
  Loader2,
  History,
  Package
} from "lucide-react";
import { clsx } from "clsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BadgeFotoRG, CardAlertaFotoRG } from "@/components/pessoa/AlertaFotoRG";
import { toast } from "sonner";

interface Pessoa {
  id: string;
  full_name: string;
  email: string;
  rg: string;
  registration_number: string;
  function: string;
  status: string;
  phone: string | null;
  cpf: string | null;
  rg_front_url: string | null;
  rg_back_url: string | null;
  foto_facial: string | null;
  face_descriptor: number[] | null;
  has_registered_pin: boolean;
  failed_pin_attempts: number;
  pin_locked_until: string | null;
  created_at: string;
}

interface Cautela {
  id: string;
  type: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  notes: string | null;
}

export default function PessoaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [cautelas, setCautelas] = useState<Cautela[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"dados" | "cautelas" | "fotos">("dados");

  useEffect(() => {
    fetchPessoa();
    fetchCautelas();
  }, [id]);

  const fetchPessoa = async () => {
    try {
      const response = await fetch(`/api/persons/${id}`);
      const data = await response.json();
      if (data.person) {
        setPessoa(data.person);
      }
    } catch (err) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchCautelas = async () => {
    try {
      const response = await fetch(`/api/cautelas?person_id=${id}`);
      const data = await response.json();
      setCautelas(data.cautelas || []);
    } catch (err) {
      console.error("Erro ao carregar cautelas:", err);
    }
  };

  const handleUploadFoto = async (tipo: "frente" | "verso" | "facial", file: File) => {
    if (!pessoa) return;
    setUploading(true);

    try {
      const base64 = await fileToBase64(file);
      
      const response = await fetch(`/api/persons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [tipo === "frente" ? "rg_front_url" : tipo === "verso" ? "rg_back_url" : "foto_facial"]: base64,
        }),
      });

      if (response.ok) {
        toast.success("Foto atualizada com sucesso!");
        fetchPessoa();
      } else {
        toast.error("Erro ao fazer upload");
      }
    } catch (err) {
      toast.error("Erro ao processar imagem");
    } finally {
      setUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!pessoa) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Pessoa não encontrada</p>
      </div>
    );
  }

  const fotoRgPendente = !pessoa.rg_front_url || !pessoa.rg_back_url;

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
          <h1 className="text-2xl font-bold text-white">{pessoa.full_name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={clsx(
              "text-xs px-2 py-0.5 rounded-full",
              pessoa.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
              {pessoa.status === "active" ? "Ativo" : "Inativo"}
            </span>
            <BadgeFotoRG foto_rg_frente={pessoa.rg_front_url} foto_rg_verso={pessoa.rg_back_url} />
          </div>
        </div>
      </div>

      {/* Alert Foto RG */}
      {fotoRgPendente && (
        <CardAlertaFotoRG
          foto_rg_frente={pessoa.rg_front_url}
          foto_rg_verso={pessoa.rg_back_url}
          onUploadClick={() => setActiveTab("fotos")}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-2 mt-6 mb-6">
        {[
          { id: "dados", label: "Dados", icon: User },
          { id: "cautelas", label: "Cautelas", icon: Package },
          { id: "fotos", label: "Fotos RG", icon: Camera },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
              activeTab === tab.id
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "dados" && (
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Informações Pessoais</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nome Completo</label>
                <p className="text-white">{pessoa.full_name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Função</label>
                <p className="text-white">{pessoa.function || "Não informada"}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">RG</label>
                <p className="text-white font-mono">{pessoa.rg}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">CPF</label>
                <p className="text-white font-mono">{pessoa.cpf || "Não cadastrado"}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Matrícula</label>
                <p className="text-white font-mono">{pessoa.registration_number}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Telefone</label>
                <p className="text-white">{pessoa.phone || "Não cadastrado"}</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">E-mail</label>
                <p className="text-white">{pessoa.email}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Segurança</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50">
                <Lock className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-400">PIN</p>
                  <p className="text-white font-medium">
                    {pessoa.has_registered_pin ? "Cadastrado" : "Não cadastrado"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50">
                <Shield className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-400">Biometria Facial</p>
                  <p className="text-white font-medium">
                    {pessoa.face_descriptor ? "Cadastrada" : "Não cadastrada"}
                  </p>
                </div>
              </div>
            </div>
            {pessoa.failed_pin_attempts > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <div>
                    <p className="text-sm text-amber-400">Tentativas de PIN incorretas</p>
                    <p className="text-white font-medium">{pessoa.failed_pin_attempts} tentativa(s)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "cautelas" && (
        <div className="space-y-4">
          {cautelas.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <History className="h-12 w-12 mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400">Nenhuma cautela registrada</p>
            </div>
          ) : (
            cautelas.map((cautela) => (
              <button
                key={cautela.id}
                onClick={() => router.push(`/cautelas/${cautela.id}`)}
                className="w-full p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-blue-500/50 transition-colors text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white capitalize">{cautela.type}</p>
                    <p className="text-sm text-slate-400">
                      {format(new Date(cautela.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <span className={clsx(
                    "text-xs px-3 py-1 rounded-full",
                    cautela.status === "open" ? "bg-green-500/20 text-green-400" :
                    cautela.status === "partial" ? "bg-amber-500/20 text-amber-400" :
                    cautela.status === "closed" ? "bg-slate-500/20 text-slate-400" :
                    "bg-red-500/20 text-red-400"
                  )}>
                    {cautela.status === "open" ? "Aberta" :
                     cautela.status === "partial" ? "Parcial" :
                     cautela.status === "closed" ? "Fechada" : "Divergente"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {activeTab === "fotos" && (
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Fotos do RG</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Frente</label>
                <div className="aspect-[3/2] rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden">
                  {pessoa.rg_front_url ? (
                    <img src={pessoa.rg_front_url} alt="RG Frente" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                      <p className="text-sm text-slate-500">Não cadastrada</p>
                    </div>
                  )}
                </div>
                <UploadButton
                  onUpload={(file) => handleUploadFoto("frente", file)}
                  loading={uploading}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Verso</label>
                <div className="aspect-[3/2] rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden">
                  {pessoa.rg_back_url ? (
                    <img src={pessoa.rg_back_url} alt="RG Verso" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                      <p className="text-sm text-slate-500">Não cadastrada</p>
                    </div>
                  )}
                </div>
                <UploadButton
                  onUpload={(file) => handleUploadFoto("verso", file)}
                  loading={uploading}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Foto Facial</h2>
            <div className="aspect-square rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden max-w-xs mx-auto">
              {pessoa.foto_facial ? (
                <img src={pessoa.foto_facial} alt="Foto Facial" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <User className="h-12 w-12 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm text-slate-500">Não cadastrada</p>
                </div>
              )}
            </div>
            <UploadButton
              onUpload={(file) => handleUploadFoto("facial", file)}
              loading={uploading}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function UploadButton({ onUpload, loading }: { onUpload: (file: File) => void; loading: boolean }) {
  return (
    <label className="mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium cursor-pointer transition-colors">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {loading ? "Enviando..." : "Fazer Upload"}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
      />
    </label>
  );
}
