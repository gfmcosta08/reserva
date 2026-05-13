import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { exportMaterialsToExcel } from "@/lib/excel"

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.from("materials").select("*").order("name")
  const buffer = exportMaterialsToExcel(data || [])
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="materiais-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
