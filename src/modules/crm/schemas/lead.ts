import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { leadStages, openLeadStages } from '@/modules/crm/domain/types'
import { MAX_MINOR, nullableIsoDate, nullableUuid, optionalText, versionField } from '@/modules/crm/schemas/common'

const leadFields = {
  title: z.string().trim().min(1).max(200),
  expectedRevenueMinor: z.number().int().min(0).max(MAX_MINOR),
  /** Whole percent chosen by the salesperson. The system never guesses it. */
  probability: z.number().int().min(0).max(100),
  assignedTo: nullableUuid,
  expectedCloseDate: nullableIsoDate,
  notes: optionalText(2000),
}

/** A lead starts in an open stage. It becomes won or lost only by a stage move. */
export const createLeadSchema = z.object({
  ...leadFields,
  customerId: z.string().uuid(),
  stage: z.enum(openLeadStages).default('new'),
})

export type CreateLeadInput = z.output<typeof createLeadSchema>

export const updateLeadSchema = z.object({ ...leadFields, version: versionField })

export type UpdateLeadInput = z.output<typeof updateLeadSchema>

export const moveLeadSchema = z.object({ stage: z.enum(leadStages), version: versionField })

export type MoveLeadInput = z.output<typeof moveLeadSchema>

export const leadSortKeys = ['createdAt', 'expectedRevenueMinor', 'title'] as const
export type LeadSortKey = (typeof leadSortKeys)[number]

export const listLeadsQuerySchema = pageQuerySchema.extend({
  stage: z.enum(leadStages).optional(),
  customerId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(leadSortKeys).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
})

export type ListLeadsQuery = z.output<typeof listLeadsQuerySchema>
