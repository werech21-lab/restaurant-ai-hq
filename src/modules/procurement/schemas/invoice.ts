import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'

export const uuid = z.string().uuid()
export const versionField = z.number().int().min(1)

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'Not a real calendar date')

export const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null))

/**
 * A supplier invoice bills received goods of one purchase order. A line names the order line and the quantity. The price and
 * tax rate default to the order line's; the supplier's own price or rate may be sent, and it is accepted only inside the
 * company's tolerances. `expectedTotalMinor` is the total printed on the supplier's invoice. When it is given and differs from
 * the computed total the booking stops.
 */
export const createSupplierInvoiceSchema = z
  .object({
    orderId: uuid,
    supplierInvoiceNumber: z.string().trim().min(1).max(60),
    invoiceDate: isoDate,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .default('KWD'),
    expectedTotalMinor: z.number().int().min(0).max(1_000_000_000_000).nullable().optional().transform((value) => value ?? null),
    notes: nullableText(1000),
    lines: z
      .array(
        z.object({
          orderLineId: uuid,
          quantity: z.number().int().min(1).max(1_000_000),
          unitCostMinor: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
          taxRateBps: z.number().int().min(0).max(10_000).nullable().optional(),
        })
      )
      .min(1)
      .max(200),
  })
  .refine((value) => new Set(value.lines.map((line) => line.orderLineId)).size === value.lines.length, {
    message: 'An order line can appear once on an invoice',
    path: ['lines'],
  })
export type CreateSupplierInvoiceInput = z.output<typeof createSupplierInvoiceSchema>

/** The match preview takes the same body as the booking and writes nothing. */
export const matchPreviewSchema = createSupplierInvoiceSchema
export type MatchPreviewInput = CreateSupplierInvoiceInput

/** Voiding books a reversing entry, which needs its own date in an open fiscal period. */
export const voidSupplierInvoiceSchema = z.object({
  version: versionField,
  reason: z.string().trim().min(1).max(500),
  entryDate: isoDate,
})
export type VoidSupplierInvoiceInput = z.output<typeof voidSupplierInvoiceSchema>

export const listSupplierInvoicesQuerySchema = pageQuerySchema.extend({
  status: z.enum(['posted', 'void', 'all']).default('all'),
  supplierId: uuid.optional(),
  orderId: uuid.optional(),
  /** `open` keeps posted invoices that still have a balance to pay. */
  settlement: z.enum(['open', 'all']).default('all'),
})
export type ListSupplierInvoicesQuery = z.output<typeof listSupplierInvoicesQuerySchema>

/**
 * `version` is 0 while the accounts have never been saved. Saving replaces every field, so an omitted one returns to its
 * default: the invoice basis, no GRNI or variance account, zero tolerance, and the experimental costing method
 * `moving_weighted_average`. That method needs `cogsAccountId`. Sending `order_price` keeps the previous books.
 */
export const updateAccountingSchema = z
  .object({
    version: z.number().int().min(0),
    inventoryAccountId: uuid,
    payableAccountId: uuid,
    inputTaxAccountId: uuid.nullable(),
    accountingBasis: z.enum(['invoice_basis', 'receipt_basis']).default('invoice_basis'),
    costingMethod: z.enum(['order_price', 'moving_weighted_average']).default('moving_weighted_average'),
    cogsAccountId: uuid
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    grniAccountId: uuid
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    ppvAccountId: uuid
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    priceToleranceBps: z.number().int().min(0).max(10_000).default(0),
    taxToleranceMinor: z.number().int().min(0).max(1_000_000_000).default(0),
  })
  .refine((value) => value.accountingBasis === 'invoice_basis' || (value.grniAccountId !== null && value.ppvAccountId !== null), {
    message: 'The receipt basis needs a GRNI account and a purchase price variance account',
    path: ['grniAccountId'],
  })
  .refine((value) => value.costingMethod === 'order_price' || value.cogsAccountId !== null, {
    message: 'Moving weighted average needs a cost of goods account',
    path: ['cogsAccountId'],
  })
export type UpdateAccountingInput = z.output<typeof updateAccountingSchema>
