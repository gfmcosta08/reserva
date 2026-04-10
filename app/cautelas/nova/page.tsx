// ========================================
// ARQUIVO: src/app/cautelas/nova/page.tsx
// ========================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Search, 
  Package, 
  ClipboardList, 
  ScanFace,
  Loader2,
  AlertTriangle,
  CheckCircle,
  User,
  Plus,
  X,
  FileText,
  Shield
} from "lucide-react";
import { clsx } from "clsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BadgeFotoRG } from "@/components/pessoa/AlertaFotoRG";
import { PinInput } from "@/components/shared/PinInput";
import { useCautelaStore } from "@/store/cautelaStore";
import { useEscalaStore } from "@/store/escalaStore";
import { searchPersons } from "@/app/actions/cautelas";
import { toast } from "sonner";

type PessoaResult = {
  id: string;
  full_name: string;
  rg: string;
  registration_number: string;
  function: string;
  status: string;
  rg_front_url: string | null;
  rg_back_url: string | null;
  face_descriptor: number[] | null;
  has_registered_pin?: boolean;
};

type Material = {
  id: string;
  name: string;
  patrimony_number: string;
  internal_code: string;
  caliber: string | null;
  status: string;
  categories: string;
  subcategoria: string;
  quantity_available?: number;
}

const STEPS = [
  { id: 1, label: "Pessoa", icon: User },
  { id: 2, label: "Materiais", icon: Package },
  { id: 3, label: "Resumo", icon: ClipboardList },
  { id: 4, label: "Assinatura", icon: ScanFace },
];

