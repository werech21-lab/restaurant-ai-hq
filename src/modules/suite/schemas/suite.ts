import { z } from 'zod'
import { suiteApps } from '@/modules/suite/domain/apps'

export const suiteAppParamsSchema = z.object({
  app: z.enum(suiteApps),
})

export const suiteRecordParamsSchema = z.object({
  app: z.enum(suiteApps),
  id: z.string().uuid(),
})

export const createSuiteRecordSchema = z.object({
  title: z.string().trim().min(1).max(200),
  stage: z.string().trim().min(1).max(40),
  brandName: z.string().trim().max(80).default(''),
  branchName: z.string().trim().max(80).default(''),
  department: z.string().trim().max(80).default(''),
  assignee: z.string().trim().max(120).default(''),
  amountMinor: z.number().int().min(0).max(1_000_000_000_000).default(0),
  startsOn: z.string().date().nullable().optional(),
  endsOn: z.string().date().nullable().optional(),
})

export type CreateSuiteRecordInput = z.output<typeof createSuiteRecordSchema>

export const updateSuiteRecordSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().trim().min(1).max(200),
  stage: z.string().trim().min(1).max(40),
  brandName: z.string().trim().max(80),
  branchName: z.string().trim().max(80),
  department: z.string().trim().max(80),
  assignee: z.string().trim().max(120),
  amountMinor: z.number().int().min(0).max(1_000_000_000_000),
  startsOn: z.string().date().nullable(),
  endsOn: z.string().date().nullable(),
})

export type UpdateSuiteRecordInput = z.output<typeof updateSuiteRecordSchema>
