import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { isoDate, nullableText, uuid, versionField } from '@/modules/procurement/schemas/invoice'

// ---- purchase returns ----

/** A return sends received goods of one order back from one warehouse. The price is the order's own. */
export const createReturnSchema = z
  .object({
    orderId: uuid,
    warehouseId: uuid,
    returnDate: isoDate,
    reason: z.string().trim().min(1).max(500),
    lines: z
      .array(z.object({ orderLineId: uuid, quantity: z.number().int().min(1).max(1_000_000) }))
      .min(1)
      .max(200),
  })
  .refine((value) => new Set(value.lines.map((line) => line.orderLineId)).size === value.lines.length, {
    message: 'An order line can appear once on a return',
    path: ['lines'],
  })
export type CreateReturnInput = z.output<typeof createReturnSchema>

export const listReturnsQuerySchema = pageQuerySchema.extend({ orderId: uuid.optional() })
export type ListReturnsQuery = z.output<typeof listReturnsQuerySchema>

// ---- supplier credit notes ----

/** A credit note cancels billed goods that went back. A line names the invoice line and the quantity; price and rate are the invoice line's. */
export const createCreditNoteSchema = z
  .object({
    invoiceId: uuid,
    supplierCreditNoteNumber: z.string().trim().min(1).max(60),
    creditDate: isoDate,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .default('KWD'),
    expectedTotalMinor: z.number().int().min(0).max(1_000_000_000_000).nullable().optional().transform((value) => value ?? null),
    reason: z.string().trim().min(1).max(500),
    lines: z
      .array(z.object({ invoiceLineId: uuid, quantity: z.number().int().min(1).max(1_000_000) }))
      .min(1)
      .max(200),
  })
  .refine((value) => new Set(value.lines.map((line) => line.invoiceLineId)).size === value.lines.length, {
    message: 'An invoice line can appear once on a credit note',
    path: ['lines'],
  })
export type CreateCreditNoteInput = z.output<typeof createCreditNoteSchema>

export const voidCreditNoteSchema = z.object({
  version: versionField,
  reason: z.string().trim().min(1).max(500),
  entryDate: isoDate,
})
export type VoidCreditNoteInput = z.output<typeof voidCreditNoteSchema>

export const listCreditNotesQuerySchema = pageQuerySchema.extend({
  status: z.enum(['posted', 'void', 'all']).default('all'),
  invoiceId: uuid.optional(),
  supplierId: uuid.optional(),
})
export type ListCreditNotesQuery = z.output<typeof listCreditNotesQuerySchema>

// ---- supplier payments ----

/** A payment is allocated in full to the open invoices of one supplier. Partial payment of an invoice is an allocation below its balance. */
export const createPaymentSchema = z
  .object({
    supplierId: uuid,
    paymentDate: isoDate,
    amountMinor: z.number().int().min(1).max(1_000_000_000_000),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .default('KWD'),
    method: z.enum(['cash', 'bank_transfer', 'cheque']),
    reference: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    paidFromAccountId: uuid,
    notes: nullableText(1000),
    allocations: z
      .array(z.object({ invoiceId: uuid, amountMinor: z.number().int().min(1).max(1_000_000_000_000) }))
      .min(1)
      .max(200),
  })
  .refine((value) => new Set(value.allocations.map((allocation) => allocation.invoiceId)).size === value.allocations.length, {
    message: 'An invoice can appear once on a payment',
    path: ['allocations'],
  })
export type CreatePaymentInput = z.output<typeof createPaymentSchema>

export const voidPaymentSchema = z.object({
  version: versionField,
  reason: z.string().trim().min(1).max(500),
  entryDate: isoDate,
})
export type VoidPaymentInput = z.output<typeof voidPaymentSchema>

export const listPaymentsQuerySchema = pageQuerySchema.extend({
  status: z.enum(['posted', 'void', 'all']).default('all'),
  supplierId: uuid.optional(),
})
export type ListPaymentsQuery = z.output<typeof listPaymentsQuerySchema>
