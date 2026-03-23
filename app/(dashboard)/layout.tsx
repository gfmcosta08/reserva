import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  History, 
  LogOut, 
  ShieldAlert,
  ClipboardList
} from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // O middleware já protege as rotas, mas este check redundante
  // garante que temos o objeto user para renderizar as informações
  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl flex flex-col">
        <div className="flex h-16 items-center px-6 border-b border-slate-800">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/40">
              R
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              RESERVA
            </span>
          </Link>
        </div>
        
        <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
          <Link 
            href="/" 
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
          >
            <LayoutDashboard className="h-5 w-5 group-hover:text-blue-400 transition-colors" />
            Dashboard
          </Link>
          <Link 
            href="/materials" 
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
          >
            <Package className="h-5 w-5 group-hover:text-blue-400 transition-colors" />
            Materiais
          </Link>
          <Link 
            href="/persons" 
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
          >
            <Users className="h-5 w-5 group-hover:text-blue-400 transition-colors" />
            Pessoas
          </Link>
          <Link 
            href="/cautelas" 
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
          >
            <ClipboardList className="h-5 w-5 group-hover:text-blue-400 transition-colors" />
            Cautelas
          </Link>
          <Link 
            href="/history" 
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
          >
            <History className="h-5 w-5 group-hover:text-blue-400 transition-colors" />
            Histórico
          </Link>
          <div className="pt-4 pb-2 px-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Configurações</p>
          </div>
          <Link 
            href="/admin" 
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
          >
            <ShieldAlert className="h-5 w-5 group-hover:text-blue-400 transition-colors" />
            Administração
          </Link>
        </nav>

        <div className="border-t border-slate-800 p-4 bg-slate-900/30">
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/40 rounded-xl mb-4">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-900/20">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.email}</p>
              <p className="text-[10px] uppercase font-bold text-blue-500 tracking-wider">Operador</p>
            </div>
          </div>
          <form action="/auth/logout" method="POST">
            <button className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-red-950/20 hover:text-red-400 transition-all duration-200">
              <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
              Sair do Sistema
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 bg-slate-900/30 backdrop-blur-md flex items-center px-8 justify-between">
          <h2 className="text-sm font-medium text-slate-400">Ambiente de Produção</h2>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
               </span>
               <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Ativo</span>
             </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
