"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const DEFAULT_CATEGORY = "Sem Categoria"

type FilterInput = string | string[] | undefined

export type MaterialsFilters = {
  status?: FilterInput
  categories?: FilterInput
  category?: FilterInput
  category_id?: FilterInput
  search?: string
  name?: FilterInput
  reservation_id?: FilterInput
}

type MaterialImportRow = Record<string, unknown>

type MaterialImportPayload = {
  line: number
  name: string
  patrimony_number: string
  internal_code: string
  serial_number: string | null
  reservation_id: string | null
  categories: string
  size: string | null
  model: string | null
  quantity: number
  color: string | null
  notes: string | null
  statusCandidates: string[]
}

const MATERIAL_COLUMN_ALIASES = {
  name: ["name", "nome", "equipamento", "material", "item"],
  patrimony_number: [
    "patrimony_number",
    "patrimonio",
    "numero_patrimonio",
    "n_patrimonio",
    "patrimony",
    "tombo",
  ],
  internal_code: [
    "internal_code",
    "codigo_interno",
    "codigointerno",
    "codigo",
    "codigo_qr",
    "qrcode",
    "qr",
  ],
  serial_number: ["serial_number", "numero_serie", "numeroserie", "serial", "sn"],
  reservation_id: [
    "reservation_id",
    "identificacao_reserva",
    "identificacaoreserva",
    "reserva",
    "localizacao",
    "local",
    "armario",
  ],
  categories: ["categories", "category", "categoria", "categorias"],
  size: ["size", "tamanho", "tam"],
  model: ["model", "modelo"],
  quantity: ["quantity", "quantidade", "qtd", "qtde"],
  color: ["color", "cor"],
  status: ["status", "situacao"],
  notes: ["notes", "observacoes", "observacao", "nota", "notas"],
} as const

type MaterialImportField = keyof typeof MATERIAL_COLUMN_ALIASES

const MATERIAL_COLUMN_ALIAS_SETS = Object.fromEntries(
  Object.entries(MATERIAL_COLUMN_ALIASES).map(([field, aliases]) => [
    field,
    new Set(Array.from(aliases).map((alias) => normalizeHeader(alias))),
  ])
) as Record<MaterialImportField, Set<string>>

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const asText = String(value).trim()
  return asText.length > 0 ? asText : null
}

function normalizeCategory(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : DEFAULT_CATEGORY
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
}

function normalizeQuantityInput(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = Math.floor(value)
    return parsed > 0 ? parsed : 1
  }

  const normalized = normalizeText(value)
  if (!normalized) return 1

  const parsed = Number(normalized.replace(",", "."))
  if (!Number.isFinite(parsed)) return 1

  const integer = Math.floor(parsed)
  return integer > 0 ? integer : 1
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function splitMultiValue(value: FilterInput): string[] {
  if (value === undefined) return []

  const chunks = Array.isArray(value) ? value : [value]

  const normalized = chunks
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return Array.from(new Set(normalized))
}

function normalizeStatus(value: string | null | undefined): string | undefined {
  const normalized = normalizeHeader(value ?? "")
  if (!normalized) return undefined

  if (["available", "disponivel", "livre"].includes(normalized)) return "available"
  if (["cautelado", "emuso", "inuse", "inuso", "in_use"].includes(normalized)) return "cautelado"
  if (["maintenance", "manutencao", "manutencao"].includes(normalized)) return "maintenance"
  if (["unavailable", "indisponivel", "blocked", "bloqueado"].includes(normalized)) return "unavailable"

  return normalizeText(value) ?? undefined
}

function resolveStatusCandidates(value: string | null | undefined): string[] {
  const normalized = normalizeStatus(value)
  if (!normalized) return []

  if (normalized === "unavailable") return ["unavailable", "blocked"]
  if (normalized === "blocked") return ["blocked", "unavailable"]
  if (normalized === "cautelado") return ["cautelado", "in_use"]
  if (normalized === "in_use") return ["in_use", "cautelado"]

  return [normalized]
}

function resolveMaterialCategory(material: any): string {
  return normalizeCategory(material?.categories ?? material?.category)
}

function isMissingCategoriesColumnError(error: { message?: string } | null) {
  const message = error?.message ?? ""
  return /column .*categories.* does not exist/i.test(message)
}

function isStatusConstraintError(error: { message?: string } | null) {
  const message = error?.message ?? ""
  return /materials_status_check|violates check constraint/i.test(message)
}

