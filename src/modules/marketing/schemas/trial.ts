import { z } from 'zod'

/** Public trial / contact request from the marketing landing page. */
export const trialRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\-\s]{8,32}$/, 'Invalid phone number'),
  companyName: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
})

export type TrialRequestInput = z.output<typeof trialRequestSchema>
