export type VistoriaCautelaRow = {
  type: string
  status: string
  review_date: string | null
}

/** Vistoria anual vencida (cautela permanente aberta). */
export function isVistoriaOverdue(row: VistoriaCautelaRow, now = new Date()): boolean {
  if (row.type !== "permanent") return false
  if (!["open", "partial"].includes(row.status)) return false
  if (!row.review_date) return false
  return new Date(row.review_date).getTime() < now.getTime()
}

/** Vistoria nos próximos N dias (inclusive hoje se ainda não venceu). */
export function isVistoriaUpcoming(
  row: VistoriaCautelaRow,
  withinDays = 30,
  now = new Date()
): boolean {
  if (row.type !== "permanent") return false
  if (!["open", "partial"].includes(row.status)) return false
  if (!row.review_date) return false
  const review = new Date(row.review_date)
  if (review.getTime() < now.getTime()) return false
  const limit = new Date(now)
  limit.setDate(limit.getDate() + withinDays)
  return review.getTime() <= limit.getTime()
}

export function daysUntilReview(reviewDate: string, now = new Date()): number {
  const review = new Date(reviewDate)
  const diffMs = review.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export function daysOverdueReview(reviewDate: string, now = new Date()): number {
  const review = new Date(reviewDate)
  const diffMs = now.getTime() - review.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}
