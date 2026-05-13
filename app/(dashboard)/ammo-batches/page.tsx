import { getAmmoBatches } from "@/app/actions/ammo-batches"
import AmmoBatchesClient from "@/components/AmmoBatchesClient"

export const dynamic = "force-dynamic"

export default async function AmmoBatchesPage() {
  const batches = await getAmmoBatches()

  return <AmmoBatchesClient initialBatches={batches} />
}
