import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const quantity = z.number().int().min(1).max(1_000_000)

export const listQuerySchema = pageQuerySchema
export type ListQuery = z.output<typeof listQuerySchema>

export const recordWasteSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity,
  wastedOn: date,
  reason: z.string().trim().min(1).max(300),
})
export type RecordWasteInput = z.output<typeof recordWasteSchema>

export const recordProductionSchema = z.object({
  recipeId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  batches: quantity,
  producedOn: date,
  notes: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
})
export type RecordProductionInput = z.output<typeof recordProductionSchema>
