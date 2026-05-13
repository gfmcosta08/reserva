import { getAlerts } from "@/app/actions/alerts"
import Link from "next/link"
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
} from "lucide-react"

export default async function AlertsPage() {
  const alerts = await getAlerts()

  const totalAlerts =
    alerts.overdueDaily.length +
    alerts.openDivergences.length +
    alerts.upcomingReviews.length

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Bell className="h-8 w-8 text-blue-500" />
            Central de Alertas
          </h1>
          <p className="text-slate-400 mt-2">
            Monitoramento de cautelas vencidas, divergências e revisões pendentes.
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <div
        className={`rounded-2xl border p-6 flex items-center gap-6 ${
          totalAlerts > 0
            ? "bg-amber-500/5 border-amber-500/20"
            : "bg-green-500/5 border-green-500/20"
        }`}
      >
        {totalAlerts > 0 ? (
          <AlertTriangle className="h-10 w-10 text-amber-400 shrink-0" />
        ) : (
          <CheckCircle2 className="h-10 w-10 text-green-400 shrink-0" />
        )}
        <div>
          <p className="text-2xl font-bold text-white">
            {totalAlerts === 0
              ? "Nenhum alerta ativo"
              : `${totalAlerts} alerta${totalAlerts > 1 ? "s" : ""} ativo${totalAlerts > 1 ? "s" : ""}`}
          </p>
          <p className={`text-sm mt-1 ${totalAlerts > 0 ? "text-amber-400/80" : "text-green-400/80"}`}>
            {totalAlerts > 0
              ? `${alerts.overdueDaily.length} vencidas • ${alerts.openDivergences.length} divergências • ${alerts.upcomingReviews.length} revisões`
              : "Todos os itens estão dentro do prazo e sem pendências."}
          </p>
        </div>
      </div>

      {/* Section 1: Overdue Daily Cautelas */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-semibold text-white">Cautelas Diárias Vencidas</h2>
          </div>
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${
              alerts.overdueDaily.length > 0
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {alerts.overdueDaily.length}
          </span>
        </div>

        {alerts.overdueDaily.length === 0 ? (
          <div className="flex items-center gap-2 px-6 py-8 text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm">Nenhuma cautela diária vencida.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-500 border-b border-slate-800">
                  <th className="px-6 py-3 text-left font-medium">Pessoa</th>
                  <th className="px-6 py-3 text-left font-medium">RG</th>
                  <th className="px-6 py-3 text-left font-medium">Data Criação</th>
                  <th className="px-6 py-3 text-left font-medium">Itens Pendentes</th>
                  <th className="px-6 py-3 text-left font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {alerts.overdueDaily.map((cautela) => (
                  <tr
                    key={cautela.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-white">{cautela.person_name}</td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">{cautela.person_rg}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(cautela.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold px-2 py-1 rounded-lg">
                        {cautela.items_pending} / {cautela.items_count}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/cautelas/${cautela.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Ver cautela
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: Open Divergences */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Divergências Abertas</h2>
          </div>
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${
              alerts.openDivergences.length > 0
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {alerts.openDivergences.length}
          </span>
        </div>

        {alerts.openDivergences.length === 0 ? (
          <div className="flex items-center gap-2 px-6 py-8 text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm">Nenhuma divergência em aberto.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-500 border-b border-slate-800">
                  <th className="px-6 py-3 text-left font-medium">Material</th>
                  <th className="px-6 py-3 text-left font-medium">Patrimônio</th>
                  <th className="px-6 py-3 text-left font-medium">Pessoa</th>
                  <th className="px-6 py-3 text-left font-medium">Descrição</th>
                  <th className="px-6 py-3 text-left font-medium">Data</th>
                  <th className="px-6 py-3 text-left font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {alerts.openDivergences.map((div) => (
                  <tr
                    key={div.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-white">{div.material_name}</td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                      {div.patrimony_number ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{div.person_name}</td>
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate" title={div.description}>
                      {div.description}
                    </td>
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                      {new Date(div.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={div.cautela_id ? `/cautelas/${div.cautela_id}` : "/reports/divergencias"}
                        className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        Ver cautela
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-slate-800">
              <Link
                href="/reports/divergencias"
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
              >
                Ver relatório completo de divergências
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Upcoming Reviews */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">
              Revisões Pendentes (Cautelas Permanentes)
            </h2>
          </div>
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${
              alerts.upcomingReviews.length > 0
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {alerts.upcomingReviews.length}
          </span>
        </div>

        {alerts.upcomingReviews.length === 0 ? (
          <div className="flex items-center gap-2 px-6 py-8 text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm">Nenhuma revisão pendente.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-500 border-b border-slate-800">
                  <th className="px-6 py-3 text-left font-medium">Pessoa</th>
                  <th className="px-6 py-3 text-left font-medium">Tipo</th>
                  <th className="px-6 py-3 text-left font-medium">Data de Revisão</th>
                  <th className="px-6 py-3 text-left font-medium">Dias Restantes</th>
                  <th className="px-6 py-3 text-left font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {alerts.upcomingReviews.map((review) => {
                  const reviewDate = new Date(review.review_date)
                  const now = new Date()
                  const diffMs = reviewDate.getTime() - now.getTime()
                  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

                  const urgencyClass =
                    daysRemaining < 7
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : daysRemaining < 15
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"

                  return (
                    <tr
                      key={review.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-white">{review.person_name}</td>
                      <td className="px-6 py-4 text-slate-400 capitalize">
                        {review.type === "permanent" ? "Permanente" : "Diária"}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {reviewDate.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${urgencyClass}`}
                        >
                          <Clock className="h-3 w-3" />
                          {daysRemaining === 0
                            ? "Hoje"
                            : daysRemaining === 1
                            ? "1 dia"
                            : `${daysRemaining} dias`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/cautelas/${review.id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Ver cautela
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
