import { z } from 'zod'
import { aggregatorPlatforms, aggregatorZones, escalationActions } from '@/modules/governance/domain/aggregator'

export const aggregatorQuerySchema = z.object({
  platform: z.enum(aggregatorPlatforms).optional(),
  zone: z.enum(aggregatorZones).optional(),
  branch: z.string().trim().min(1).max(120).optional(),
})
export type AggregatorQuery = z.output<typeof aggregatorQuerySchema>

export const scanSchema = z.object({}).strict()
export type ScanInput = z.output<typeof scanSchema>

export const escalationDecisionSchema = z.object({
  action: z.enum(['execute', 'complete']),
  version: z.number().int().min(1),
})
export type EscalationDecisionInput = z.output<typeof escalationDecisionSchema>

export const escalationTypeSchema = z.enum(escalationActions)
