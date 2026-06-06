import { execSync } from "node:child_process"
import { resolve } from "node:path"

const root = resolve(__dirname, "../../..")

function parseSeedOutput(text: string): Record<string, unknown> {
  let depth = 0
  let end = -1
  let start = -1
  for (let i = text.length - 1; i >= 0; i--) {
    const c = text[i]
    if (c === "}") {
      if (depth === 0) end = i
      depth++
    } else if (c === "{") {
      depth--
      if (depth === 0) {
        start = i
        break
      }
    }
  }
  if (start < 0 || end < 0) throw new Error("Seed não retornou JSON válido")
  const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  if (parsed.ok !== true) throw new Error("Seed JSON sem ok:true")
  return parsed
}

export function runSeedScript(scriptPath: string): Record<string, unknown> {
  const script = resolve(root, scriptPath)
  const out = execSync(`node "${script}" --apply`, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  return parseSeedOutput(out.trim())
}

export function readQaEnvValue(key: string): string | undefined {
  try {
    const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs")
    const p = resolve(root, "scripts/.env.qa")
    if (!existsSync(p)) return undefined
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim()
      if (t.startsWith(`${key}=`)) return t.slice(key.length + 1)
    }
  } catch {
    /* ignore */
  }
  return undefined
}