function isMissingExtendedMaterialColumnError(error: { message?: string } | null) {
  const message = error?.message ?? ""
  return /column .*(size|model|quantity|color).* does not exist/i.test(message)
}

function stripExtendedMaterialFields(payload: Record<string, any>) {
  const nextPayload = { ...payload }
  delete nextPayload.size
  delete nextPayload.model
  delete nextPayload.quantity
  delete nextPayload.color
  return nextPayload
}

function findValueByAliases(row: MaterialImportRow, field: MaterialImportField): string | null {
  const aliasSet = MATERIAL_COLUMN_ALIAS_SETS[field]

  for (const [rawKey, rawValue] of Object.entries(row)) {
    if (aliasSet.has(normalizeHeader(rawKey))) {
      return normalizeText(rawValue)
    }
  }

  return null
}

function parseImportRow(row: MaterialImportRow, line: number): { payload?: MaterialImportPayload; error?: string } {
  const name = findValueByAliases(row, "name")
  const patrimonyNumber = findValueByAliases(row, "patrimony_number")
  const internalCode = findValueByAliases(row, "internal_code")

  const hasAnyValue = Object.values(row).some((value) => normalizeText(value))
  if (!hasAnyValue) {
    return {}
  }

  if (!name || !patrimonyNumber || !internalCode) {
    return {
      error: `Linha ${line}: campos obrigatorios ausentes (name, patrimony_number, internal_code).`,
    }
  }

  const serialNumber = findValueByAliases(row, "serial_number")
  const reservationId = findValueByAliases(row, "reservation_id")
  const categories = normalizeCategory(findValueByAliases(row, "categories"))
  const size = normalizeOptionalText(findValueByAliases(row, "size"))
  const model = normalizeOptionalText(findValueByAliases(row, "model"))
  const quantity = normalizeQuantityInput(findValueByAliases(row, "quantity"))
  const color = normalizeOptionalText(findValueByAliases(row, "color"))
  const notes = findValueByAliases(row, "notes")
  const statusCandidates = resolveStatusCandidates(findValueByAliases(row, "status"))

  return {
    payload: {
      line,
      name,
      patrimony_number: patrimonyNumber,
      internal_code: internalCode,
      serial_number: serialNumber,
      reservation_id: reservationId,
      categories,
      size,
      model,
      quantity,
      color,
      notes,
      statusCandidates,
    },
  }
}

const materialSchema = z.object({
  name: z.string().min(2, "Nome e obrigatorio"),
  categories: z.string().min(1, "Categoria e obrigatoria").transform(normalizeCategory),
  patrimony_number: z.string().min(1, "Patrimonio e obrigatorio"),
  serial_number: z.string().optional(),
  internal_code: z.string().min(1, "Codigo interno e obrigatorio"),
  reservation_id: z.string().optional(),
  size: z.string().optional(),
  model: z.string().optional(),
  quantity: z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined
      if (typeof value === "string" && value.trim().length === 0) return undefined
      return normalizeQuantityInput(value)
    },
    z.number().int().positive().optional()
  ),
  color: z.string().optional(),
  status: z.string().optional().transform((value) => normalizeStatus(value)),
  notes: z.string().optional(),
})

const createMaterialSchema = materialSchema.extend({
  quantity: materialSchema.shape.quantity.transform((value) => value ?? 1),
})

const updateMaterialSchema = z.object({
  name: z.string().min(2, "Nome e obrigatorio").optional(),
  categories: z.string().min(1, "Categoria e obrigatoria").transform(normalizeCategory).optional(),
  patrimony_number: z.string().min(1, "Patrimonio e obrigatorio").optional(),
  serial_number: z.string().optional(),
  internal_code: z.string().min(1, "Codigo interno e obrigatorio").optional(),
  reservation_id: z.string().optional(),
  size: z.string().optional(),
  model: z.string().optional(),
  quantity: materialSchema.shape.quantity,
  color: z.string().optional(),
  status: z.string().optional().transform((value) => normalizeStatus(value)),
  notes: z.string().optional(),
})

async function resolveLegacyCategoryByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryIds: string[]
) {
  if (categoryIds.length === 0) return []

  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .in("id", categoryIds)

  if (error || !data) {
    return []
  }

  const nameById = new Map(data.map((row: any) => [row.id, row.name]))
  return categoryIds
    .map((id) => nameById.get(id))
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
}

