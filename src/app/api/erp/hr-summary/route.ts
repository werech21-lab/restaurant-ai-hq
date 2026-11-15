import { NextResponse, type NextRequest } from 'next/server'
import { isSameSiteRequest } from '@/lib/odoo/live-sync-core'
import {
  fetchLiveOdooHrSummary,
  sanitizeOdooPublicPayload,
} from '@/lib/odoo-live-connector'
import {
  odooSyncResponseHeaders,
  resolveVerifiedSyncCaller,
} from '@/app/api/odoo-sync/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET `/api/erp/hr-summary`:
 * Authenticates the active ERP session and queries Odoo 17 `hr.employee`
 * scoped by `company_id` with safe `check_access_rights` verification.
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
        message: 'Sign in to query Odoo HR summary.',
      },
      {
        status: 401,
        headers: { ...odooSyncResponseHeaders, 'www-authenticate': 'Session' },
      },
    )
  }

  try {
    const summary = await fetchLiveOdooHrSummary()
    return NextResponse.json(
      sanitizeOdooPublicPayload({
        ok: true,
        readOnly: caller.isAuditor,
        role: caller.role,
        ...summary,
        hrSummary: summary,
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
        accessGranted: false,
        noData: true,
        messageAr: 'لا توجد بيانات من Odoo عن الموظفين',
        odooCompanyId: null,
        lastSyncAt: null,
        isStale24h: false,
        totals: {
          activeEmployeesCount: 0,
          departmentsCount: 0,
          workLocationsCount: 0,
        },
        byDepartment: [],
        byWorkLocation: [],
        hrSummary: null,
      }),
      { status: 200, headers: odooSyncResponseHeaders },
    )
  }
}