export default function NovaCautelaPage() {
  const router = useRouter();
  const { 
    step, setStep, selectedPessoa, setSelectedPessoa,
    items, addItem, removeItem, tipo, setTipo,
    dataPrevistaDevolucao, setDataPrevistaDevolucao,
    observacoes, setObservacoes, autenticacaoTipo, setAutenticacaoTipo,
    createCautela, loading: storeLoading, resetWizard
  } = useCautelaStore();
  
  const { fetchEscalasHoje, escalasHoje, verificarAutorizacao, registrarAutorizacaoManual } = useEscalaStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PessoaResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinBlocked, setPinBlocked] = useState<number | null>(null);
  const [showAutorizacaoModal, setShowAutorizacaoModal] = useState(false);
  const [autorizacaoMotivo, setAutorizacaoMotivo] = useState("");
  const [autorizacaoAnexo, setAutorizacaoAnexo] = useState<string | null>(null);
  const [autorizacaoLoading, setAutorizacaoLoading] = useState(false);
  const [escalaAutorizada, setEscalaAutorizada] = useState<{ autorizada: boolean; mensagem?: string }>({ autorizada: false });
  const [showNewPersonModal, setShowNewPersonModal] = useState(false);

  // Step 2 materials
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialResults, setMaterialResults] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  useEffect(() => {
    fetchEscalasHoje();
    return () => resetWizard();
  }, []);

  const handleSearchPessoa = useCallback(async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const results = await searchPersons(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        handleSearchPessoa();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearchPessoa]);

  const handleSelectPessoa = async (pessoa: PessoaResult) => {
    setSelectedPessoa(pessoa);
    setSearchResults([]);
    setSearchQuery("");

    // Verificar autorização da escala
    const resultado = await verificarAutorizacao(pessoa.id);
    setEscalaAutorizada(resultado);
    
    if (!resultado.autorizada) {
      setShowAutorizacaoModal(true);
    }
    
    setStep(2);
  };

  const handleSearchMaterial = useCallback(async () => {
    if (materialSearch.length < 1) return;
    setLoadingMaterials(true);
    try {
      const response = await fetch(`/api/materials/search?q=${encodeURIComponent(materialSearch)}`);
      const data = await response.json();
      setMaterialResults(data.materials || []);
    } catch (err) {
      console.error("Material search error:", err);
    } finally {
      setLoadingMaterials(false);
    }
  }, [materialSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (materialSearch.length >= 1) {
        handleSearchMaterial();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [materialSearch, handleSearchMaterial]);

  const handleAddMaterial = (material: Material) => {
    const existing = items.find(i => i.material_id === material.id);
    if (existing) return;
    
    addItem({
      material_id: material.id,
      quantidade: 1,
    });
    setMaterialSearch("");
    setMaterialResults([]);
  };

  const handleRemoveMaterial = (materialId: string) => {
    const index = items.findIndex(i => i.material_id === materialId);
    if (index !== -1) {
      removeItem(index);
    }
  };

  const handleAutorizacaoSubmit = async () => {
    if (!selectedPessoa || autorizacaoMotivo.length < 10) {
      toast.error("Informe o motivo da autorização (mínimo 10 caracteres)");
      return;
    }

    setAutorizacaoLoading(true);
    try {
      const result = await registrarAutorizacaoManual({
        pessoa_id: selectedPessoa.id,
        motivo: autorizacaoMotivo,
        anexo_base64: autorizacaoAnexo || undefined,
      });

      if (result.success) {
        setShowAutorizacaoModal(false);
        setEscalaAutorizada({ autorizada: true });
        toast.success("Autorização manual registrada");
      } else {
        toast.error(result.error || "Erro ao registrar autorização");
      }
    } catch (err) {
      toast.error("Erro ao registrar autorização");
    } finally {
      setAutorizacaoLoading(false);
    }
  };

  const handleSubmitWithPin = async () => {
    if (!selectedPessoa) {
      toast.error("Selecione uma pessoa");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione pelo menos um material");
      return;
    }

    if (pin.length !== 6) {
      setPinError("PIN deve ter 6 dígitos");
      return;
    }

    setPinError("");
    
    const result = await createCautela(pin);
    
    if (result.success) {
      toast.success("Cautela criada com sucesso!");
      router.push(`/cautelas/${result.cautelaId}`);
    } else {
      setPinError(result.error || "Erro ao criar cautela");
      setPin("");
    }
  };

  const handleSubmitWithFace = async () => {
    toast.info("Verificação facial em desenvolvimento");
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Buscar Pessoa</h2>
        <p className="text-slate-400 text-sm">Digite nome, RG, CPF ou matrícula para buscar</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome, RG, CPF ou matrícula..."
          className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searching && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 animate-spin" />
        )}
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((pessoa) => (
            <button
              key={pessoa.id}
              onClick={() => handleSelectPessoa(pessoa)}
              className="w-full p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{pessoa.full_name}</p>
                    <p className="text-sm text-slate-400">{pessoa.function || "Sem função"}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={clsx(
                    "text-xs px-2 py-0.5 rounded-full",
                    pessoa.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {pessoa.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                  <BadgeFotoRG foto_rg_frente={pessoa.rg_front_url} foto_rg_verso={pessoa.rg_back_url} />
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                RG: {pessoa.rg} • Matrícula: {pessoa.registration_number}
              </div>
            </button>
          ))}
        </div>
      )}

      {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
        <div className="text-center py-8">
          <p className="text-slate-400 mb-4">Nenhuma pessoa encontrada</p>
          <button
            onClick={() => setShowNewPersonModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            <Plus className="h-4 w-4" />
            Cadastrar nova pessoa
          </button>
        </div>
      )}

      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm text-blue-400 font-medium">Dica</p>
            <p className="text-xs text-slate-400 mt-1">
              Se a pessoa não for encontrada, você pode cadastrá-la diretamente pelo botão acima.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Adicionar Materiais</h2>
        <p className="text-slate-400 text-sm">Busque por código interno, patrimônio ou nome</p>
      </div>

      {selectedPessoa && (
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">{selectedPessoa.full_name}</p>
              <p className="text-sm text-slate-400">RG: {selectedPessoa.rg}</p>
            </div>
            <BadgeFotoRG foto_rg_frente={selectedPessoa.rg_front_url} foto_rg_verso={selectedPessoa.rg_back_url} />
          </div>
        </div>
      )}

      {escalaAutorizada.autorizada && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <p className="text-sm text-green-400">{escalaAutorizada.mensagem}</p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input
          type="text"
          value={materialSearch}
          onChange={(e) => setMaterialSearch(e.target.value)}
          placeholder="Buscar material..."
          className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {loadingMaterials && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 animate-spin" />
        )}
      </div>

      {materialResults.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {materialResults.map((material) => (
            <button
              key={material.id}
              onClick={() => handleAddMaterial(material)}
              disabled={items.some(i => i.material_id === material.id)}
              className="w-full p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{material.name}</p>
                  <p className="text-sm text-slate-400">Código: {material.internal_code}</p>
                </div>
                {material.caliber && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                    Calibre: {material.caliber}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-slate-300">Materiais Selecionados ({items.length})</h3>
          {items.map((item, index) => {
            const material = materialResults.find(m => m.id === item.material_id);
            return (
              <div key={item.material_id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div>
                  <p className="text-white">{material?.name || "Material"}</p>
                  <p className="text-xs text-slate-400">Qtd: {item.quantidade}</p>
                </div>
                <button
                  onClick={() => handleRemoveMaterial(item.material_id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações sobre a cautela..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Resumo da Cautela</h2>
        <p className="text-slate-400 text-sm">Verifique os dados antes de continuar</p>
      </div>

      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Pessoa</h3>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
            <User className="h-6 w-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">{selectedPessoa?.full_name}</p>
            <p className="text-sm text-slate-400">{selectedPessoa?.function}</p>
          </div>
          <BadgeFotoRG 
            foto_rg_frente={selectedPessoa?.rg_front_url || null} 
            foto_rg_verso={selectedPessoa?.rg_back_url || null} 
          />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Materiais ({items.length})</h3>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.material_id} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-white">Material ID: {item.material_id.slice(0, 8)}...</span>
              <span className="text-slate-400">Qtd: {item.quantidade}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Tipo</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipo"
                value="diaria"
                checked={tipo === "diaria"}
                onChange={() => setTipo("diaria")}
                className="text-blue-500"
              />
              <span className="text-white">Diária</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipo"
                value="permanente"
                checked={tipo === "permanente"}
                onChange={() => setTipo("permanente")}
                className="text-blue-500"
              />
              <span className="text-white">Permanente</span>
            </label>
          </div>
        </div>

        {tipo === "diaria" && (
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Previsão Devolução</h3>
            <input
              type="date"
              value={dataPrevistaDevolucao?.toISOString().split("T")[0] || ""}
              onChange={(e) => setDataPrevistaDevolucao(e.target.value ? new Date(e.target.value) : null)}
              min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
            />
          </div>
        )}
      </div>

      {observacoes && (
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Observações</h3>
          <p className="text-sm text-white whitespace-pre-wrap">{observacoes}</p>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Assinatura</h2>
        <p className="text-slate-400 text-sm">Escolha o método de autenticação</p>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setAutenticacaoTipo("pin")}
          className={clsx(
            "flex-1 p-4 rounded-xl border transition-colors",
            autenticacaoTipo === "pin"
              ? "bg-blue-500/10 border-blue-500 text-white"
              : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
          )}
        >
          <Shield className="h-6 w-6 mx-auto mb-2" />
          <p className="font-medium">PIN</p>
          <p className="text-xs opacity-60">6 dígitos</p>
        </button>
        <button
          onClick={() => setAutenticacaoTipo("facial")}
          className={clsx(
            "flex-1 p-4 rounded-xl border transition-colors",
            autenticacaoTipo === "facial"
              ? "bg-blue-500/10 border-blue-500 text-white"
              : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
          )}
        >
          <ScanFace className="h-6 w-6 mx-auto mb-2" />
          <p className="font-medium">Facial</p>
          <p className="text-xs opacity-60">Reconhecimento</p>
        </button>
      </div>

      {autenticacaoTipo === "pin" ? (
        <PinInput
          value={pin}
          onChange={setPin}
          onComplete={() => {}}
          length={6}
          error={pinError}
          title="Digite o PIN"
          subtitle={`PIN do(a) ${selectedPessoa?.full_name}`}
          blockingCountdown={pinBlocked}
        />
      ) : (
        <div className="text-center py-12">
          <ScanFace className="h-16 w-16 mx-auto mb-4 text-blue-400" />
          <p className="text-slate-400">Clique para iniciar verificação facial</p>
          <button
            onClick={handleSubmitWithFace}
            className="mt-4 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            Iniciar Verificação
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : router.back()}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Nova Cautela</h1>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={clsx(
              "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
              step >= s.id
                ? "bg-blue-500/20 border-blue-500 text-blue-400"
                : "bg-slate-800 border-slate-700 text-slate-500"
            )}>
              {step > s.id ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
            </div>
            <span className={clsx(
              "ml-2 text-sm font-medium hidden sm:block",
              step >= s.id ? "text-white" : "text-slate-500"
            )}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={clsx(
                "w-8 h-[2px] mx-2",
                step > s.id ? "bg-blue-500" : "bg-slate-700"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-colors"
          >
            Voltar
          </button>
        )}
        {step < 4 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && !selectedPessoa}
            className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            Próximo
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={autenticacaoTipo === "pin" ? handleSubmitWithPin : handleSubmitWithFace}
            disabled={storeLoading || pin.length !== 6}
            className="flex-1 px-6 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {storeLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                Confirmar Cautela
              </>
            )}
          </button>
        )}
      </div>

      {/* Authorization Modal */}
      {showAutorizacaoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-amber-500/20">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Autorização Necessária</h3>
                <p className="text-sm text-slate-400">Pessoa não autorizada</p>
              </div>
            </div>

            <p className="text-slate-300 text-sm mb-4">
              {escalaAutorizada.mensagem}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Motivo da autorização *
                </label>
                <textarea
                  value={autorizacaoMotivo}
                  onChange={(e) => setAutorizacaoMotivo(e.target.value)}
                  placeholder="Descreva o motivo da autorização manual..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAutorizacaoModal(false);
                    router.back();
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAutorizacaoSubmit}
                  disabled={autorizacaoLoading || autorizacaoMotivo.length < 10}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
                >
                  {autorizacaoLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Registrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
