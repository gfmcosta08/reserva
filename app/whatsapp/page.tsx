// ========================================
// ARQUIVO: src/app/whatsapp/page.tsx
// ========================================

"use client";

import { useEffect, useState } from "react";
import { 
  MessageCircle, 
  Send, 
  Image, 
  FileText, 
  Check, 
  AlertCircle,
  RefreshCw,
  Search,
  MoreVertical,
  Phone,
  Video,
  Paperclip
} from "lucide-react";
import { clsx } from "clsx";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEscalaStore } from "@/store/escalaStore";

export default function WhatsAppMonitorPage() {
  const {
    mensagens,
    grupos,
    grupoSelecionadoId,
    whatsappConectado,
    loading,
    error,
    fetchMensagens,
    processarMensagem,
    conectarWhatsApp,
    setGrupoSelecionado,
  } = useEscalaStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  useEffect(() => {
    conectarWhatsApp();
    fetchMensagens();
  }, []);

  const grupoSelecionado = grupos.find(g => g.id === grupoSelecionadoId);
  const mensagensFiltradas = searchTerm
    ? mensagens.filter(m => 
        m.conteudo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.remetente.includes(searchTerm)
      )
    : mensagens;

  const groupedMessages = mensagensFiltradas.reduce((acc, msg) => {
    const date = new Date(msg.timestamp);
    const key = isToday(date) ? "Hoje" : isYesterday(date) ? "Ontem" : format(date, "dd/MM/yyyy", { locale: ptBR });
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {} as Record<string, typeof mensagens>);

  const formatTimestamp = (date: Date) => {
    const d = new Date(date);
    if (isToday(d)) {
      return format(d, "HH:mm", { locale: ptBR });
    }
    return format(d, "dd/MM HH:mm", { locale: ptBR });
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-900">
      {/* Left Panel - Conversations List */}
      <div className="w-80 flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-950">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">WhatsApp</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <span className={clsx(
                  "w-2 h-2 rounded-full",
                  whatsappConectado ? "bg-green-500" : "bg-red-500"
                )} />
                {whatsappConectado ? "Conectado" : "Desconectado"}
              </p>
            </div>
            <button
              onClick={() => fetchMensagens()}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={clsx("h-5 w-5", loading && "animate-spin")} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar conversas..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {grupos.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              Nenhum grupo configurado
            </div>
          ) : (
            grupos.map((grupo) => (
              <button
                key={grupo.id}
                onClick={() => setGrupoSelecionado(grupo.id)}
                className={clsx(
                  "w-full p-4 flex items-start gap-3 hover:bg-slate-900 transition-colors text-left",
                  grupo.id === grupoSelecionadoId && "bg-slate-900 border-l-2 border-green-500"
                )}
              >
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white truncate">{grupo.nome}</p>
                  </div>
                  <p className="text-sm text-slate-500 truncate">
                    Grupo de escala de serviço
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Messages */}
      <div className="flex-1 flex flex-col bg-slate-900">
        {grupoSelecionado ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">{grupoSelecionado.nome}</h2>
                  <p className="text-xs text-slate-400">
                    {whatsappConectado ? "Conectado" : "Aguardando conexão..."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <Search className="h-5 w-5" />
                </button>
                <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  <div className="flex justify-center mb-4">
                    <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                      {date}
                    </span>
                  </div>
                  {msgs.map((msg) => (
                    <div
                      key={msg.id}
                      className={clsx(
                        "flex mb-3",
                        msg.tipo === "texto" ? "justify-start" : "justify-center"
                      )}
                    >
                      {msg.tipo === "texto" ? (
                        <div className={clsx(
                          "max-w-[70%] rounded-2xl p-3",
                          "bg-slate-800 text-slate-200"
                        )}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-green-400">
                              {msg.remetente}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                          <div className="flex items-center justify-end gap-2 mt-2">
                            <span className="text-xs text-slate-500">
                              {formatTimestamp(msg.timestamp)}
                            </span>
                            {msg.escala_extraida && (
                              <span className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                                <Check className="h-3 w-3" /> Escala extraída
                              </span>
                            )}
                            {!msg.processada && (
                              <button
                                onClick={() => processarMensagem(msg.id)}
                                className="text-xs text-blue-400 hover:text-blue-300"
                              >
                                Processar
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                          {msg.tipo === "documento" && (
                            <FileText className="h-8 w-8 text-slate-400" />
                          )}
                          {msg.tipo === "imagem" && (
                            <Image className="h-8 w-8 text-slate-400" />
                          )}
                          <p className="text-sm text-slate-300">{msg.conteudo}</p>
                          <div className="flex items-center gap-2">
                            {msg.escala_extraida ? (
                              <span className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
                                <Check className="h-3 w-3" /> Escala extraída
                              </span>
                            ) : (
                              <button
                                onClick={() => processarMensagem(msg.id)}
                                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                              >
                                <RefreshCw className="h-3 w-3" /> Processar agora
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <Paperclip className="h-5 w-5" />
                </button>
                <input
                  type="text"
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="p-2 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors">
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg">Selecione um grupo para ver as mensagens</p>
          </div>
        )}
      </div>
    </div>
  );
}
