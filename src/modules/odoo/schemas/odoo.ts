import { z } from 'zod'
import { odooModels } from '@/modules/odoo/domain/odoo'

export const pullOdooSchema = z.object({
  database: z.string().trim().min(1).max(80).optional(),
  login: z.string().trim().min(3).max(200).optional(),
  secret: z.string().min(1).max(200).optional(),
  sessionId: z.string().regex(/^[A-Za-z0-9._-]{8,128}$/).optional(),
  models: z.array(z.enum(odooModels)).min(1).max(odooModels.length).optional(),
}).superRefine((value, ctx) => {
  const password = Boolean(value.database && value.login && value.secret)
  const session = Boolean(value.sessionId)
  if (password === session) {
    ctx.addIssue({ code: 'custom', message: 'Provide either the database login or the session id.' })
  }
})

export type PullOdooInput = z.output<typeof pullOdooSchema>
