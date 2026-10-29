import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const money = z.number().int().min(0).max(1_000_000_000_000)

export const listQuerySchema = pageQuerySchema
export type ListQuery = z.output<typeof listQuerySchema>

export const createPartnerSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_-]{1,20}$/),
  name: z.string().trim().min(1).max(200),
  commissionBps: z.number().int().min(0).max(10_000),
})
export type CreatePartnerInput = z.output<typeof createPartnerSchema>

export const createOrderSchema = z
  .object({
    partnerId: z.string().uuid(),
    orderedOn: date,
    grossMinor: money,
    commissionMinor: money,
    driverLicenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })
  .refine((value) => value.commissionMinor <= value.grossMinor, { path: ['commissionMinor'], message: 'Commission cannot exceed the order gross.' })
export type CreateOrderInput = z.output<typeof createOrderSchema>

export const settleOrderSchema = z.object({
  orderId: z.string().uuid(),
  settledOn: date,
})
export type SettleOrderInput = z.output<typeof settleOrderSchema>
