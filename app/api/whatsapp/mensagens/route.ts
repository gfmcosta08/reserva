// ========================================
// ARQUIVO: src/app/api/whatsapp/mensagens/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const grupoId = searchParams.get("grupo_id");
  const processada = searchParams.get("processada");

  let query = supabase
    .from("mensagens_whatsapp")
    .select("*")
    .order("timestamp", { ascending: true });

  if (grupoId) {
    query = query.eq("grupo_id", grupoId);
  }
  if (processada !== null && processada !== undefined) {
    query = query.eq("processada", processada === "true");
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Buscar grupos únicos
  const { data: grupos } = await supabase
    .from("mensagens_whatsapp")
    .select("grupo_id")
    .order("timestamp", { ascending: false });

  const gruposUnicos = [...new Set(grupos?.map(g => g.grupo_id) || [])].map(id => ({
    id,
    nome: `Grupo ${id.slice(-4)}`,
  }));

  return NextResponse.json({ mensagens: data || [], grupos: gruposUnicos });
}
