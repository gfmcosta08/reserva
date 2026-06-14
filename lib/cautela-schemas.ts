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
  pin: z.string().regex(/^\d{4}$/, "PIN deve ter 4 dígitos numéricos"),
})

export const createCautelaFaceAuthInputSchema = z.object({
  person_id: uuidSchema,
  type: z.enum(["daily", "permanent"]),
  items: z.array(cautelaItemRowSchema).min(1, "Selecione pelo menos um material"),
  notes: z.string().max(2000, "Observações muito longas").optional(),
})

const devolutionItemSchema = z.object({
  cautelaItemId: uuidSchema,
  confirmed: z.boolean().optional(),
  quantityReturned: z.number().optional(),
  notes: z.string().max(2000).optional(),
  disposition: z.enum(["return", "damaged", "missing"]).optional(),
})

export const processBulkDevolutionInputSchema = z.object({
  cautelaId: uuidSchema,
  items: z.array(devolutionItemSchema).min(1),
})

const transferItemRowSchema = z.object({
  material_id: uuidSchema,
  quantity: z.number().int().min(1).max(99999),
  transfer_from_cautela_item_id: uuidSchema.optional(),
})

export const createCautelaWithTransferInputSchema = z.object({
  person_id: uuidSchema,
  type: z.literal("daily"),
  items: z.array(transferItemRowSchema).min(1, "Selecione pelo menos um material"),
  notes: z.string().max(2000, "Observações muito longas").optional(),
  pin: z.string().regex(/^\d{4}$/, "PIN deve ter 4 dígitos numéricos"),
})

export const createCautelaWithTransferFaceAuthInputSchema = z.object({
  person_id: uuidSchema,
  type: z.literal("daily"),
  items: z.array(transferItemRowSchema).min(1, "Selecione pelo menos um material"),
  notes: z.string().max(2000, "Observações muito longas").optional(),
})

export const cautelaIdParamSchema = z.object({
  cautelaId: uuidSchema,
})

export const personIdParamSchema = z.object({
  personId: uuidSchema,
})
