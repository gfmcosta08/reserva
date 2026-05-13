import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { exportDivergenciasToExcel } from "@/lib/excel"

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("cautelas")
    .select(`
      *,
      persons(full_name, rg, registration_number, function),
      profiles(name, email),
      cautela_items(
        id, status, quantity_delivered, quantity_returned, returned_at, notes,
        materials(name, patrimony_number, internal_code, category)
      )
    `)
    .eq("status", "divergent")
    .order("created_at", { ascending: false })

  const buffer = exportDivergenciasToExcel(data || [])
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="divergencias-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
