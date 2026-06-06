import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const QA_ENV_PATH = resolve(__dirname, "../../.env.qa")
const DEFAULT_EMAIL = "qa.supervisor@reserva.test"

function readQaEnv(key) {
  const fromEnv = process.env[key]?.trim()
  if (fromEnv) return fromEnv
  if (!existsSync(QA_ENV_PATH)) return null
  const m = readFileSync(QA_ENV_PATH, "utf8").match(new RegExp(`^${key}=(.+)$`, "m"))
  return m?.[1]?.trim() || null
}

/** Resolve ID do operador QA (env → .env.qa → lookup auth por e-mail). */
export async function resolveQaOperatorId(supabase) {
  const fromEnv = readQaEnv("QA_SUPERVISOR_USER_ID")
  if (fromEnv) return fromEnv

  const email =
    readQaEnv("QA_SUPERVISOR_EMAIL") ||
    process.env.E2E_SUPERVISOR_EMAIL?.trim() ||
    DEFAULT_EMAIL

  const { data: list, error } = await supabase.auth.admin.listUsers({ perPage: 500 })
  if (error) throw error
  const user = list?.users?.find((u) => u.email === email)
  if (!user?.id) {
    throw new Error(
      `Operador QA não encontrado (${email}). Rode create-supervisor-test.mjs ou defina QA_SUPERVISOR_USER_ID.`
    )
  }
  return user.id
}
