import { z } from 'zod'
import { odooModels } from '@/modules/odoo/domain/odoo'

export const pullOdooSchema = z.object({
  database: z.string().trim().min(1).max(80),
  login: z.string().trim().min(3).max(200),
  secret: z.string().min(1).max(200),
  models: z.array(z.enum(odooModels)).min(1).max(odooModels.length).optional(),
})

export type PullOdooInput = z.output<typeof pullOdooSchema>
