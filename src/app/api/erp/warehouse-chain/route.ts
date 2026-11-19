import { NextResponse, type NextRequest } from 'next/server'
import { stripExcludedOdooTree } from '@/lib/odoo/excluded-entities'
import { isSameSiteRequest } from '@/lib/odoo/live-sync-core'
import {
  fetchLiveOdooWarehouseChain,
  redactOdooSecrets,
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
export const maxDuration = 60

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
    if (payload.fetchStatus === 'timeout' || payload.fetchStatus === 'error') {
      return NextResponse.json(
        sanitizeOdooPublicPayload({
          ok: false,
          readOnly: caller.isAuditor,
          role: caller.role,
          connected: false,
          sourceMode: 'disconnected',
          noData: false,
          fetchStatus: payload.fetchStatus,
          timedOut: payload.fetchStatus === 'timeout',
          messageAr: payload.messageAr,
          messageEn: payload.messageEn,
          summary: null,
          lastSyncAt: null,
          isStale24h: false,
          odooCompanyId: null,
          dateRange: { from: fromIso, to: toIso },
          database: null,
          warehouseChain: null,
        }),
        {
          status: payload.fetchStatus === 'timeout' ? 504 : 502,
          headers: odooSyncResponseHeaders,
        },
      )
    }
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

    const visible = stripExcludedOdooTree(payload)
    return NextResponse.json(
      sanitizeOdooPublicPayload({
        ok: true,
        readOnly: caller.isAuditor,
        role: caller.role,
        ...visible,
        summary: null,
        database: null,
        warehouseChain: visible,
      }),
      { status: 200, headers: odooSyncResponseHeaders },
    )
  } catch (err) {
    console.error('[warehouse-chain] route', redactOdooSecrets(err instanceof Error ? err.message : 'warehouse route failed'))
    return NextResponse.json(
      sanitizeOdooPublicPayload({
        ok: false,
        readOnly: caller.isAuditor,
        role: caller.role,
        connected: false,
        sourceMode: 'disconnected',
        noData: false,
        fetchStatus: 'error',
        timedOut: false,
        messageAr: 'تعذّر قراءة حركات المخزن من أودو',
        messageEn: 'Warehouse movements could not be read from Odoo.',
        summary: null,
        lastSyncAt: null,
        isStale24h: false,
        odooCompanyId: null,
        dateRange: { from: fromIso, to: toIso },
        database: null,
        warehouseChain: null,
      }),
      { status: 502, headers: odooSyncResponseHeaders },
    )
  }
}
