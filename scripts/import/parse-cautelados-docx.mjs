/**
 * Extrai linhas de cautelados de DOCX ou CSV → JSON normalizado.
 *
 * Uso:
 *   node scripts/import/parse-cautelados-docx.mjs
 *   node scripts/import/parse-cautelados-docx.mjs --input scripts/import/cautelados-1bpm-atualizada.docx
 */
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { spawnSync } from "child_process"
import { parseCsvContent, rowFromColumns, rowFromDocxColumns } from "./lib/parse-rows.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUT = resolve(__dirname, "cautelados-1bpm.parsed.json")

function parseArgs() {
  const args = process.argv.slice(2)
  let input = null
  let out = DEFAULT_OUT
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) input = resolve(args[++i])
    if (args[i] === "--out" && args[i + 1]) out = resolve(args[++i])
  }
  if (!input) {
    const csvLocal = resolve(__dirname, "cautelados-1bpm-source.csv")
    const csvPub = resolve(__dirname, "../../public/cautelas_permanentes.csv")
    const docx = resolve(__dirname, "cautelados-1bpm-atualizada.docx")
    if (existsSync(csvLocal)) input = csvLocal
    else if (existsSync(csvPub)) input = csvPub
    else if (existsSync(docx)) input = docx
    else throw new Error("Nenhuma fonte. Coloque DOCX/CSV em scripts/import/ ou use --input")
  }
  return { input, out }
}

function extractDocxTables(docxPath) {
  const pyScript = resolve(__dirname, "parse-docx-tables.py")
  const proc = spawnSync("python", [pyScript, docxPath], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
  if (proc.status !== 0) {
    throw new Error(proc.stderr || "Falha ao executar parse-docx-tables.py")
  }
  const tableRows = JSON.parse(proc.stdout)
  const rows = []
  const skipped = []
  let section = "Geral"
  for (const { lineNo, cols } of tableRows) {
    const joined = cols.join(" ").toUpperCase()
    if (cols.length === 1 && cols[0].length > 8 && !cols[0].match(/^\d/)) {
      if (joined.includes("PISTOL") || joined.includes("COLETE") || joined.includes("TAURUS") || joined.includes("IMBEL")) {
        section = cols[0].trim()
      }
      skipped.push({ skip: true, reason: "secao", lineNo, section })
      continue
    }
    const row = rowFromDocxColumns(cols, lineNo, section)
    if (row.skip) skipped.push({ ...row, source: "docx" })
    else rows.push({ ...row, source: "docx", section })
  }
  if (rows.length === 0) throw new Error("DOCX sem linhas CAUTELADO válidas")
  return { rows, skipped, format: "docx" }
}

function main() {
  const { input, out } = parseArgs()
  let result
  if (input.toLowerCase().endsWith(".csv")) {
    result = { ...parseCsvContent(readFileSync(input, "utf8")), format: "csv" }
  } else if (input.toLowerCase().endsWith(".docx")) {
    result = extractDocxTables(input)
  } else {
    throw new Error(`Formato não suportado: ${input}`)
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceFile: input,
    format: result.format,
    importableCount: result.rows.length,
    skippedCount: result.skipped.length,
    rows: result.rows,
    skipped: result.skipped,
  }
  writeFileSync(out, JSON.stringify(payload, null, 2), "utf8")
  console.log(`OK: ${result.rows.length} importáveis, ${result.skipped.length} ignoradas → ${out}`)
}

main()
