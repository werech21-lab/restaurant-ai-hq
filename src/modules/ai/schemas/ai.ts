import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { actionTypes, approvalStatuses, insightCategories, insightSeverities, insightStatuses, scenarioOptionKeys } from '@/modules/ai/domain/types'

export const idParamsSchema = z.object({ id: z.string().uuid() })

const version = z.number().int().min(1)

// ---- insights ----

/** `live` is open plus acknowledged, what an executive still has to look at. */
export const insightStatusFilters = ['live', 'all', ...insightStatuses] as const

export const insightSortKeys = ['detectedAt', 'metricValue'] as const
export type InsightSortKey = (typeof insightSortKeys)[number]

export const listInsightsQuerySchema = pageQuerySchema.extend({
  status: z.enum(insightStatusFilters).default('live'),
  severity: z.enum(insightSeverities).optional(),
  category: z.enum(insightCategories).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(insightSortKeys).default('detectedAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
})
export type ListInsightsQuery = z.output<typeof listInsightsQuerySchema>

export const insightVersionSchema = z.object({ version })
export type InsightVersionBody = z.output<typeof insightVersionSchema>

// ---- approvals ----

export const approvalStatusFilters = ['all', ...approvalStatuses] as const

export const approvalSortKeys = ['requestedAt', 'impact'] as const
export type ApprovalSortKey = (typeof approvalSortKeys)[number]

export const listApprovalsQuerySchema = pageQuerySchema.extend({
  status: z.enum(approvalStatusFilters).default('pending'),
  actionType: z.enum(actionTypes).optional(),
  sort: z.enum(approvalSortKeys).default('requestedAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
})
export type ListApprovalsQuery = z.output<typeof listApprovalsQuerySchema>

const note = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value))

export const decideApprovalSchema = z.object({
  version,
  note,
  optionKey: z.enum(scenarioOptionKeys).optional(),
})
export type DecideApprovalBody = z.output<typeof decideApprovalSchema>

// ---- rules ----

export const updateRuleSchema = z.object({
  version,
  name: z.string().trim().min(1).max(200),
  isActive: z.boolean(),
  conditionJson: z.record(z.string(), z.unknown()),
})
export type UpdateRuleBody = z.output<typeof updateRuleSchema>

// ---- scan and command ----

export const scanBodySchema = z.object({})

export const commandBodySchema = z.object({ text: z.string().trim().min(1).max(200) })
export type CommandBody = z.output<typeof commandBodySchema>
