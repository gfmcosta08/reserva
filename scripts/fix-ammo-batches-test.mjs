/**
 * Aplica SQL idempotente para ammo_batches + colunas phone/review_date no teste_db.
 * Uso: node scripts/fix-ammo-batches-test.mjs
 */
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, ".env.clone")

const env = {}
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const i = t.indexOf("=")
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const token = env.SUPABASE_ACCESS_TOKEN
const projectRef = env.SUPABASE_TEST_PROJECT_REF
if (!token || !projectRef) throw new Error("SUPABASE_ACCESS_TOKEN ou SUPABASE_TEST_PROJECT_REF ausente")

const idempotentSql = `
-- 1. phone on persons
ALTER TABLE persons ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. review_date on cautelas
ALTER TABLE cautelas ADD COLUMN IF NOT EXISTS review_date TIMESTAMPTZ;

-- 3. ammo_batches table
CREATE TABLE IF NOT EXISTS ammo_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibre TEXT NOT NULL,
  marca TEXT,
  quantity_total INTEGER NOT NULL DEFAULT 0,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  lot_number TEXT,
  acquisition_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ammo_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ammo_batches" ON ammo_batches;
DROP POLICY IF EXISTS "Authenticated users can insert ammo_batches" ON ammo_batches;
DROP POLICY IF EXISTS "Authenticated users can update ammo_batches" ON ammo_batches;

CREATE POLICY "Authenticated users can read ammo_batches"
  ON ammo_batches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert ammo_batches"
  ON ammo_batches FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update ammo_batches"
  ON ammo_batches FOR UPDATE TO authenticated USING (true);
`

console.log(`Applying idempotent ammo_batches fix to ${projectRef}...`)
const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: idempotentSql }),
  }
)
if (!res.ok) {
  const text = await res.text()
  throw new Error(`${res.status} ${text}`)
}
console.log("SQL applied OK")

// Verify table exists
const verifyRes = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'ammo_batches' ORDER BY ordinal_position;`,
    }),
  }
)
const verifyData = await verifyRes.json()
console.log("ammo_batches columns:", verifyData)

// Count materials, persons, cautelas on test and prod
const test = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const prod = createClient(env.SUPABASE_PROD_URL, env.SUPABASE_PROD_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function count(client, table) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true })
  if (error) return `ERROR: ${error.message}`
  return count
}

console.log("\n=== Counts teste_db ===")
for (const t of ["materials", "persons", "cautelas", "ammo_batches"]) {
  console.log(`  ${t}: ${await count(test, t)}`)
}

console.log("\n=== Counts prod ===")
for (const t of ["materials", "persons", "cautelas", "ammo_batches"]) {
  console.log(`  ${t}: ${await count(prod, t)}`)
}
