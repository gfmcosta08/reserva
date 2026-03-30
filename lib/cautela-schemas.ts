import { z } from "zod"

export const uuidSchema = z.string().uuid({ message: "Formato de ID inválido" })

export const createCautelaInputSchema = z.object({
  person_id: uuidSchema,
  type: z.enum(["daily", "permanent"]),
  material_ids: z
    .array(uuidSchema)
    .min(1, "Selecione pelo menos um material"),
  notes: z.string().optional(),
  pin: z.string().regex(/^\d{4}$/, "PIN deve ter 4 dígitos numéricos"),
})

export const createCautelaFaceAuthInputSchema = z.object({
  person_id: uuidSchema,
  type: z.enum(["daily", "permanent"]),
  material_ids: z.array(uuidSchema).min(1, "Selecione pelo menos um material"),
  notes: z.string().optional(),
})

const devolutionItemSchema = z.object({
  cautelaItemId: uuidSchema,
  confirmed: z.boolean(),
  quantityReturned: z.number().optional(),
  notes: z.string().optional(),
})

export const processBulkDevolutionInputSchema = z.object({
  cautelaId: uuidSchema,
  items: z.array(devolutionItemSchema).min(1),
})

export const cautelaIdParamSchema = z.object({
  cautelaId: uuidSchema,
})

export const personIdParamSchema = z.object({
  personId: uuidSchema,
})
