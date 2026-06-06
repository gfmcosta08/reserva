import { Suspense } from "react"
import CautelasClient from "@/components/CautelasClient"

export default function CautelasPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500 text-sm">Carregando cautelas…</div>}>
      <CautelasClient />
    </Suspense>
  )
}
