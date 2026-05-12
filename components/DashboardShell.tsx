"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Users,
  History,
  LogOut,
  ShieldAlert,
  ClipboardList,
  Menu,
  X,
  AlertTriangle,
  Settings
} from "lucide-react"
import NotificationsDropdown from "./NotificationsDropdown"
import { createClient } from "@/lib/supabase-client"

interface DashboardShellProps {
  children: React.ReactNode
  user: {
    email?: string
    role?: string
  }
}

export default function DashboardShell({ children, user }: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  // Bloquear scroll do body quando sidebar aberta no mobile
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isSidebarOpen])

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const menuItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/materials", label: "Materiais", icon: Package },
    { href: "/persons", label: "Pessoas", icon: Users },
    { href: "/cautelas", label: "Cautelas", icon: ClipboardList },
    { href: "/history", label: "Histórico", icon: History },
    { href: "/reports/divergencias", label: "Divergências", icon: AlertTriangle },
  ]

  const systemItems = [
    { href: "/admin", label: "Administração", icon: ShieldAlert },
    { href: "/settings", label: "Configurações", icon: Settings },
  ]

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => (
    <Link
      href={href}
      className={`
        group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200
        ${pathname === href
          ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"}
      `}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  )

  return (
    <div className="flex h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Overlay para mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:shrink-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/40">
              R
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              RESERVA
            </span>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Nav — cresce e rola */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 overscroll-contain">
          {menuItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}

          <div className="pt-8 pb-2 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
            SISTEMA
          </div>

          {systemItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* Rodapé fixo: usuário + sair */}
        <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-950/50 rounded-2xl border border-slate-800/50 mb-3 shadow-inner">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-900/20 text-white">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.email?.split('@')[0]}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-80" style={{ color: user.role === 'supervisor' ? '#f59e0b' : '#3b82f6' }}>
                {user.role === 'supervisor' ? 'Supervisor' : 'Operador'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 disabled:opacity-50"
          >
            <LogOut className="h-5 w-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
            {loggingOut ? "Saindo..." : "Sair do Sistema"}
          </button>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden">
        <header className="h-16 shrink-0 border-b border-slate-800 bg-slate-900/30 backdrop-blur-md flex items-center px-4 lg:px-8 justify-between z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] hidden sm:block">
              Unidade de Comando <span className="text-slate-700 mx-2">|</span> <span className="text-blue-500/80">Monitorando</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <NotificationsDropdown />
            <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">Online</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain py-6 px-4 lg:px-8">
          <div className="mx-auto max-w-7xl pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