async function executeMaterialsQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: MaterialsFilters | undefined,
  categoryColumn: "categories" | "category"
) {
  let query = supabase.from("materials").select("*").order("created_at", { ascending: false })

  const statusFilters = splitMultiValue(filters?.status)
  const categoryFilters = splitMultiValue(filters?.categories)
  const nameFilters = splitMultiValue(filters?.name)
  const reservationFilters = splitMultiValue(filters?.reservation_id)

  if (statusFilters.length > 0) {
    query = query.in("status", statusFilters)
  }

  if (categoryFilters.length > 0) {
    query = query.in(categoryColumn, categoryFilters.map((name) => normalizeCategory(name)))
  }

  if (nameFilters.length > 0) {
    query = query.in("name", nameFilters)
  }

  if (reservationFilters.length > 0) {
    query = query.in("reservation_id", reservationFilters)
  }

  if (filters?.search) {
    const search = filters.search.trim()
    if (search.length > 0) {
      query = query.or(
        `name.ilike.%${search}%,patrimony_number.ilike.%${search}%,internal_code.ilike.%${search}%,reservation_id.ilike.%${search}%,${categoryColumn}.ilike.%${search}%`
      )
    }
  }

  return query
}

function mergeLegacyCategoryFilters(
  directCategoryFilters: string[],
  resolvedLegacyCategoryNames: string[],
  rawLegacyCategoryFilters: string[]
) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const fallbackLegacyNames = rawLegacyCategoryFilters.filter((value) => !uuidPattern.test(value))

  return Array.from(
    new Set([
      ...directCategoryFilters.map((value) => normalizeCategory(value)),
      ...resolvedLegacyCategoryNames.map((value) => normalizeCategory(value)),
      ...fallbackLegacyNames.map((value) => normalizeCategory(value)),
    ])
  )
}

export async function getMaterials(filters?: MaterialsFilters) {
  const supabase = await createClient()

  const directCategoryFilters = [
    ...splitMultiValue(filters?.categories),
    ...splitMultiValue(filters?.category),
  ]
  const rawLegacyCategoryFilters = splitMultiValue(filters?.category_id)
  const resolvedLegacyCategoryNames =
    directCategoryFilters.length === 0 && rawLegacyCategoryFilters.length > 0
      ? await resolveLegacyCategoryByIds(supabase, rawLegacyCategoryFilters)
      : []

  const mergedCategoryFilters = mergeLegacyCategoryFilters(
    directCategoryFilters,
    resolvedLegacyCategoryNames,
    rawLegacyCategoryFilters
  )

  const normalizedFilters: MaterialsFilters = {
    ...filters,
    categories: mergedCategoryFilters,
  }

  const { data, error } = await executeMaterialsQuery(supabase, normalizedFilters, "categories")

  if (error && isMissingCategoriesColumnError(error)) {
    const { data: fallbackData, error: fallbackError } = await executeMaterialsQuery(
      supabase,
      normalizedFilters,
      "category"
    )

    if (fallbackError) {
      console.error("[materials] getMaterials legacy query failed:", fallbackError.message)
      return []
    }

    return (fallbackData ?? []).map((material: any) => ({
      ...material,
      categories: resolveMaterialCategory(material),
    }))
  }

  if (error) {
    console.error("[materials] getMaterials failed:", error.message)
    return []
  }

  return (data ?? []).map((material: any) => ({
    ...material,
    categories: resolveMaterialCategory(material),
  }))
}

export async function getMaterialCategoryOptions() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("materials").select("categories")

  let rows: any[] = (data as any[]) ?? []

  if (error && isMissingCategoriesColumnError(error)) {
    const { data: fallbackRows, error: fallbackError } = await supabase.from("materials").select("category")
    if (fallbackError) {
      console.error("[materials] getMaterialCategoryOptions legacy failed:", fallbackError.message)
      return []
    }
    rows = (fallbackRows as any[]) ?? []
  } else if (error) {
    console.error("[materials] getMaterialCategoryOptions failed:", error.message)
    return []
  }

  const categories = Array.from(new Set(rows.map((row: any) => resolveMaterialCategory(row))))
  return categories.sort((a, b) => a.localeCompare(b, "pt-BR"))
}

