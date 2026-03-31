/** Remove wildcards PostgREST e limita tamanho (mass assignment / DoS em filtros). */
export function sanitizeIlikeFragment(q: string, maxLen: number): string {
  return q.replace(/%/g, "").replace(/,/g, " ").trim().slice(0, maxLen)
}
