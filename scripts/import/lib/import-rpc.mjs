import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseEnvFile(path) {
  const env = {}
  if (!existsSync(path)) return env
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

export function materialIsAvailable(m) {
  return m.status_atual === "DISPONIVEL" || m.status === "available"
}

export async function createAuthClient(cloneEnv) {
  const anonKey = cloneEnv.SUPABASE_TEST_ANON_KEY
  if (!anonKey) {
    throw new Error("SUPABASE_TEST_ANON_KEY ausente em scripts/.env.clone (necessário para RPC)")
  }

  const qaEnv = parseEnvFile(resolve(__dirname, "../../.env.qa"))
  const email = qaEnv.QA_SUPERVISOR_EMAIL || process.env.QA_SUPERVISOR_EMAIL
  const password = qaEnv.QA_SUPERVISOR_PASSWORD || process.env.QA_SUPERVISOR_PASSWORD
  if (!email || !password) {
    throw new Error("QA_SUPERVISOR_EMAIL/PASSWORD ausentes em scripts/.env.qa")
  }

  const client = createClient(cloneEnv.SUPABASE_TEST_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    throw new Error(`Login operador QA falhou: ${error?.message ?? "sem usuário"}`)
  }

  return { client, operatorAuthId: data.user.id }
}

export async function createCautelaViaRpc(authClient, { personId, notes, items }) {
  const payload = items.map((i) => ({
    material_id: i.material_id,
    quantity: i.quantity ?? 1,
  }))

  const { data, error } = await authClient.rpc("create_cautela_atomic", {
    p_person_id: personId,
    p_type: "permanent",
    p_notes: notes,
    p_items: payload,
  })

  if (error) return { ok: false, message: error.message }
  return { ok: true, cautelaId: data?.cautela_id ?? data?.cautelaId }
}

export async function appendCautelaItemViaRpc(authClient, admin, {
  cautelaId,
  personId,
  materialId,
  quantity,
}) {
  const { data: mat, error: matErr } = await admin
    .from("materials")
    .select("stock_quantity, status_atual, reserva_id")
    .eq("id", materialId)
    .single()

  if (matErr || !mat) return { ok: false, message: matErr?.message ?? "material não encontrado" }
  if (!materialIsAvailable(mat)) {
    return { ok: false, message: "material indisponível (status_atual)" }
  }

  const stock = mat.stock_quantity ?? 1
  if (stock < quantity) return { ok: false, message: "estoque insuficiente" }

  const { data: cautela, error: cErr } = await admin
    .from("cautelas")
    .select("organization_id, unit_id, reserva_id")
    .eq("id", cautelaId)
    .single()

  if (cErr || !cautela) return { ok: false, message: cErr?.message ?? "cautela não encontrada" }

  const { data: item, error: ciErr } = await authClient
    .from("cautela_items")
    .insert({
      cautela_id: cautelaId,
      material_id: materialId,
      status: "pending",
      quantity_delivered: quantity,
      organization_id: cautela.organization_id,
      unit_id: cautela.unit_id,
      reserva_id: cautela.reserva_id,
    })
    .select("id")
    .single()

  if (ciErr) return { ok: false, message: ciErr.message }

  const newStock = Math.max(0, stock - quantity)
  const statusNovo = newStock > 0 ? "DISPONIVEL" : "CAUTELADO_PERMANENTE"

  const { error: movErr } = await authClient.rpc("aplicar_movimentacao_material", {
    p_material_id: materialId,
    p_tipo: "CAUTELA_PERMANENTE",
    p_stock_novo: newStock,
    p_status_novo: statusNovo,
    p_quantidade: quantity,
    p_person_responsavel_id: newStock <= 0 ? personId : null,
    p_localizacao_nova: newStock <= 0 ? "EM_CAUTELA" : null,
    p_cautela_id: cautelaId,
    p_cautela_item_id: item.id,
    p_operador_id: null,
    p_observacao: "Importação legado 1º BPM (append)",
  })

  if (movErr) return { ok: false, message: movErr.message }
  return { ok: true, cautelaItemId: item.id }
}
