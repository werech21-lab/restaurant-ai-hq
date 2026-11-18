import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { odooSyncResponseHeaders, resolveVerifiedSyncCaller } from '@/app/api/odoo-sync/route'
import { logger } from '@/lib/logger'
import { isSameSiteRequest } from '@/lib/odoo/live-sync-core'
import {
  fetchGlBalanceSheet,
  fetchGlTrialBalance,
  probeCrossoveredBudgetReadable,
} from '@/lib/odoo/gl-statements-live'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function error(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: odooSyncResponseHeaders },
  )
}

export async function GET(request: NextRequest) {
  if (!isSameSiteRequest(request.headers)) {
    return error(403, 'forbidden', 'Cross-site requests are refused.')
  }
  const caller = await resolveVerifiedSyncCaller(request)
  if (!caller) {
    return error(401, 'unauthorized', 'Sign in to read the general ledger.')
  }

  const parsed = querySchema.safeParse({
    from: request.nextUrl.searchParams.get('from'),
    to: request.nextUrl.searchParams.get('to'),
  })
  if (!parsed.success || parsed.data.from > parsed.data.to) {
    return error(422, 'invalid_period', 'from and to must be ISO dates with from on or before to.')
  }

  try {
    const [trialBalance, balanceSheet, budgetReadable] = await Promise.all([
      fetchGlTrialBalance(parsed.data.from, parsed.data.to),
      fetchGlBalanceSheet(parsed.data.to),
      probeCrossoveredBudgetReadable(),
    ])
    return NextResponse.json(
      {
        from: parsed.data.from,
        to: parsed.data.to,
        trialBalance,
        balanceSheet,
        budgetReadable,
      },
      { headers: odooSyncResponseHeaders },
    )
  } catch (err) {
    logger.warn('gl.statements', {
      section: 'gl.statements',
      code: err instanceof Error ? err.name : 'read_failed',
    })
    return error(500, 'gl_read_failed', 'The general ledger could not be read.')
  }
}
