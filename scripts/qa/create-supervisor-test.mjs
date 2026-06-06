/**
 * Cria supervisor de QA no teste_bd (idempotente).
 * Grava credenciais em scripts/.env.qa
 */
import { writeFileSync, existsSync, readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly, TEST_REF } from "../import/lib/env-clone.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const QA_ENV_PATH = resolve(__dirname, "../.env.qa")

const EMAIL = "qa.supervisor@reserva.test"
const PASSWORD = "ReservaQA2026!Super"
const NAME = "QA Supervisor Teste"

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const key = env.SUPABASE_TEST_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_TEST_SERVICE_ROLE_KEY ausente")

  const supabase = createClient(env.SUPABASE_TEST_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let userId = null

  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 500 })
  const existing = list?.users?.find((u) => u.email === EMAIL)
  if (existing) {
    userId = existing.id
    await supabase.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
    })
    console.log(`Usuário existente atualizado: ${EMAIL}`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: NAME },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`Usuário criado: ${EMAIL}`)
  }

  const { error: pErr } = await supabase.from("profiles").upsert({
    id: userId,
    email: EMAIL,
    name: NAME,
    role: "supervisor",
    is_active: true,
  })
  if (pErr) throw pErr
  console.log(`Profile supervisor OK (${userId})`)

  const lines = [
    "# Gerado por scripts/qa/create-supervisor-test.mjs — não commitar",
    `QA_SUPERVISOR_EMAIL=${EMAIL}`,
    `QA_SUPERVISOR_PASSWORD=${PASSWORD}`,
    `QA_SUPERVISOR_USER_ID=${userId}`,
    `QA_SUPERVISOR_NAME=${NAME}`,
    `QA_SUPABASE_REF=${TEST_REF}`,
    "",
  ]
  writeFileSync(QA_ENV_PATH, lines.join("\n"), "utf8")
  console.log(`Credenciais salvas em ${QA_ENV_PATH}`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
