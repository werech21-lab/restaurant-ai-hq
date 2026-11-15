import { NextResponse, type NextRequest } from 'next/server'
import { isSameSiteRequest } from '@/lib/odoo/live-sync-core'
import {
  fetchLiveOdooPurchaseOrders,
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
 * GET `/api/erp/purchase-orders`:
 * Authenticates the active ERP session and queries live Odoo 17 `purchase.order`
 * and `purchase.order.line` (`state in ['purchase', 'done']`) for the requested Kuwait date range.
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
        message: 'Sign in to query live Odoo purchase orders.',
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
  const rawPartnerId = sp.get('partnerId')
  const rawProductId = sp.get('productId')

  const defaultFrom = `${ctx.todayIso.slice(0, 8)}01`
  const fromIso = sanitizeIsoDate(rawFrom, defaultFrom)
  const toIso = sanitizeIsoDate(rawTo, ctx.todayIso)

  const partnerId =
    rawPartnerId && /^\d+$/.test(rawPartnerId) ? Number(rawPartnerId) : undefined
  const productId =
    rawProductId && /^\d+$/.test(rawProductId) ? Number(rawProductId) : undefined

  try {
    const summary = await fetchLiveOdooPurchaseOrders(fromIso, toIso, {
      partnerId,
      productId,
    })

    if (!summary.connected) {
      return NextResponse.json(
        sanitizeOdooPublicPayload({
          ok: true,
          readOnly: caller.isAuditor,
          role: caller.role,
          connected: false,
          sourceMode: 'disconnected',
          noData: true,
          messageAr: 'لا توجد بيانات من Odoo لهذه الفترة',
          lastSyncAt: null,
          isStale24h: false,
          odooCompanyId: null,
          dateRange: { from: fromIso, to: toIso },
          purchaseOrders: null,
        }),
        { status: 200, headers: odooSyncResponseHeaders },
      )
    }

    return NextResponse.json(
      sanitizeOdooPublicPayload({
        ok: true,
        readOnly: caller.isAuditor,
        role: caller.role,
        ...summary,
        purchaseOrders: summary,
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
        lastSyncAt: null,
        isStale24h: false,
        odooCompanyId: null,
        dateRange: { from: fromIso, to: toIso },
        purchaseOrders: null,
      }),
      { status: 200, headers: odooSyncResponseHeaders },
    )
  }
}
