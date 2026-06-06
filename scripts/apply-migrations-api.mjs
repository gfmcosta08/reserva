import { readFileSync, readdirSync, existsSync } from "fs"
import { resolve, dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "..")
const envPath = resolve(__dirname, ".env.clone")
const projectRef = process.argv[2]
if (!projectRef) {
  console.error("Uso: node scripts/apply-migrations-api.mjs <PROJECT_REF>")
  process.exit(1)
}

const env = {}
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const i = t.indexOf("=")
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const token = env.SUPABASE_ACCESS_TOKEN
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente")

const dir = join(repoRoot, "supabase", "migrations")
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()

for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8")
  console.log(`Applying ${file} ...`)
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${file}: ${res.status} ${text}`)
  }
  console.log("  OK")
}
console.log(`Done: ${projectRef}`)
