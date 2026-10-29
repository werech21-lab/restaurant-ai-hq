import { z } from 'zod'
import { gateActions } from '@/modules/governance/domain/gate'
import { archiveCategories } from '@/modules/governance/domain/ocr'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const money = z.number().int().min(0).max(1_000_000_000_000)

export const idParamsSchema = z.object({ id: z.string().uuid() })

export const analyzeSchema = z.object({ contractId: z.string().uuid() })
export type AnalyzeInput = z.output<typeof analyzeSchema>

export const enforceSchema = z.object({ version: z.number().int().min(1) })
export type EnforceInput = z.output<typeof enforceSchema>

export const simulateSchema = z.object({
  actionType: z.enum(gateActions),
  licenseExpiry: date.nullable().optional(),
  workedMinutes: z.number().int().min(0).max(24 * 60).optional(),
  cashMinor: money.optional(),
})
export type SimulateInput = z.output<typeof simulateSchema>

export const archiveSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  documentCategory: z.enum(archiveCategories),
  text: z.string().max(8_000),
})
export type ArchiveInput = z.output<typeof archiveSchema>

export const telemetrySchema = z.object({
  activePath: z.string().trim().min(1).max(200),
  actionSequence: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
  dwellTimeSeconds: z.number().int().min(0).max(86_400),
})
export type TelemetryInput = z.output<typeof telemetrySchema>

export const radarSchema = z.object({
  competitorName: z.string().trim().min(1).max(120),
  marketSegment: z.string().trim().min(1).max(80),
  itemOrService: z.string().trim().min(1).max(120),
  ourPriceMinor: money,
  competitorPriceMinor: money,
  promoDetectedAr: z.string().trim().max(300),
})
export type RadarInput = z.output<typeof radarSchema>
