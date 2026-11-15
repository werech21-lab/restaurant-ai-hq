import { NextResponse, type NextRequest } from 'next/server'
import { isSameSiteRequest } from '@/lib/odoo/live-sync-core'
import {
  fetchLiveOdooWarehouseChain,
  sanitizeOdooPublicPayload,
} from '@/lib/odoo-live-connector'
import {
  odooSyncResponseHeaders,
  resolveVerifiedSyncCaller,
} from '@/app/api/odoo-sync/route'
import { getKuwaitTimeContext } from '@/lib/aether/period-delta'
import { sanitizeIsoDate } from '@/lib/erp-comparison-engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET `/api/erp/warehouse-chain`:
 * Authenticates the active ERP session and queries live Odoo 17 `stock.move`
 * (`state='done'`), `stock.scrap` (`state='done'`), and `stock.quant`
 * (`location_id.usage='internal'`) for the requested Kuwait date range.
 */
export async function GET(request: NextRequest) {
  if (!isSameSiteRequest(request.headers)) {
    return NextResponse.json(
      { ok: false, error: 'cross_site_refused' },
      { status: 403, headers: odooSyncResponseHeaders },
    )
  }

  const caller = await resolveVerifiedSyncCaller(request)
  if (!caller) {
    return NextResponse.json(
      {
        ok: false,
        error: 'unauthorized',
        message: 'Sign in to query live warehouse telemetry.',
      },
      {
        status: 401,
        headers: { ...odooSyncResponseHeaders, 'www-authenticate': 'Session' },
      },
    )
  }

  const ctx = getKuwaitTimeContext()
  const sp = request.nextUrl.searchParams
  const rawFrom = sp.get('from') ?? sp.get('dateFrom')
  const rawTo = sp.get('to') ?? sp.get('dateTo')

  const defaultFrom = `${ctx.todayIso.slice(0, 8)}01`
  const fromIso = sanitizeIsoDate(rawFrom, defaultFrom)
  const toIso = sanitizeIsoDate(rawTo, ctx.todayIso)

  try {
    const payload = await fetchLiveOdooWarehouseChain(fromIso, toIso)
    if (!payload.connected) {
      return NextResponse.json(
        sanitizeOdooPublicPayload({
          ok: true,
          readOnly: caller.isAuditor,
          role: caller.role,
          connected: false,
          sourceMode: 'disconnected',
          noData: true,
          messageAr: 'لا توجد بيانات من Odoo لهذه الفترة',
          summary: null,
          lastSyncAt: null,
          isStale24h: false,
          odooCompanyId: null,
          dateRange: { from: fromIso, to: toIso },
          database: null,
          warehouseChain: null,
        }),
        { status: 200, headers: odooSyncResponseHeaders },
      )
    }

    return NextResponse.json(
      sanitizeOdooPublicPayload({
        ok: true,
        readOnly: caller.isAuditor,
        role: caller.role,
        ...payload,
        summary: null,
        database: null,
        warehouseChain: payload,
      }),
      { status: 200, headers: odooSyncResponseHeaders },
    )
  } catch {
    return NextResponse.json(
      sanitizeOdooPublicPayload({
        ok: true,
        readOnly: caller.isAuditor,
        role: caller.role,
        connected: false,
        sourceMode: 'disconnected',
        noData: true,
        messageAr: 'لا توجد بيانات من Odoo لهذه الفترة',
        summary: null,
        lastSyncAt: null,
        isStale24h: false,
        odooCompanyId: null,
        dateRange: { from: fromIso, to: toIso },
        database: null,
        warehouseChain: null,
      }),
      { status: 200, headers: odooSyncResponseHeaders },
    )
  }
}
