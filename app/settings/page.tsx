// ========================================
// ARQUIVO: src/app/settings/page.tsx
// ========================================

"use client";

import { useState, useEffect } from "react";
import { 
  Settings, 
  MessageCircle, 
  Mail, 
  Building2, 
  Save, 
  Copy, 
  Check, 
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { clsx } from "clsx";
import { configurarNotificacoes, getNotificacaoConfig, testarEnvioEmail } from "@/lib/notificacoes";
import { configureWhatsApp, getWhatsAppConfig, verificarConexaoWhatsApp } from "@/lib/whatsapp/whatsapp";

interface Configuracao {
  whatsapp_numero: string;
  whatsapp_webhook_url: string;
  whatsapp_api_token: string;
  whatsapp_grupo_id: string;
  email_api_url: string;
  email_api_token: string;
  email_remetente: string;
  nome_orgao: string;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Configuracao>({
    whatsapp_numero: "",
    whatsapp_webhook_url: "",
    whatsapp_api_token: "",
    whatsapp_grupo_id: "",
    email_api_url: "",
    email_api_token: "",
    email_remetente: "",
    nome_orgao: "Organização de Segurança",
  });
  const [loading, setLoading] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [testandoWhatsapp, setTestandoWhatsapp] = useState(false);
  const [testandoEmail, setTestandoEmail] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<"unchecked" | "success" | "error">("unchecked");
  const [emailStatus, setEmailStatus] = useState<"unchecked" | "success" | "error">("unchecked");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/configuracoes");
      const data = await response.json();
      if (data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error("Erro ao buscar config:", err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSalvo(false);
    try {
      const response = await fetch("/api/configuracoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        configurarNotificacoes({
          emailApiUrl: config.email_api_url,
          emailToken: config.email_api_token,
          emailFrom: config.email_remetente,
          nomeOrgao: config.nome_orgao,
        });
        configureWhatsApp({
          apiUrl: config.whatsapp_webhook_url,
          token: config.whatsapp_api_token,
          phoneNumberId: config.whatsapp_grupo_id,
        });
        setSalvo(true);
        setTimeout(() => setSalvo(false), 3000);
      }
    } catch (err) {
      console.error("Erro ao salvar:", err);
    } finally {
      setLoading(false);
    }
  };

  const testarWhatsApp = async () => {
    setTestandoWhatsapp(true);
    setWhatsappStatus("unchecked");
    try {
      const result = await verificarConexaoWhatsApp();
      setWhatsappStatus(result.success ? "success" : "error");
    } catch {
      setWhatsappStatus("error");
    } finally {
      setTestandoWhatsapp(false);
    }
  };

  const testarEmail = async () => {
    setTestandoEmail(true);
    setEmailStatus("unchecked");
    try {
      const result = await testarEnvioEmail(config.email_remetente);
      setEmailStatus(result.success ? "success" : "error");
    } catch {
      setEmailStatus("error");
    } finally {
      setTestandoEmail(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const webhookUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/api/whatsapp/webhook` 
    : "/api/whatsapp/webhook";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Settings className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações</h1>
          <p className="text-slate-400">Configure as integrações do sistema</p>
        </div>
      </div>

      {/* Geral */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Geral</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nome do Órgão
            </label>
            <input
              type="text"
              value={config.nome_orgao}
              onChange={(e) => setConfig({ ...config, nome_orgao: e.target.value })}
              placeholder="Nome da organização"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Este nome aparece nas notificações enviadas aos custodiados
            </p>
          </div>
        </div>
      </section>

      {/* WhatsApp */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <MessageCircle className="h-5 w-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">WhatsApp</h2>
          {whatsappStatus === "success" && (
            <span className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
              <CheckCircle className="h-3 w-3" /> Conectado
            </span>
          )}
          {whatsappStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-red-500 bg-red-500/10 px-2 py-1 rounded-full">
              <AlertTriangle className="h-3 w-3" /> Erro
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Número de Telefone (WhatsApp Business)
            </label>
            <input
              type="text"
              value={config.whatsapp_numero}
              onChange={(e) => setConfig({ ...config, whatsapp_numero: e.target.value })}
              placeholder="+55 61 99999-0000"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Token da API (Meta for Developers)
            </label>
            <input
              type="password"
              value={config.whatsapp_api_token}
              onChange={(e) => setConfig({ ...config, whatsapp_api_token: e.target.value })}
              placeholder="Seu token de acesso"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              ID do Grupo de Escala
            </label>
            <input
              type="text"
              value={config.whatsapp_grupo_id}
              onChange={(e) => setConfig({ ...config, whatsapp_grupo_id: e.target.value })}
              placeholder="ID numérico do grupo"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              URL do Webhook (somente leitura)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={webhookUrl}
                readOnly
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(webhookUrl, "webhook")}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              >
                {copied === "webhook" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Cadastre esta URL no Meta for Developers para receber mensagens do grupo
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <h4 className="font-medium text-blue-400 mb-2">Como configurar o webhook:</h4>
            <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
              <li>Acesse <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 inline-flex">Meta for Developers <ExternalLink className="h-3 w-3" /></a></li>
              <li>Crie um App do WhatsApp</li>
              <li>Configure o webhook com a URL acima</li>
              <li>Selecione os eventos: messages</li>
              <li>Copie o Token de verificação e cole acima</li>
            </ol>
          </div>

          <button
            onClick={testarWhatsApp}
            disabled={testandoWhatsapp || !config.whatsapp_api_token}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors disabled:opacity-50"
          >
            {testandoWhatsapp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Testar conexão
          </button>
        </div>
      </section>

      {/* E-mail */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">E-mail</h2>
          {emailStatus === "success" && (
            <span className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
              <CheckCircle className="h-3 w-3" /> Enviado
            </span>
          )}
          {emailStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-red-500 bg-red-500/10 px-2 py-1 rounded-full">
              <AlertTriangle className="h-3 w-3" /> Erro
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Endpoint da API de E-mail
            </label>
            <input
              type="text"
              value={config.email_api_url}
              onChange={(e) => setConfig({ ...config, email_api_url: e.target.value })}
              placeholder="https://api.resend.com"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Token da API de E-mail
            </label>
            <input
              type="password"
              value={config.email_api_token}
              onChange={(e) => setConfig({ ...config, email_api_token: e.target.value })}
              placeholder="re_xxxxx"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              E-mail Remetente
            </label>
            <input
              type="email"
              value={config.email_remetente}
              onChange={(e) => setConfig({ ...config, email_remetente: e.target.value })}
              placeholder="Sistema RESERVA <noreply@seudominio.com>"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={testarEmail}
            disabled={testandoEmail || !config.email_api_token || !config.email_remetente}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors disabled:opacity-50"
          >
            {testandoEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Enviar e-mail de teste
          </button>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {salvo ? "Salvo!" : "Salvar Configurações"}
        </button>
      </div>
    </div>
  );
}
