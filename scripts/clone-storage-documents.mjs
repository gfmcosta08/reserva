/**
 * Copia todos os objetos do bucket "documents" de produção para teste.
 *
 * Uso:
 *   node scripts/clone-storage-documents.mjs
 *
 * Requer scripts/.env.clone com:
 *   SUPABASE_PROD_URL, SUPABASE_PROD_SERVICE_ROLE_KEY
 *   SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, ".env.clone")

function loadEnvFile(path) {
  if (!existsSync(path)) {
    console.error(`Arquivo não encontrado: ${path}`)
    console.error("Copie scripts/env.clone.example para scripts/.env.clone")
    process.exit(1)
  }
  const env = {}
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

const env = loadEnvFile(envPath)
const required = [
  "SUPABASE_PROD_URL",
  "SUPABASE_PROD_SERVICE_ROLE_KEY",
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_SERVICE_ROLE_KEY",
]
for (const k of required) {
  if (!env[k]) {
    console.error(`Defina ${k} em scripts/.env.clone`)
    process.exit(1)
  }
}

const prod = createClient(env.SUPABASE_PROD_URL, env.SUPABASE_PROD_SERVICE_ROLE_KEY)
const test = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const BUCKET = "documents"

async function ensureBucket() {
  const { data: buckets } = await test.storage.listBuckets()
  if (buckets?.some((b) => b.name === BUCKET)) return
  const { error } = await test.storage.createBucket(BUCKET, { public: true })
  if (error) throw new Error(`Criar bucket teste: ${error.message}`)
  console.log(`Bucket "${BUCKET}" criado em teste.`)
}

async function listAll(prefix = "") {
  const out = []
  const { data, error } = await prod.storage.from(BUCKET).list(prefix, { limit: 1000 })
  if (error) throw error
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id == null) {
      out.push(...(await listAll(path)))
    } else {
      out.push(path)
    }
  }
  return out
}

async function main() {
  await ensureBucket()
  const paths = await listAll()
  console.log(`Objetos em produção: ${paths.length}`)
  let ok = 0
  let fail = 0
  for (const path of paths) {
    const { data: blob, error: dlErr } = await prod.storage.from(BUCKET).download(path)
    if (dlErr || !blob) {
      console.warn(`Download falhou: ${path}`, dlErr?.message)
      fail++
      continue
    }
    const buf = Buffer.from(await blob.arrayBuffer())
    const { error: upErr } = await test.storage.from(BUCKET).upload(path, buf, {
      upsert: true,
      contentType: blob.type || "application/octet-stream",
    })
    if (upErr) {
      console.warn(`Upload falhou: ${path}`, upErr.message)
      fail++
    } else {
      ok++
      if (ok % 50 === 0) console.log(`... ${ok} copiados`)
    }
  }
  console.log(`Concluído: ${ok} ok, ${fail} falhas`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
