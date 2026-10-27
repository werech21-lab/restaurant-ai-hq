import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { MAX_INVOICE_MINOR } from '@/modules/finance/client'
import { supplierStatuses } from '@/modules/procurement/domain/types'

const uuid = z.string().uuid()
const versionField = z.number().int().min(1)

export const procurementIdParamsSchema = z.object({ id: uuid })

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

// ---- suppliers ----

export const createSupplierSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,20}$/, 'Letters, digits, dash and underscore only')
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(200),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  notes: nullableText(2000),
})
export type CreateSupplierInput = z.output<typeof createSupplierSchema>

/** The code is the supplier's identity and cannot change. */
export const updateSupplierSchema = z.object({
  version: versionField,
  name: z.string().trim().min(1).max(200),
  status: z.enum(supplierStatuses),
  paymentTermsDays: z.number().int().min(0).max(365),
  notes: nullableText(2000),
})
export type UpdateSupplierInput = z.output<typeof updateSupplierSchema>

export const listSuppliersQuerySchema = pageQuerySchema.extend({ status: z.enum(['active', 'blocked', 'all']).default('all') })
export type ListSuppliersQuery = z.output<typeof listSuppliersQuerySchema>

// ---- purchase orders ----

export const orderLineSchema = z.object({
  itemId: uuid,
  description: z.string().trim().min(1).max(300),
  quantity: z.number().int().min(1).max(1_000_000),
  unitCostMinor: z.number().int().min(0).max(1_000_000_000),
  taxRateBps: z.number().int().min(0).max(10_000),
})
export type OrderLineInput = z.output<typeof orderLineSchema>

const orderLines = z.array(orderLineSchema).min(1).max(200)

const datesInOrder = (value: { orderDate: string; expectedDate: string | null }) => value.expectedDate === null || value.expectedDate >= value.orderDate
const datesMessage = { message: 'The expected date cannot be before the order date', path: ['expectedDate'] }

export const createOrderSchema = z
  .object({
    supplierId: uuid,
    orderDate: isoDate,
    expectedDate: isoDate.nullable().optional().transform((value) => value ?? null),
    notes: nullableText(2000),
    lines: orderLines,
  })
  .refine(datesInOrder, datesMessage)
export type CreateOrderInput = z.output<typeof createOrderSchema>

/** The supplier cannot change on an existing order. */
export const updateOrderSchema = z
  .object({
    version: versionField,
    orderDate: isoDate,
    expectedDate: isoDate.nullable().optional().transform((value) => value ?? null),
    notes: nullableText(2000),
    lines: orderLines,
  })
  .refine(datesInOrder, datesMessage)
export type UpdateOrderInput = z.output<typeof updateOrderSchema>

export const submitOrderSchema = z.object({ version: versionField })
export type SubmitOrderInput = z.output<typeof submitOrderSchema>

export const approveOrderSchema = z.object({ version: versionField })
export type ApproveOrderInput = z.output<typeof approveOrderSchema>

export const cancelOrderSchema = z.object({ version: versionField, reason: z.string().trim().min(1).max(500) })
export type CancelOrderInput = z.output<typeof cancelOrderSchema>

export const listOrdersQuerySchema = pageQuerySchema.extend({
  status: z.enum(['draft', 'pending_approval', 'approved', 'partially_received', 'received', 'cancelled', 'all']).default('all'),
  supplierId: uuid.optional(),
})
export type ListOrdersQuery = z.output<typeof listOrdersQuerySchema>

// ---- goods receipts ----

export const createReceiptSchema = z
  .object({
    version: versionField,
    warehouseId: uuid,
    receiptDate: isoDate,
    notes: nullableText(500),
    lines: z
      .array(z.object({ orderLineId: uuid, quantity: z.number().int().min(1).max(1_000_000) }))
      .min(1)
      .max(200),
  })
  .refine((value) => new Set(value.lines.map((line) => line.orderLineId)).size === value.lines.length, {
    message: 'An order line can appear once on a receipt',
    path: ['lines'],
  })
export type CreateReceiptInput = z.output<typeof createReceiptSchema>

export const listReceiptsQuerySchema = pageQuerySchema.extend({ orderId: uuid.optional() })
export type ListReceiptsQuery = z.output<typeof listReceiptsQuerySchema>

// ---- settings ----

/** `version` is 0 while the settings have never been saved. */
export const updateSettingsSchema = z.object({
  version: z.number().int().min(0),
  approvalThresholdMinor: z.number().int().min(0).max(MAX_INVOICE_MINOR).nullable(),
})
export type UpdateSettingsInput = z.output<typeof updateSettingsSchema>