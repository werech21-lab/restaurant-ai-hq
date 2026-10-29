import { z } from 'zod'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const money = z.number().int().min(0).max(1_000_000_000_000)

export const idParamsSchema = z.object({ id: z.string().uuid() })

export const createContractSchema = z.object({
  title: z.string().trim().min(1).max(200),
  counterparty: z.string().trim().min(1).max(200),
  startDate: date,
  endDate: date,
  valueMinor: money,
  renewalAlertDays: z.number().int().min(1).max(365),
  status: z.enum(['active', 'ended']),
})
export type CreateContractInput = z.output<typeof createContractSchema>

export const updateContractSchema = createContractSchema.extend({ version: z.number().int().min(1) })
export type UpdateContractInput = z.output<typeof updateContractSchema>

export const createDocumentSchema = z.object({
  contractId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  issuedOn: date,
})
export type CreateDocumentInput = z.output<typeof createDocumentSchema>

export const createTicketSchema = z.object({
  type: z.enum(['quality_inspection', 'equipment_maintenance']),
  branchId: z.string().uuid().nullable(),
  assetName: z.string().trim().min(1).max(200),
  severity: z.enum(['low', 'medium', 'high']),
  costMinor: money,
  status: z.enum(['open', 'in_progress', 'closed']),
})
export type CreateTicketInput = z.output<typeof createTicketSchema>

export const updateTicketSchema = createTicketSchema.pick({ severity: true, costMinor: true, status: true }).extend({ version: z.number().int().min(1) })
export type UpdateTicketInput = z.output<typeof updateTicketSchema>
