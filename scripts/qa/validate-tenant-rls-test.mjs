/**
 * Valida isolamento por unidade (Etapa 1 tenancy) no teste_db.
 * Operador da unidade 1BPM não deve enxergar material da unidade QAISO.
 *
 *   node scripts/qa/validate-tenant-rls-test.mjs
 */
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const admin = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  const { data: org } = await admin.from("organizations").select("id").eq("slug", "1bpm").single()
  if (!org) throw new Error("Org 1bpm não encontrada — rode migration etapa1")

  const { data: unit1 } = await admin
    .from("units")
    .select("id")
    .eq("organization_id", org.id)
    .eq("code", "1BPM")
    .single()

  let { data: unit2 } = await admin
    .from("units")
    .select("id")
    .eq("organization_id", org.id)
    .eq("code", "QAISO")
    .maybeSingle()

  if (!unit2) {
    const { data: created, error } = await admin
      .from("units")
      .insert({ organization_id: org.id, name: "QA Isolamento", code: "QAISO" })
      .select("id")
      .single()
    if (error) throw error
    unit2 = created
  }

  const ghostPat = `PAT-QA-ISO-${Date.now()}`
  const { data: reservaQaiso } = await admin
    .from("reservas")
    .select("id")
    .eq("unit_id", unit2.id)
    .eq("code", "RES-QAISO")
    .single()

  if (!reservaQaiso) throw new Error("RES-QAISO ausente — rode migration reservas")

  const { data: reserva1bpm } = await admin
    .from("reservas")
    .select("id")
    .eq("code", "RES-1BPM")
    .single()

  const { data: ghostMat, error: ghostErr } = await admin
    .from("materials")
    .insert({
      name: "MATERIAL FANTASMA QA ISO",
      category: "GERAL",
      patrimony_number: ghostPat,
      internal_code: ghostPat,
      status: "available",
      stock_quantity: 1,
      organization_id: org.id,
      unit_id: unit2.id,
      reserva_id: reservaQaiso.id,
    })
    .select("id")
    .single()
  if (ghostErr) throw ghostErr

  const testEmail = `qa-operator-iso-${Date.now()}@reserva.test`
  const testPassword = "ReservaQA2026!OperIso"
  const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  })
  if (createErr) throw createErr

  const uid = authUser.user.id
  await admin.from("profiles").insert({
    id: uid,
    name: "QA Operator Isolamento",
    email: testEmail,
    role: "operator",
    is_active: true,
  })
  await admin.from("usuarios").insert({
    auth_user_id: uid,
    organization_id: org.id,
    unit_id: unit1.id,
    reserva_id: reserva1bpm.id,
    role: "operator",
    is_active: true,
  })

  const anon = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_ANON_KEY)
  const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })
  if (signErr) throw signErr

  const userClient = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  })

  const { data: visible, error: visErr } = await userClient
    .from("materials")
    .select("id")
    .eq("id", ghostMat.id)
  if (visErr) throw visErr

  const leaked = (visible ?? []).length > 0

  await admin.from("materials").delete().eq("id", ghostMat.id)
  await admin.from("usuarios").delete().eq("auth_user_id", uid)
  await admin.from("profiles").delete().eq("id", uid)
  await admin.auth.admin.deleteUser(uid)

  console.log("\n=== Validação tenancy Etapa 1 (teste_db) ===\n")
  console.log(`Operador reserva RES-1BPM: ${reserva1bpm.id}`)
  console.log(`Material na reserva RES-QAISO: ${reservaQaiso.id}`)

  if (leaked) {
    console.error("\n❌ FALHA: operador RES-1BPM enxergou material de outra reserva")
    process.exit(1)
  }

  console.log("\n✓ RLS OK — operador não vê material de outra reserva")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
