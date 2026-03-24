import { getDashboardStats } from "@/app/actions/dashboard"
import ReportButton from "@/components/ReportButton"
import Link from "next/link"
import { 
  Package, 
  Users, 
  ClipboardCheck, 
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert
} from "lucide-react";

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-400 mt-2">Visão geral do arsenal e controle de materiais.</p>
        </div>
        <ReportButton />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total de Materiais" 
          value={String(stats.totalMaterials)} 
          icon={<Package className="h-6 w-6 text-blue-500" />}
          trend={`${stats.availableMaterials} disponíveis`}
          href="/reports/materials"
        />
        <StatsCard 
          title="Cautelas Ativas" 
          value={String(stats.openCautelas)} 
          icon={<ClipboardCheck className="h-6 w-6 text-green-500" />}
          trend={stats.dailyExpiring > 0 ? `⚠️ ${stats.dailyExpiring} vencendo hoje` : "Nenhuma vencendo"}
          alert={stats.dailyExpiring > 0}
          href="/reports/cautelas"
        />
        <StatsCard 
          title="Pessoas Cadastradas" 
          value={String(stats.totalPersons)} 
          icon={<Users className="h-6 w-6 text-purple-500" />}
          trend="Ativos no sistema"
          href="/persons"
        />
        <StatsCard 
          title="Alertas" 
          value={String(stats.divergentCautelas + stats.maintenanceMaterials)} 
          icon={<AlertTriangle className="h-6 w-6 text-amber-500" />}
          trend={`${stats.divergentCautelas} divergências • ${stats.maintenanceMaterials} manutenção`}
          alert={(stats.divergentCautelas + stats.maintenanceMaterials) > 0}
          href="/materials"
        />
      </div>

      {/* Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Atividades Recentes
          </h3>
          <div className="space-y-3">
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Nenhuma atividade registrada ainda.</p>
            ) : (
              stats.recentActivity.slice(0, 5).map((log: any) => (
                <ActivityItem 
                  key={log.id}
                  user={log.profiles?.name || log.profiles?.email || "Sistema"} 
                  action={formatAction(log.action)} 
                  entity={log.entity}
                  time={new Date(log.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  date={new Date(log.timestamp).toLocaleDateString("pt-BR")}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Status do Arsenal
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl border border-slate-800/50">
              <span className="text-sm font-medium">Disponibilidade Geral</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                stats.availability >= 70 ? "bg-green-500/10 text-green-500" :
                stats.availability >= 40 ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500"
              }`}>{stats.availability}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl border border-slate-800/50">
              <span className="text-sm font-medium">Materiais Cautelados</span>
              <span className="text-xs font-bold px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg">{stats.cauteladoMaterials}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl border border-slate-800/50">
              <span className="text-sm font-medium">Em Manutenção</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                stats.maintenanceMaterials > 0 ? "bg-amber-500/10 text-amber-500" : "bg-slate-500/10 text-slate-400"
              }`}>{stats.maintenanceMaterials}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl border border-slate-800/50">
              <span className="text-sm font-medium">Total de Cautelas</span>
              <span className="text-xs font-bold px-2 py-1 bg-slate-500/10 text-slate-400 rounded-lg">{stats.totalCautelas}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas de Cautelas em Atraso */}
      {stats.dailyExpiring > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-red-400">
            <ShieldAlert className="h-5 w-5" />
            Cautelas Diárias Vencidas
          </h3>
          <p className="text-sm text-red-400/70">
            Existem <span className="font-bold text-red-400">{stats.dailyExpiring}</span> cautela(s) diária(s) 
            abertas de dias anteriores. A devolução deveria ter sido realizada no mesmo dia.
          </p>
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value, icon, trend, alert, href }: any) {
  const CardContent = (
    <div className={`bg-slate-900/50 border p-6 rounded-2xl transition-all duration-300 ${
      alert ? "border-amber-500/30" : "border-slate-800"
    } ${href ? "hover:border-blue-500/50 hover:bg-slate-800/50" : ""}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-slate-800 rounded-xl">{icon}</div>
      </div>
      <div>
        <h4 className="text-3xl font-bold text-white">{value}</h4>
        <p className="text-xs font-medium text-slate-400 mt-1">{title}</p>
        <p className={`text-[10px] font-medium mt-3 ${alert ? "text-amber-400" : "text-blue-400"}`}>{trend}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block w-full cursor-pointer hover:-translate-y-1 transition-transform duration-300">
        {CardContent}
      </Link>
    );
  }
  return CardContent;
}

function ActivityItem({ user, action, entity, time, date }: any) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-slate-800/30 rounded-xl transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
          {user[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">{user}</p>
          <p className="text-xs text-slate-500">{action} <span className="text-blue-400">{entity}</span></p>
        </div>
      </div>
      <div className="text-right">
        <span className="text-[10px] font-medium text-slate-600 bg-slate-800/50 px-2 py-1 rounded-md block">{time}</span>
        <span className="text-[9px] text-slate-700 mt-0.5 block">{date}</span>
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    cautela_created: "Criou cautela",
    cautela_closed: "Fechou cautela",
    item_returned: "Devolveu item",
    item_damaged: "Registrou dano",
    item_missing: "Registrou extravio",
    person_created: "Cadastrou pessoa",
    person_updated: "Atualizou pessoa",
    material_created: "Cadastrou material",
    material_updated: "Atualizou material",
    material_status_changed: "Alterou status",
    correction_made: "Fez correção",
  }
  return map[action] || action
}
