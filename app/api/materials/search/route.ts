// ========================================
// ARQUIVO: src/app/api/materials/search/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

function isMissingCategoriesColumnError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return /column .*categories.* does not exist/i.test(message);
}

function normalizeCategory(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "Sem Categoria";
}

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
  let { data, error } = await queryBuilder.limit(20);

  if (error && isMissingCategoriesColumnError(error)) {
    let legacyBuilder = supabase
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
        category
      `)
      .eq("status", "available")
      .or(
        `name.ilike.%${query}%,patrimony_number.ilike.%${query}%,internal_code.ilike.%${query}%,serial_number.ilike.%${query}%`
      );

    if (categories.length > 0) {
      legacyBuilder = legacyBuilder.in("category", categories);
    }

    const fallback = await legacyBuilder.limit(20);
    data = fallback.data as any;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const materials = (data || []).map((material: any) => ({
    ...material,
    categories: normalizeCategory(material?.categories ?? material?.category),
  }));

  return NextResponse.json({ materials });
}
