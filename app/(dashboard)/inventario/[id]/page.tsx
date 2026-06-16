import InventarioClient from "@/components/InventarioClient"
import { getInventarioById, listInventarios } from "@/app/actions/inventario"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function InventarioDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const [inventarios, selected] = await Promise.all([
    listInventarios(),
    getInventarioById(params.id),
  ])

  if (!selected) notFound()

  return <InventarioClient inventarios={inventarios} selected={selected} />
}
