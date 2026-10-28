export const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const
export type AccountType = (typeof accountTypes)[number]

export const entryStatuses = ['draft', 'posted'] as const
export type EntryStatus = (typeof entryStatuses)[number]

export const journalSourceTypes = [
  'manual',
  'reversal',
  'supplier_invoice',
  'goods_receipt',
  'purchase_return',
  'supplier_credit_note',
  'supplier_payment',
  'sales_cogs',
] as const
export type JournalSourceType = (typeof journalSourceTypes)[number]

export const periodStatuses = ['open', 'closed'] as const
export type PeriodStatus = (typeof periodStatuses)[number]

export type Account = {
  id: string
  code: string
  name: string
  type: AccountType
  parentId: string | null
  isPostable: boolean
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type FiscalPeriod = {
  id: string
  name: string
  /** Calendar dates, YYYY-MM-DD. */
  startsOn: string
  endsOn: string
  status: PeriodStatus
  closedAt: string | null
  closedBy: string | null
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type JournalLine = {
  id: string
  lineNo: number
  accountId: string
  accountCode: string
  accountName: string
  debitMinor: number
  creditMinor: number
  description: string
}

export type JournalEntry = {
  id: string
  number: number
  entryDate: string
  memo: string
  currency: 'KWD'
  status: EntryStatus
  sourceType: JournalSourceType
  /** The document that made the entry (a supplier invoice). Null for manual entries and reversals. */
  sourceId: string | null
  reversesId: string | null
  reversedById: string | null
  periodId: string | null
  postedAt: string | null
  postedBy: string | null
  lineCount: number
  totalDebitMinor: number
  totalCreditMinor: number
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type JournalEntryDetail = JournalEntry & { lines: JournalLine[] }

/** One account on the trial balance. The net of debits and credits sits in one column. */
export type TrialBalanceRow = {
  accountId: string
  code: string
  name: string
  type: AccountType
  debitMinor: number
  creditMinor: number
}

export type TrialBalance = {
  from: string | null
  to: string
  rows: TrialBalanceRow[]
  totalDebitMinor: number
  totalCreditMinor: number
  balanced: boolean
}
