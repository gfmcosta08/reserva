"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
  AlertTriangle
} from "lucide-react"
import NotificationsDropdown from "./NotificationsDropdown"

interface DashboardShellProps {
  children: React.ReactNode
  user: {
    email?: string
    role?: string
  }
}

export default function DashboardShell({ children, user }: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Fechar sidebar ao mudar de página (no celular)
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  const menuItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/materials", label: "Materiais", icon: Package },
    { href: "/persons", label: "Pessoas", icon: Users },
    { href: "/cautelas", label: "Cautelas", icon: ClipboardList },
    { href: "/history", label: "Histórico", icon: History },
    { href: "/reports/divergencias", label: "Divergências", icon: AlertTriangle },
  ]

  const adminItems = [
    { href: "/admin", label: "Administração", icon: ShieldAlert },
  ]

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Overlay para mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
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
            className="lg:hidden p-2 text-slate-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
          {menuItems.map((item) => (
            <Link 
              key={item.href}
              href={item.href} 
              className={`
                group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200
                ${pathname === item.href 
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"}
              `}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}

          <div className="pt-8 pb-2 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
            SISTEMA
          </div>

          {adminItems.map((item) => (
            <Link 
              key={item.href}
              href={item.href} 
              className={`
                group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200
                ${pathname === item.href 
                  ? "bg-slate-800 text-white" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"}
              `}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-950/50 rounded-2xl border border-slate-800/50 mb-4 shadow-inner">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-900/20 text-white">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user.email?.split('@')[0]}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-80" style={{ color: user.role === 'supervisor' ? '#f59e0b' : '#3b82f6' }}>
                {user.role === 'supervisor' ? 'Supervisor' : 'Operador'}
              </p>
            </div>
          </div>
          <form action="/auth/logout" method="POST">
            <button className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300">
              <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
              Sair do Sistema
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
        <header className="h-16 border-b border-slate-800 bg-slate-900/30 backdrop-blur-md flex items-center px-4 lg:px-8 justify-between sticky top-0 z-30">
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
          
          <div className="flex items-center gap-4">
             <NotificationsDropdown />
             <div className="h-8 w-[1px] bg-slate-800 mx-2 hidden sm:block" />
             <div className="flex items-center gap-2">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
               </span>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden xs:block">Online</span>
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-hide py-6 px-4 lg:px-8">
          <div className="mx-auto max-w-7xl pb-20 lg:pb-8">
            {children}
          </div>
        </main>

        {/* Bottom Nav for Mobile (Optional Visual Polish) */}
        {/*
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl h-16 flex items-center justify-around px-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-40">
           ... links rápidos ...
        </div>
        */}
      </div>
    </div>
  )
}
