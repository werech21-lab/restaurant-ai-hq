import { z } from 'zod'
import { pageQuerySchema } from '@/lib/api/cursor'
import { accountTypes } from '@/modules/finance/domain/ledger-types'
import { MAX_LINE_MINOR } from '@/modules/finance/domain/ledger'

const uuid = z.string().uuid()
const versionField = z.number().int().min(1)

export const ledgerIdParamsSchema = z.object({ id: uuid })

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'Not a real calendar date')

const currency = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .default('KWD')

// ---- accounts ----

export const createAccountSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/, 'Letters, digits, dot, dash and underscore only')
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(200),
  type: z.enum(accountTypes),
  parentId: uuid.nullable().default(null),
  isPostable: z.boolean().default(true),
})
export type CreateAccountInput = z.output<typeof createAccountSchema>

/** Code, type and parent are an account's identity and cannot change. */
export const updateAccountSchema = z.object({
  version: versionField,
  name: z.string().trim().min(1).max(200),
  isActive: z.boolean(),
})
export type UpdateAccountInput = z.output<typeof updateAccountSchema>

export const listAccountsQuerySchema = pageQuerySchema.extend({
  type: z.enum(accountTypes).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
})
export type ListAccountsQuery = z.output<typeof listAccountsQuerySchema>

// ---- fiscal periods ----

export const createPeriodSchema = z
  .object({ name: z.string().trim().min(1).max(100), startsOn: isoDate, endsOn: isoDate })
  .refine((value) => value.endsOn >= value.startsOn, { message: 'The period must end on or after its start', path: ['endsOn'] })
export type CreatePeriodInput = z.output<typeof createPeriodSchema>

export const closePeriodSchema = z.object({ version: versionField })
export type ClosePeriodInput = z.output<typeof closePeriodSchema>

export const listPeriodsQuerySchema = pageQuerySchema.extend({ status: z.enum(['open', 'closed', 'all']).default('all') })
export type ListPeriodsQuery = z.output<typeof listPeriodsQuerySchema>

// ---- journal entries ----

const amount = z.number().int().min(0).max(MAX_LINE_MINOR)

export const journalLineSchema = z
  .object({
    accountId: uuid,
    debitMinor: amount.default(0),
    creditMinor: amount.default(0),
    description: z.string().trim().max(300).default(''),
  })
  .refine((line) => (line.debitMinor > 0) !== (line.creditMinor > 0), {
    message: 'A line is either a debit or a credit above zero',
    path: ['debitMinor'],
  })
export type JournalLineInput = z.output<typeof journalLineSchema>

const entryFields = {
  entryDate: isoDate,
  memo: z.string().trim().max(500).default(''),
  currency,
  lines: z.array(journalLineSchema).min(2).max(200),
}

export const createJournalEntrySchema = z.object(entryFields)
export type CreateJournalEntryInput = z.output<typeof createJournalEntrySchema>

export const updateJournalEntrySchema = z.object({ version: versionField, ...entryFields })
export type UpdateJournalEntryInput = z.output<typeof updateJournalEntrySchema>

export const postJournalEntrySchema = z.object({ version: versionField })
export type PostJournalEntryInput = z.output<typeof postJournalEntrySchema>

/** The reversing entry needs its own date, because the original's period may already be closed. */
export const reverseJournalEntrySchema = z.object({
  version: versionField,
  entryDate: isoDate,
  memo: z.string().trim().max(500).default(''),
})
export type ReverseJournalEntryInput = z.output<typeof reverseJournalEntrySchema>

export const listJournalEntriesQuerySchema = pageQuerySchema.extend({
  status: z.enum(['draft', 'posted', 'all']).default('all'),
  from: isoDate.optional(),
  to: isoDate.optional(),
})
export type ListJournalEntriesQuery = z.output<typeof listJournalEntriesQuerySchema>

export const trialBalanceQuerySchema = z.object({ from: isoDate.optional(), to: isoDate })
export type TrialBalanceQuery = z.output<typeof trialBalanceQuerySchema>
