import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { invoiceLineSchema } from '@/modules/finance/client'
import { quotationStatuses } from '@/modules/crm/domain/types'
import { isoDate, nullableUuid, optionalText, versionField } from '@/modules/crm/schemas/common'

/** A quotation line is exactly an invoice line, so a conversion copies it without any translation. */
export const quotationLineSchema = invoiceLineSchema

const quotationFields = {
  customerId: z.string().uuid(),
  leadId: nullableUuid,
  validUntil: isoDate,
  notes: optionalText(2000),
  lines: z.array(quotationLineSchema).min(1).max(200),
}

export const createQuotationSchema = z.object(quotationFields)

export type CreateQuotationInput = z.output<typeof createQuotationSchema>

export const updateQuotationSchema = z.object({ ...quotationFields, version: versionField })

export type UpdateQuotationInput = z.output<typeof updateQuotationSchema>

export type QuotationLineInput = z.output<typeof quotationLineSchema>

export const quotationSortKeys = ['createdAt', 'validUntil', 'totalMinor'] as const
export type QuotationSortKey = (typeof quotationSortKeys)[number]

export const listQuotationsQuerySchema = pageQuerySchema.extend({
  status: z.enum(quotationStatuses).optional(),
  customerId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(quotationSortKeys).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
})

export type ListQuotationsQuery = z.output<typeof listQuotationsQuerySchema>
