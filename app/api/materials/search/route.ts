// ========================================
// ARQUIVO: src/app/api/materials/search/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const categoriesParam = searchParams.get("categories");
  const categories = (categoriesParam ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (query.length < 1) {
    return NextResponse.json({ materials: [] });
  }

  let queryBuilder = supabase
    .from("materials")
    .select(`
      id,
      name,
      patrimony_number,
      serial_number,
      internal_code,
      caliber,
      status,
      subcategoria,
      categories
    `)
    .eq("status", "available")
    .or(
      `name.ilike.%${query}%,patrimony_number.ilike.%${query}%,internal_code.ilike.%${query}%,serial_number.ilike.%${query}%`
    )
  if (categories.length > 0) {
    queryBuilder = queryBuilder.in("categories", categories);
  }
  const { data, error } = await queryBuilder.limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ materials: data || [] });
}
