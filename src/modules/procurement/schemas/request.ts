import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { requestStatuses } from '@/modules/procurement/domain/types'

const uuid = z.string().uuid()
const versionField = z.number().int().min(1)

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'Not a real calendar date')

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null))

export const requestLineSchema = z.object({
  itemId: uuid,
  description: z.string().trim().min(1).max(300),
  quantity: z.number().int().min(1).max(1_000_000),
})
export type RequestLineInput = z.output<typeof requestLineSchema>

const requestFields = {
  neededBy: isoDate.nullable().optional().transform((value) => value ?? null),
  reason: nullableText(1000),
  lines: z.array(requestLineSchema).min(1).max(200),
}

export const createRequestSchema = z.object(requestFields)
export type CreateRequestInput = z.output<typeof createRequestSchema>

export const updateRequestSchema = z.object({ version: versionField, ...requestFields })
export type UpdateRequestInput = z.output<typeof updateRequestSchema>

export const submitRequestSchema = z.object({ version: versionField })
export type SubmitRequestInput = z.output<typeof submitRequestSchema>

export const approveRequestSchema = z.object({ version: versionField })
export type ApproveRequestInput = z.output<typeof approveRequestSchema>

export const rejectRequestSchema = z.object({ version: versionField, note: z.string().trim().min(1).max(500) })
export type RejectRequestInput = z.output<typeof rejectRequestSchema>

export const cancelRequestSchema = z.object({ version: versionField, reason: z.string().trim().min(1).max(500) })
export type CancelRequestInput = z.output<typeof cancelRequestSchema>

/** Turns an approved request into a draft purchase order. The buyer prices each line and picks the supplier. */
export const convertRequestSchema = z
  .object({
    version: versionField,
    supplierId: uuid,
    orderDate: isoDate,
    expectedDate: isoDate.nullable().optional().transform((value) => value ?? null),
    notes: nullableText(2000),
    lines: z
      .array(
        z.object({
          requestLineId: uuid,
          unitCostMinor: z.number().int().min(0).max(1_000_000_000),
          taxRateBps: z.number().int().min(0).max(10_000),
        })
      )
      .min(1)
      .max(200),
  })
  .refine((value) => value.expectedDate === null || value.expectedDate >= value.orderDate, {
    message: 'The expected date cannot be before the order date',
    path: ['expectedDate'],
  })
export type ConvertRequestInput = z.output<typeof convertRequestSchema>

export const listRequestsQuerySchema = pageQuerySchema.extend({
  status: z.enum([...requestStatuses, 'all']).default('all'),
})
export type ListRequestsQuery = z.output<typeof listRequestsQuerySchema>