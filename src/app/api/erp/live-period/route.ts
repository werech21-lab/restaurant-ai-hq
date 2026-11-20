import { NextResponse, type NextRequest } from 'next/server'
import { stripExcludedOdooTree } from '@/lib/odoo/excluded-entities'
import { isSameSiteRequest } from '@/lib/odoo/live-sync-core'
import {
  bustOdooLiveCache,
  fetchLiveOdooPeriodCube,
  fetchLiveOdooPeriodHourly,
  sanitizeOdooPublicPayload,
  type OdooPeriodCube,
  type OdooPeriodHourly,
} from '@/lib/odoo-live-connector'
import {
  buildOdooReadResponseHeaders,
  createServerGetInflightMap,
  deduplicateServerGet,
  isForceRefreshSearchParams,
  odooSyncResponseHeaders,
  resolveVerifiedSyncCaller,
} from '@/app/api/odoo-sync/route'
import { getKuwaitTimeContext } from '@/lib/aether/period-delta'
import { sanitizeIsoDate } from '@/lib/erp-comparison-engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

interface LivePeriodBundle {
  cube: OdooPeriodCube
  hourly: OdooPeriodHourly
}

const livePeriodGetInflight = createServerGetInflightMap<LivePeriodBundle>()

function withoutFullMenuCatalog(cube: OdooPeriodCube): OdooPeriodCube {
  if (!cube.menuProducts) return cube
  const { menuProducts: _omitCatalog, ...rest } = cube
  void _omitCatalog
  return rest
}

/**
 * GET `/api/erp/live-period`:
 * Authenticated read-only single-window Odoo 17 period cube + hourly breakdown
 * with server-side in-flight GET deduplication and SWR `Cache-Control` headers.
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
        message: 'Sign in to query live period telemetry.',
      },
      {
        status: 401,
        headers: { ...odooSyncResponseHeaders, 'www-authenticate': 'Session' },
      },
    )
  }

  const ctx = getKuwaitTimeContext()
  const sp = request.nextUrl.searchParams
  const defaultFrom = `${ctx.todayIso.slice(0, 8)}01`
  const fromIso = sanitizeIsoDate(sp.get('from') ?? sp.get('dateFrom'), defaultFrom)
  const toIso = sanitizeIsoDate(sp.get('to') ?? sp.get('dateTo'), ctx.todayIso)
  const forceRefresh = caller.isCron || isForceRefreshSearchParams(sp)
  const responseHeaders = buildOdooReadResponseHeaders(forceRefresh)

  if (forceRefresh && !caller.isAuditor) {
    bustOdooLiveCache()
  }

  try {
    const { cube, hourly } = await deduplicateServerGet(
      livePeriodGetInflight,
      `${fromIso}:${toIso}`,
      forceRefresh,
      async () => {
        const fetchedCube = await fetchLiveOdooPeriodCube(fromIso, toIso)
        const fetchedHourly: OdooPeriodHourly = fetchedCube.connected
          ? {
              connected: true,
              available: fetchedCube.hourlyAvailable !== false,
              dateRange: fetchedCube.dateRange,
              hourlySeries:
                fetchedCube.hourlyAvailable === false ? [] : fetchedCube.hourlySeries,
            }
          : await fetchLiveOdooPeriodHourly(fromIso, toIso)
        return { cube: fetchedCube, hourly: fetchedHourly }
      },
    )

    if (!cube.connected) {
      return NextResponse.json(
        sanitizeOdooPublicPayload(
          stripExcludedOdooTree({
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
            cube: null,
            hourly,
            dailySeries: [],
            hourlySeries: [],
          }),
        ),
        { status: 200, headers: responseHeaders },
      )
    }

    const compactCube = withoutFullMenuCatalog(cube)
    return NextResponse.json(
      sanitizeOdooPublicPayload(
        stripExcludedOdooTree({
          ok: true,
          readOnly: caller.isAuditor,
          role: caller.role,
          connected: true,
          sourceMode: 'odoo17-live',
          noData: Boolean(cube.noData),
          ...(cube.noData ? { messageAr: 'لا توجد بيانات من Odoo لهذه الفترة' } : {}),
          lastSyncAt: cube.lastSyncAt,
          isStale24h: cube.isStale24h,
          odooCompanyId: cube.odooCompanyId,
          dateRange: cube.dateRange,
          cube: compactCube,
          hourly,
          dailySeries: cube.dailySeries,
          hourlySeries: cube.hourlySeries,
        }),
      ),
      { status: 200, headers: responseHeaders },
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
        cube: null,
        dailySeries: [],
        hourlySeries: [],
      }),
      { status: 200, headers: odooSyncResponseHeaders },
    )
  }
}