export async function createMaterial(data: z.infer<typeof materialSchema>) {
  const supabase = await createClient()
  const result = createMaterialSchema.safeParse(data)

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const normalizedCategory = normalizeCategory(result.data.categories)

  const payload: Record<string, any> = {
    ...result.data,
    categories: normalizedCategory,
    size: normalizeOptionalText(result.data.size),
    model: normalizeOptionalText(result.data.model),
    quantity: normalizeQuantityInput(result.data.quantity),
    color: normalizeOptionalText(result.data.color),
  }

  if (!result.data.status) {
    delete payload.status
  }

  let insertPayload = { ...payload }
  let { error } = await supabase.from("materials").insert(insertPayload)

  if (error && isMissingExtendedMaterialColumnError(error)) {
    insertPayload = stripExtendedMaterialFields(insertPayload)
    const retry = await supabase.from("materials").insert(insertPayload)
    error = retry.error
  }

  if (error && isMissingCategoriesColumnError(error)) {
    const legacyPayload = {
      ...insertPayload,
      category: normalizedCategory,
    } as Record<string, any>
    delete legacyPayload.categories
    if (!legacyPayload.status) {
      delete legacyPayload.status
    }
    let legacyResult = await supabase.from("materials").insert(legacyPayload)
    if (legacyResult.error && isMissingExtendedMaterialColumnError(legacyResult.error)) {
      const legacyWithoutExtended = stripExtendedMaterialFields(legacyPayload)
      legacyResult = await supabase.from("materials").insert(legacyWithoutExtended)
    }
    error = legacyResult.error
  }

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

export async function updateMaterial(id: string, data: Partial<z.infer<typeof materialSchema>>) {
  const supabase = await createClient()
  const result = updateMaterialSchema.safeParse(data)

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const normalizedCategory =
    result.data.categories !== undefined ? normalizeCategory(result.data.categories) : undefined

  const payload = {
    ...result.data,
    ...(normalizedCategory !== undefined ? { categories: normalizedCategory } : {}),
  } as Record<string, any>

  if ("size" in payload) {
    payload.size = normalizeOptionalText(payload.size)
  }
  if ("model" in payload) {
    payload.model = normalizeOptionalText(payload.model)
  }
  if ("quantity" in payload) {
    payload.quantity = normalizeQuantityInput(payload.quantity)
  }
  if ("color" in payload) {
    payload.color = normalizeOptionalText(payload.color)
  }

  if (!payload.status) {
    delete payload.status
  }

  let updatePayload = { ...payload }
  let { error } = await supabase.from("materials").update(updatePayload).eq("id", id)

  if (error && isMissingExtendedMaterialColumnError(error)) {
    updatePayload = stripExtendedMaterialFields(updatePayload)
    const retry = await supabase.from("materials").update(updatePayload).eq("id", id)
    error = retry.error
  }

  if (error && isMissingCategoriesColumnError(error)) {
    const legacyPayload = {
      ...result.data,
      ...(normalizedCategory !== undefined ? { category: normalizedCategory } : {}),
    } as Record<string, any>

    if ("size" in legacyPayload) {
      legacyPayload.size = normalizeOptionalText(legacyPayload.size)
    }
    if ("model" in legacyPayload) {
      legacyPayload.model = normalizeOptionalText(legacyPayload.model)
    }
    if ("quantity" in legacyPayload) {
      legacyPayload.quantity = normalizeQuantityInput(legacyPayload.quantity)
    }
    if ("color" in legacyPayload) {
      legacyPayload.color = normalizeOptionalText(legacyPayload.color)
    }

    delete legacyPayload.categories

    if (!legacyPayload.status) {
      delete legacyPayload.status
    }

    let legacyResult = await supabase.from("materials").update(legacyPayload).eq("id", id)
    if (legacyResult.error && isMissingExtendedMaterialColumnError(legacyResult.error)) {
      const legacyWithoutExtended = stripExtendedMaterialFields(legacyPayload)
      legacyResult = await supabase.from("materials").update(legacyWithoutExtended).eq("id", id)
    }
    error = legacyResult.error
  }

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

export async function updateMaterialStatus(id: string, status: string, notes?: string) {
  const supabase = await createClient()
  const normalizedStatus = normalizeStatus(status) ?? status
  const { error } = await supabase.from("materials").update({ status: normalizedStatus, notes }).eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

async function upsertMaterialRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: Omit<MaterialImportPayload, "line" | "statusCandidates"> & { status?: string }
) {
  const nextPayload: Record<string, any> = {
    name: payload.name,
    patrimony_number: payload.patrimony_number,
    internal_code: payload.internal_code,
    serial_number: payload.serial_number,
    reservation_id: payload.reservation_id,
    categories: payload.categories,
    size: payload.size,
    model: payload.model,
    quantity: payload.quantity,
    color: payload.color,
    notes: payload.notes,
  }

  if (payload.status) {
    nextPayload.status = payload.status
  }

  let upsertPayload = { ...nextPayload }
  let { error } = await supabase.from("materials").upsert(upsertPayload, {
    onConflict: "internal_code",
    ignoreDuplicates: false,
  })

  if (error && isMissingExtendedMaterialColumnError(error)) {
    upsertPayload = stripExtendedMaterialFields(upsertPayload)
    const retry = await supabase.from("materials").upsert(upsertPayload, {
      onConflict: "internal_code",
      ignoreDuplicates: false,
    })
    error = retry.error
  }

  if (error && isMissingCategoriesColumnError(error)) {
    const legacyPayload: Record<string, any> = {
      ...upsertPayload,
      category: payload.categories,
    }
    delete legacyPayload.categories

    let legacyResult = await supabase.from("materials").upsert(legacyPayload, {
      onConflict: "internal_code",
      ignoreDuplicates: false,
    })
    if (legacyResult.error && isMissingExtendedMaterialColumnError(legacyResult.error)) {
      const legacyWithoutExtended = stripExtendedMaterialFields(legacyPayload)
      legacyResult = await supabase.from("materials").upsert(legacyWithoutExtended, {
        onConflict: "internal_code",
        ignoreDuplicates: false,
      })
    }
    error = legacyResult.error
  }

  return { error }
}

export async function importMaterialsTable(rows: MaterialImportRow[]) {
  const supabase = await createClient()

  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: "Arquivo vazio ou invalido" }
    }

    let count = 0
    let skipped = 0
    const warnings: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const line = i + 2
      const parsed = parseImportRow(rows[i] ?? {}, line)

      if (!parsed.payload) {
        if (parsed.error) {
          warnings.push(parsed.error)
          skipped++
        }
        continue
      }

      const { statusCandidates, ...basePayload } = parsed.payload
      const candidateStatuses = statusCandidates.length > 0 ? statusCandidates : [undefined]

      let lastError: { message?: string } | null = null

      for (const statusCandidate of candidateStatuses) {
        const { error } = await upsertMaterialRow(supabase, {
          ...basePayload,
          ...(statusCandidate ? { status: statusCandidate } : {}),
        })

        if (!error) {
          lastError = null
          break
        }

        lastError = error

        if (!isStatusConstraintError(error)) {
          break
        }
      }

      if (lastError) {
        warnings.push(`Linha ${parsed.payload.line}: ${lastError.message ?? "erro na importacao"}`)
        skipped++
        continue
      }

      count++
    }

    if (count === 0 && warnings.length > 0) {
      return {
        error: warnings[0],
        warnings: warnings.slice(0, 5),
      }
    }

    revalidatePath("/materials")
    return {
      success: true,
      count,
      skipped,
      warnings: warnings.slice(0, 5),
    }
  } catch (err: any) {
    return { error: err.message }
  }
}

function parseCSVLine(text: string) {
  const reValue =
    /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\s\S][^'\\]*)*)'|"([^"\\]*(?:\\[\s\S][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g
  const values: string[] = []
  text.replace(reValue, function (_m0, m1, m2, m3) {
    if (m1 !== undefined) values.push(m1.replace(/\\'/g, "'"))
    else if (m2 !== undefined) values.push(m2.replace(/\\"/g, '"'))
    else if (m3 !== undefined) values.push(m3)
    return ""
  })

  return text.split(",").map((val, i) => values[i] || val.trim())
}

export async function importMaterialsCsv(csvText: string) {
  try {
    const lines = csvText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length <= 1) {
      return { error: "Arquivo vazio ou invalido" }
    }

    const headers = parseCSVLine(lines[0])
    const rows: MaterialImportRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i])
      if (vals.every((value) => value.trim().length === 0)) continue

      const row: MaterialImportRow = {}
      headers.forEach((header, idx) => {
        row[header] = vals[idx] ?? ""
      })
      rows.push(row)
    }

    return importMaterialsTable(rows)
  } catch (err: any) {
    return { error: err.message }
  }
}
