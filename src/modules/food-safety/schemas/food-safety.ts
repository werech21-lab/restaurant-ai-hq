import { z } from 'zod'

export const telemetrySchema = z.object({
  unitId: z.string().min(3).max(120),
  tempC: z.number().min(-40).max(40),
  humidityPct: z.number().min(0).max(100).optional(),
  door: z.enum(['closed', 'open', 'unknown']).optional(),
  recordedAt: z.string().datetime().optional(),
  sensorId: z.string().max(80).optional(),
})

export type TelemetryInput = z.output<typeof telemetrySchema>

export const shiftCheckInSchema = z.object({
  siteId: z.string().min(2).max(40),
  unitId: z.string().min(3).max(120),
  slot: z.enum(['start', 'mid', 'end']),
  supervisorName: z.string().min(2).max(80),
  tempPanelPhotoName: z.string().min(1).max(200),
  productPhotoName: z.string().min(1).max(200),
  reportedTempC: z.number().min(-40).max(40).nullable().optional(),
  notes: z.string().max(400).optional(),
})

export type ShiftCheckInInput = z.output<typeof shiftCheckInSchema>

export const createBatchSchema = z.object({
  siteId: z.string().min(2).max(40),
  itemCode: z.string().min(2).max(40),
  preparedBy: z.string().min(2).max(80),
  quantity: z.number().int().min(1).max(10_000),
  preparedAt: z.string().datetime().optional(),
})

export type CreateBatchInput = z.output<typeof createBatchSchema>

export const disposeSchema = z.object({
  siteId: z.string().min(2).max(40),
  itemCode: z.string().min(2).max(40),
  quantity: z.number().int().min(1).max(10_000),
  reason: z.enum(['fridge_breakdown', 'shelf_life_expired', 'poor_storage', 'supplier_defect']),
  photoName: z.string().min(1).max(200),
  createdBy: z.string().min(2).max(80),
  batchId: z.string().max(40).nullable().optional(),
  unitId: z.string().max(120).nullable().optional(),
  unitCostMinor: z.number().int().min(0).max(1_000_000).optional(),
})

export type DisposeInput = z.output<typeof disposeSchema>
