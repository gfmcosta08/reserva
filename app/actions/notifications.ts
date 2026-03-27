"use server"

import { createClient } from "@/lib/supabase-server"

export interface Notification {
  id: string
  type: "daily_expiring" | "divergent" | "maintenance" | "cautela_return_today"
  title: string
  message: string
  severity: "critical" | "warning" | "info"
  count: number
  href?: string
  created_at: string
}

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient()
  const notifications: Notification[] = []

  // 1. Cautelas diárias vencidas (CRÍTICAS)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: dailyExpired, count: dailyCount } = await supabase
    .from("cautelas")
    .select("*, persons(full_name)", { count: "exact" })
    .eq("type", "daily")
    .in("status", ["open", "partial"])
    .lt("created_at", today.toISOString())

  if (dailyCount && dailyCount > 0) {
    notifications.push({
      id: "daily_expired",
      type: "daily_expiring",
      title: "Cautelas Diárias Vencidas",
      message: `${dailyCount} cautela(s) diária(s) com devolução atrasada`,
      severity: "critical",
      count: dailyCount,
      href: "/reports/cautelas",
      created_at: today.toISOString(),
    })
  }

  // 2. Cautelas divergentes
  const { count: divergentCount, data: divergentData } = await supabase
    .from("cautelas")
    .select("*, persons(full_name)", { count: "exact" })
    .eq("status", "divergent")

  if (divergentCount && divergentCount > 0) {
    notifications.push({
      id: "divergent",
      type: "divergent",
      title: "Cautelas Divergentes",
      message: `${divergentCount} cautela(s) com divergências detectadas`,
      severity: "critical",
      count: divergentCount,
      href: "/reports/cautelas",
      created_at: today.toISOString(),
    })
  }

  // 3. Materiais em manutenção
  const { count: maintenanceCount } = await supabase
    .from("materials")
    .select("*", { count: "exact" })
    .eq("status", "maintenance")

  if (maintenanceCount && maintenanceCount > 0) {
    notifications.push({
      id: "maintenance",
      type: "maintenance",
      title: "Materiais em Manutenção",
      message: `${maintenanceCount} material(is) em manutenção`,
      severity: "warning",
      count: maintenanceCount,
      href: "/materials",
      created_at: today.toISOString(),
    })
  }

  // 4. Cautelas que vencem hoje (info)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: expiringToday } = await supabase
    .from("cautelas")
    .select("*, persons(full_name)")
    .in("status", ["open", "partial"])
    .gte("expected_return_date", today.toISOString())
    .lt("expected_return_date", tomorrow.toISOString())

  if (expiringToday && expiringToday.length > 0) {
    notifications.push({
      id: "return_today",
      type: "cautela_return_today",
      title: "Devoluções Hoje",
      message: `${expiringToday.length} cautela(s) com devolução prevista para hoje`,
      severity: "info",
      count: expiringToday.length,
      href: "/reports/cautelas",
      created_at: today.toISOString(),
    })
  }

  // Ordenar por severidade (critical > warning > info)
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return notifications
}

export async function getUnreadNotificationCount(): Promise<number> {
  const notifications = await getNotifications()
  return notifications.reduce((sum, n) => sum + n.count, 0)
}
