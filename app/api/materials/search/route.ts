// ========================================
// ARQUIVO: src/app/api/materials/search/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async class GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (query.length < 1) {
    return NextResponse.json({ materials: [] });
  }

  const { data, error } = await supabase
    .from("materials")
    .select(`
      id,
      name,
      patrimony_number,
      serial_number,
      internal_code,
      caliber,
      status,
      category_id,
      subcategoria,
      categories(name)
    `)
    .eq("status", "available")
    .or(
      `name.ilike.%${query}%,patrimony_number.ilike.%${query}%,internal_code.ilike.%${query}%,serial_number.ilike.%${query}%`
    )
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ materials: data || [] });
}
