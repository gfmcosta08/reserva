"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, AlertTriangle, ShieldAlert, Wrench, CalendarClock, X, Check } from "lucide-react"
import { getNotifications, type Notification } from "@/app/actions/notifications"
import Link from "next/link"

const SEVERITY_CONFIG = {
  critical: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: ShieldAlert,
    iconColor: "text-red-500",
    dot: "bg-red-500",
    badge: "bg-red-500",
  },
  warning: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: Wrench,
    iconColor: "text-amber-500",
    dot: "bg-amber-500",
    badge: "bg-amber-500",
  },
  info: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: CalendarClock,
    iconColor: "text-blue-500",
    dot: "bg-blue-500",
    badge: "bg-blue-500",
  },
}

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Carregar notificações
  const loadNotifications = async () => {
    setLoading(true)
    try {
      const data = await getNotifications()
      setNotifications(data)
    } catch (error) {
      console.error("Erro ao carregar notificações:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen])

  // Filtrar notificações não dispensadas
  const visibleNotifications = notifications.filter(n => !dismissed.has(n.id))
  const totalUnread = visibleNotifications.reduce((sum, n) => sum + n.count, 0)

  const dismissNotification = (id: string) => {
    setDismissed(prev => new Set([...prev, id]))
  }

  const clearAll = () => {
    setDismissed(new Set(notifications.map(n => n.id)))
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do sino */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors relative rounded-lg hover:bg-slate-800"
      >
        <Bell className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1 ${SEVERITY_CONFIG.critical.badge}`}>
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/80">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Notificações</h3>
              {totalUnread > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 rounded">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {visibleNotifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] font-medium text-slate-500 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                >
                  Limpar tudo
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Lista de notificações */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                  <Bell className="h-6 w-6 text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-400">Nenhuma notificação</p>
                <p className="text-xs text-slate-600 mt-1">Sistema operando normalmente</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {visibleNotifications.map((notification) => {
                  const config = SEVERITY_CONFIG[notification.severity]
                  const Icon = config.icon
                  return (
                    <div
                      key={notification.id}
                      className={`relative p-4 hover:bg-slate-800/50 transition-colors ${config.bg}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${config.bg} ${config.border} border`}>
                          <Icon className={`h-4 w-4 ${config.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{notification.title}</h4>
                            {notification.count > 1 && (
                              <span className={`px-1.5 py-0.5 text-[10px] font-bold text-white rounded ${config.badge}`}>
                                {notification.count}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{notification.message}</p>
                          {notification.href && (
                            <Link
                              href={notification.href}
                              onClick={() => setIsOpen(false)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 mt-2"
                            >
                              Ver detalhes
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            dismissNotification(notification.id)
                          }}
                          className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors flex-shrink-0"
                          title="Dispensar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {visibleNotifications.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-700 bg-slate-900/80">
              <p className="text-[10px] text-slate-500 text-center">
                Atualizado em {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
