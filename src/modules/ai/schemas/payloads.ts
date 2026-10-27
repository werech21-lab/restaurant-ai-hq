import { z } from 'zod'
import type {
  AutoReorderPayload,
  CustomerOverduePayload,
  DiscountPayload,
  LeadFollowupPayload,
  PriceAdjustmentPayload,
} from '@/modules/ai/domain/types'

// The payload of a request is JSON in the database. Before anything executes, it is read back through these schemas, so
// a damaged or hand-edited row fails with a clear error instead of running with a wrong value.

const id = z.string().uuid()
const fils = z.number().int().min(0).max(1_000_000_000_000)
const count = z.number().int().min(0).max(1_000_000_000)

export const autoReorderPayloadSchema: z.ZodType<AutoReorderPayload> = z.object({
  itemId: id,
  sku: z.string(),
  itemName: z.string(),
  warehouseId: id,
  warehouseCode: z.string(),
  quantity: z.number().int().min(1).max(1_000_000),
  unitCostMinor: fils,
  totalCostMinor: fils,
  currentStock: count,
  reorderLevel: count,
  targetStock: count,
  outQuantity: count,
  windowDays: z.number().int().min(1).max(365),
})

export const customerOverduePayloadSchema: z.ZodType<CustomerOverduePayload> = z.object({
  customerId: id,
  customerName: z.string(),
  overdueMinor: fils,
  overdueInvoiceCount: count,
  oldestDaysOverdue: count,
  invoices: z.array(
    z.object({ id, number: z.string(), dueDate: z.string(), balanceMinor: fils, daysOverdue: count })
  ),
})

export const priceAdjustmentPayloadSchema: z.ZodType<PriceAdjustmentPayload> = z.object({
  itemId: id,
  sku: z.string(),
  itemName: z.string(),
  currentPriceMinor: fils,
  unitCostMinor: fils,
  newPriceMinor: z.number().int().min(0).max(1_000_000_000),
  currentMarginBps: z.number().int().nullable(),
  newMarginBps: z.number().int(),
  marginFloorBps: z.number().int().min(1).max(9000),
  outQuantity: count,
  windowDays: z.number().int().min(1).max(365),
})

export const discountPayloadSchema: z.ZodType<DiscountPayload> = z.object({
  leadId: id,
  leadTitle: z.string(),
  customerId: id,
  customerName: z.string(),
  quotationId: id,
  quoteNumber: z.string(),
  quotationVersion: z.number().int().min(1),
  subtotalMinor: fils,
  discountBps: z.number().int().min(1).max(5000),
  estimatedDiscountMinor: fils,
})

export const leadFollowupPayloadSchema: z.ZodType<LeadFollowupPayload> = z.object({
  leadId: id,
  leadTitle: z.string(),
  stage: z.string(),
  probability: z.number().int().min(0).max(100),
  expectedRevenueMinor: fils,
  daysStalled: count,
  customerId: id,
  customerName: z.string(),
})
