import { 
  Package, 
  Users, 
  ClipboardCheck, 
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-slate-400 mt-2">Visão geral do arsenal e controle de materiais.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total de Materiais" 
          value="142" 
          icon={<Package className="h-6 w-6 text-blue-500" />}
          trend="+4 novos este mês"
        />
        <StatsCard 
          title="Cautelas Ativas" 
          value="28" 
          icon={<ClipboardCheck className="h-6 w-6 text-green-500" />}
          trend="8 vencendo hoje"
        />
        <StatsCard 
          title="Pessoas Cadastradas" 
          value="86" 
          icon={<Users className="h-6 w-6 text-purple-500" />}
          trend="2 novos registros"
        />
        <StatsCard 
          title="Alertas de Manutenção" 
          value="3" 
          icon={<AlertTriangle className="h-6 w-6 text-amber-500" />}
          trend="Revisão pendente"
        />
      </div>

      {/* Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Atividades Recentes
          </h3>
          <div className="space-y-4">
            <ActivityItem 
              user="Maj. Roberto Silva" 
              action="Cautelou" 
              item="Glock G17 - Gen 5" 
              time="14:20" 
            />
            <ActivityItem 
              user="Cap. Ana Mendes" 
              action="Devolveu" 
              item="Colete Balístico IIIA" 
              time="12:45" 
            />
            <ActivityItem 
              user="Sgt. Duarte" 
              action="Cautelou" 
              item="Carabina IA2" 
              time="09:30" 
            />
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Status da Reserva
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl border border-slate-800/50">
              <span className="text-sm font-medium">Disponibilidade Geral</span>
              <span className="text-xs font-bold px-2 py-1 bg-green-500/10 text-green-500 rounded-lg">82%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl border border-slate-800/50">
              <span className="text-sm font-medium">Verificação de Arsenal</span>
              <span className="text-xs font-bold px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg">Realizada Hoje</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl border border-slate-800/50">
              <span className="text-sm font-medium">Alertas de Segurança</span>
              <span className="text-xs font-bold px-2 py-1 bg-slate-500/10 text-slate-400 rounded-lg">Nenhum</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon, trend }: any) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-blue-500/30 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-slate-800 rounded-xl">{icon}</div>
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mês Atual</span>
      </div>
      <div>
        <h4 className="text-3xl font-bold text-white">{value}</h4>
        <p className="text-xs font-medium text-slate-400 mt-1">{title}</p>
        <p className="text-[10px] text-blue-400 font-medium mt-3">{trend}</p>
      </div>
    </div>
  );
}

function ActivityItem({ user, action, item, time }: any) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-slate-800/30 rounded-xl transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
          {user[0]}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">{user}</p>
          <p className="text-xs text-slate-500">{action} <span className="text-blue-400">{item}</span></p>
        </div>
      </div>
      <span className="text-[10px] font-medium text-slate-600 bg-slate-800/50 px-2 py-1 rounded-md">{time}</span>
    </div>
  );
}
