import { z } from 'zod'

/** Daily screens default to the last 90 days so Odoo archives never slow the open path. */
export const HOT_WINDOW_DAYS = 90
export const dataScopes = ['hot', 'archive'] as const
export type DataScope = (typeof dataScopes)[number]

export const dataScopeQuerySchema = z.object({
  scope: z.enum(dataScopes).default('hot'),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export type DataScopeQuery = z.output<typeof dataScopeQuerySchema>

export type ScopeBounds = {
  mode: DataScope
  fromDate: string | null
  toDate: string | null
}

function utcDateOnly(daysAgo: number): string {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

/** Resolves the SQL date window for list endpoints. Archive with no range = full history. */
export function resolveScopeBounds(input: Partial<DataScopeQuery> | undefined): ScopeBounds {
  const scope = input?.scope === 'archive' ? 'archive' : 'hot'
  const from = input?.from ?? null
  const to = input?.to ?? null
  if (from || to) {
    return { mode: scope, fromDate: from, toDate: to }
  }
  if (scope === 'hot') {
    return { mode: 'hot', fromDate: utcDateOnly(HOT_WINDOW_DAYS), toDate: null }
  }
  return { mode: 'archive', fromDate: null, toDate: null }
}

/**
 * Appends date filters. `columnSql` must be a trusted identifier fragment
 * (e.g. `issue_date` or `m.created_at::date`), never user input.
 */
export function appendScopeFilter(
  filters: string,
  params: unknown[],
  columnSql: string,
  bounds: ScopeBounds
): string {
  let next = filters
  if (bounds.fromDate) {
    params.push(bounds.fromDate)
    next += ` and ${columnSql} >= $${params.length}::date`
  }
  if (bounds.toDate) {
    params.push(bounds.toDate)
    next += ` and ${columnSql} <= $${params.length}::date`
  }
  return next
}
