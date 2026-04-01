import { z } from "zod"

export const uuidSchema = z.string().uuid({ message: "Formato de ID inválido" })

const cautelaItemRowSchema = z.object({
  material_id: uuidSchema,
  quantity: z.number().int().min(1).max(99999).optional().default(1),
})

export const createCautelaInputSchema = z.object({
  person_id: uuidSchema,
  type: z.enum(["daily", "permanent"]),
  items: z
    .array(cautelaItemRowSchema)
    .min(1, "Selecione pelo menos um material"),
  notes: z.string().max(2000, "Observações muito longas").optional(),
  pin: z.string().regex(/^\d{6}$/, "PIN deve ter 6 dígitos numéricos"),
})

export const createCautelaFaceAuthInputSchema = z.object({
  person_id: uuidSchema,
  type: z.enum(["daily", "permanent"]),
  items: z.array(cautelaItemRowSchema).min(1, "Selecione pelo menos um material"),
  notes: z.string().max(2000, "Observações muito longas").optional(),
})

const devolutionItemSchema = z.object({
  cautelaItemId: uuidSchema,
  confirmed: z.boolean(),
  quantityReturned: z.number().optional(),
  notes: z.string().max(2000).optional(),
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
