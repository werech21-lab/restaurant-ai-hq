import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { invoiceStatuses, paymentMethods } from '@/modules/finance/domain/types'
import { MAX_INVOICE_MINOR } from '@/modules/finance/domain/totals'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'Not a real calendar date')

const nullableUuid = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .transform((value) => value ?? null)

/**
 * A line may point at a stock item and the warehouse it ships from. Both or neither: when both are set, issuing the
 * invoice takes `quantity` units from that warehouse.
 */
export const invoiceLineSchema = z
  .object({
    description: z.string().trim().min(1).max(300),
    quantity: z.number().int().min(1).max(1_000_000),
    unitPriceMinor: z.number().int().min(0).max(1_000_000_000),
    taxRateBps: z.number().int().min(0).max(10_000),
    itemId: nullableUuid,
    warehouseId: nullableUuid,
  })
  .refine((line) => (line.itemId === null) === (line.warehouseId === null), {
    message: 'Choose both an item and a warehouse, or neither',
    path: ['warehouseId'],
  })

export type InvoiceLineInput = z.output<typeof invoiceLineSchema>

const invoiceFields = {
  customerId: z.string().uuid(),
  issueDate: isoDate,
  dueDate: isoDate,
  notes: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value)),
  lines: z.array(invoiceLineSchema).min(1).max(200),
}

const dueAfterIssue = {
  check: (value: { issueDate: string; dueDate: string }) => value.dueDate >= value.issueDate,
  message: { message: 'The due date cannot be before the issue date', path: ['dueDate'] },
}

export const createInvoiceSchema = z
  .object(invoiceFields)
  .refine(dueAfterIssue.check, dueAfterIssue.message)

export type CreateInvoiceInput = z.output<typeof createInvoiceSchema>

const versionField = z.number().int().min(1)

export const updateInvoiceSchema = z
  .object({ ...invoiceFields, version: versionField })
  .refine(dueAfterIssue.check, dueAfterIssue.message)

export type UpdateInvoiceInput = z.output<typeof updateInvoiceSchema>

export const versionBodySchema = z.object({ version: versionField })

export type VersionBody = z.output<typeof versionBodySchema>

export const voidInvoiceSchema = z.object({
  version: versionField,
  reason: z.string().trim().min(1).max(500),
})

export type VoidInvoiceInput = z.output<typeof voidInvoiceSchema>

export const recordPaymentSchema = z.object({
  version: versionField,
  amountMinor: z.number().int().min(1).max(MAX_INVOICE_MINOR),
  currency: z.literal('KWD'),
  method: z.enum(paymentMethods),
  paidAt: z.string().datetime({ offset: true }),
  reference: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value)),
})

export type RecordPaymentInput = z.output<typeof recordPaymentSchema>

export const invoiceIdParamsSchema = z.object({ id: z.string().uuid() })

export const invoiceSortKeys = ['createdAt', 'dueDate', 'totalMinor'] as const
export type InvoiceSortKey = (typeof invoiceSortKeys)[number]

export const listInvoicesQuerySchema = pageQuerySchema.extend({
  status: z.enum(invoiceStatuses).optional(),
  customerId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(invoiceSortKeys).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
})

export type ListInvoicesQuery = z.output<typeof listInvoicesQuerySchema>
