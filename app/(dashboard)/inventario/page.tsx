import InventarioClient from "@/components/InventarioClient"
import { listInventarios } from "@/app/actions/inventario"

export const dynamic = "force-dynamic"

export default async function InventarioPage() {
  const inventarios = await listInventarios()
  return <InventarioClient inventarios={inventarios} />
}
