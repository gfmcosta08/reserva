// ========================================
// ARQUIVO: src/app/api/cautelas/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createCautelaInputSchema } from "@/lib/cautela-schemas";
import bcrypt from "bcryptjs";
import { logAudit } from "@/app/actions/audit";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  let query = supabase
    .from("cautelas")
    .select(`
      *,
      persons(id, full_name, rg, registration_number, function, rg_front_url, rg_back_url),
      profiles(name, email)
    `)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }
  if (search) {
    query = query.ilike("persons.full_name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cautelas: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    
    // Validar input
    const parsed = createCautelaInputSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg =
        (Object.values(first)[0] as string[] | undefined)?.[0] ||
        "Dados inválidos para abertura da cautela";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Verificar autenticação do operador
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { person_id, type, items, notes, pin, autenticacao_tipo } = parsed.data;

    // Validar PIN se fornecido
    if (pin) {
      const { data: person, error: personError } = await supabase
        .from("persons")
        .select("id, pin_hash, failed_pin_attempts, pin_locked_until")
        .eq("id", person_id)
        .single();

      if (personError || !person) {
        return NextResponse.json({ error: "Pessoa não encontrada" }, { status: 404 });
      }

      // Verificar bloqueio
      if (person.pin_locked_until) {
        const lockUntil = new Date(person.pin_locked_until);
        if (lockUntil > new Date()) {
          const minutesLeft = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
          return NextResponse.json(
            { error: `PIN bloqueado. Tente novamente em ${minutesLeft} minuto(s).` },
            { status: 423 }
          );
        }
      }

      // Verificar PIN
      const isValid = await bcrypt.compare(pin, person.pin_hash);
      if (!isValid) {
        const attempts = (person.failed_pin_attempts || 0) + 1;
        const update: Record<string, unknown> = { failed_pin_attempts: attempts };

        if (attempts >= 3) {
          const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
          update.pin_locked_until = lockUntil.toISOString();
        }

        await supabase.from("persons").update(update).eq("id", person_id);
        
        return NextResponse.json(
          { 
            error: attempts >= 3
              ? "PIN bloqueado por 30 minutos após 3 tentativas."
              : `PIN incorreto. ${3 - attempts} tentativa(s) restante(s).`
          },
          { status: 401 }
        );
      }

      // Resetar tentativas
      await supabase
        .from("persons")
        .update({ failed_pin_attempts: 0, pin_locked_until: null })
        .eq("id", person_id);
    }

    // Verificar disponibilidade dos materiais
    const materialIds = items.map(i => i.material_id);
    const { data: materials, error: matError } = await supabase
      .from("materials")
      .select("id, name, status")
      .in("id", materialIds);

    if (matError) {
      return NextResponse.json({ error: matError.message }, { status: 500 });
    }

    if (!materials || materials.length !== materialIds.length) {
      return NextResponse.json({ error: "Um ou mais materiais não foram encontrados" }, { status: 404 });
    }

    const unavailable = materials.filter(m => m.status !== "available");
    if (unavailable.length > 0) {
      const names = unavailable.map(m => m.name).join(", ");
      return NextResponse.json(
        { error: `Materiais não disponíveis: ${names}` },
        { status: 400 }
      );
    }

    // Calcular data de expiração
    let expiresAt = null;
    if (type === "daily" && body.expected_return_date) {
      expiresAt = body.expected_return_date;
    } else if (type === "daily") {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      expiresAt = date.toISOString();
    }

    // Criar cautela
    const { data: cautela, error: cautelaError } = await supabase
      .from("cautelas")
      .insert({
        person_id,
        operator_id: user.id,
        type,
        status: "open",
        notes: notes || null,
        autenticacao_tipo: autenticacao_tipo || (pin ? "pin" : "facial"),
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (cautelaError || !cautela) {
      return NextResponse.json({ error: cautelaError?.message || "Erro ao criar cautela" }, { status: 500 });
    }

    // Criar itens da cautela
    const cautelaItems = items.map(item => ({
      cautela_id: cautela.id,
      material_id: item.material_id,
      quantity_delivered: item.quantity || 1,
      status: "pending",
    }));

    const { error: itemsError } = await supabase
      .from("cautela_items")
      .insert(cautelaItems);

    if (itemsError) {
      // Rollback - deletar cautela
      await supabase.from("cautelas").delete().eq("id", cautela.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Atualizar status dos materiais
    for (const item of items) {
      await supabase.rpc("decrement_material_available", {
        material_id: item.material_id,
        amount: item.quantidade || 1,
      });
    }

    // Log de auditoria
    await logAudit({
      action: "cautela_created",
      entity: "cautelas",
      entity_id: cautela.id,
      after_state: {
        person_id,
        type,
        materials_count: items.length,
        items: cautelaItems,
      },
    });

    return NextResponse.json({ success: true, cautelaId: cautela.id });
  } catch (error) {
    console.error("Create cautela error:", error);
    return NextResponse.json({ error: "Erro interno ao criar cautela" }, { status: 500 });
  }
}
