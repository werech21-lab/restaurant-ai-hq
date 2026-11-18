import { NextResponse, type NextRequest } from 'next/server'
import { isSameSiteRequest } from '@/lib/odoo/live-sync-core'
import {
  fetchLiveOdooPeriodCube,
  fetchLiveOdooPeriodHourly,
  sanitizeOdooPublicPayload,
  type OdooPeriodHourly,
} from '@/lib/odoo-live-connector'
import {
  odooSyncResponseHeaders,
  resolveVerifiedSyncCaller,
} from '@/app/api/odoo-sync/route'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
} from '@/lib/aether/global-filter-engine'
import {
  computeErpComparison,
  DEFAULT_COMPARISON_DATE_A,
  DEFAULT_COMPARISON_DATE_B,
  normalizeComparisonQueryWindows,
  sanitizeIsoDate,
  type BranchEntityId,
  type BrandEntityId,
  type ChannelEntityId,
  type ComparisonGranularity,
  type ComparisonModeType,
  type EntityComparisonDimension,
  type ErpComparisonQuery,
} from '@/lib/erp-comparison-engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

function parseMultiIdParam<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): 'all' | readonly T[] {
  if (!raw || raw === 'all') return 'all'
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is T => (allowed as readonly string[]).includes(s))
  return items.length > 0 && items.length < allowed.length ? items : 'all'
}

/**
 * GET `/api/erp/live-comparison`:
 * Authenticates the active ERP session, fetches live Odoo 17 period cubes
 * (`fetchLiveOdooPeriodCube`) for Period A & Period B, and computes every
 * comparison row (7 operational branches + standalone 8th «غير منسوب لفرع»,
 * 6 brands, payment channels, and hourly/daily series) strictly from live
 * Odoo JSON-RPC data with zero static fallbacks.
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
        message: 'Sign in to query live comparison telemetry.',
      },
      {
        status: 401,
        headers: { ...odooSyncResponseHeaders, 'www-authenticate': 'Session' },
      },
    )
  }

  const sp = request.nextUrl.searchParams
  const dateA = sanitizeIsoDate(
    sp.get('dateA') ?? sp.get('fromA'),
    DEFAULT_COMPARISON_DATE_A,
  )
  const toA = sanitizeIsoDate(sp.get('toA'), dateA)
  const dateB = sanitizeIsoDate(
    sp.get('dateB') ?? sp.get('fromB'),
    DEFAULT_COMPARISON_DATE_B,
  )
  const toB = sanitizeIsoDate(sp.get('toB'), dateB)

  const mode: ComparisonModeType =
    sp.get('mode') === 'entity-vs-entity' ? 'entity-vs-entity' : 'date-vs-date'
  const granularity: ComparisonGranularity =
    sp.get('granularity') === 'range' || dateA !== toA || dateB !== toB ? 'range' : 'single'

  const brandIds = parseMultiIdParam<BrandEntityId>(sp.get('brand'), APPROVED_BRAND_IDS)
  const branchIds = parseMultiIdParam<BranchEntityId>(sp.get('branch'), APPROVED_BRANCH_IDS)
  const channelIds = parseMultiIdParam<ChannelEntityId>(sp.get('channel'), APPROVED_CHANNEL_IDS)
  const entityDimension: EntityComparisonDimension =
    sp.get('entityDimension') === 'branch' || sp.get('entityDim') === 'branch'
      ? 'branch'
      : 'brand'

  const sameHoursLikeForLike =
    sp.get('sameHours') === '1' || sp.get('sameHoursLikeForLike') === 'true'

  const rawEntA = sp.get('entityA')
  const rawEntB = sp.get('entityB')
  const entityA =
    rawEntA &&
    ((APPROVED_BRAND_IDS as readonly string[]).includes(rawEntA) ||
      (APPROVED_BRANCH_IDS as readonly string[]).includes(rawEntA))
      ? (rawEntA as BrandEntityId | BranchEntityId)
      : undefined
  const entityB =
    rawEntB &&
    ((APPROVED_BRAND_IDS as readonly string[]).includes(rawEntB) ||
      (APPROVED_BRANCH_IDS as readonly string[]).includes(rawEntB))
      ? (rawEntB as BrandEntityId | BranchEntityId)
      : undefined

  const query: ErpComparisonQuery = {
    mode,
    granularity,
    periodA: { from: dateA, to: toA },
    periodB: { from: dateB, to: toB },
    brandIds,
    branchIds,
    channelIds,
    entityDimension,
    entityA,
    entityB,
    sameHoursLikeForLike,
  }

  const { normA, normB } = normalizeComparisonQueryWindows(query)
  const sameWindow =
    mode === 'entity-vs-entity' ||
    (normA.fromIso === normB.fromIso && normA.toIso === normB.toIso)

  try {
    const [cubeA, cubeB] = sameWindow
      ? await fetchLiveOdooPeriodCube(normA.fromIso, normA.toIso).then(
          (c) => [c, c] as const,
        )
      : await Promise.all([
          fetchLiveOdooPeriodCube(normA.fromIso, normA.toIso),
          fetchLiveOdooPeriodCube(normB.fromIso, normB.toIso),
        ])

    // Hourly for period A, independent of the rest of the cube: from the cube when it loaded, otherwise
    // from the light hourly read (same register scope). Consumers still require Σ hourly == period total.
    const hourlyA: OdooPeriodHourly = cubeA.connected
      ? {
          connected: true,
          available: cubeA.hourlyAvailable !== false,
          dateRange: cubeA.dateRange,
          hourlySeries: cubeA.hourlyAvailable === false ? [] : cubeA.hourlySeries,
        }
      : await fetchLiveOdooPeriodHourly(normA.fromIso, normA.toIso)

    if (!cubeA.connected || !cubeB.connected) {
      const disconnectedComparison = computeErpComparison(query, null)
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
          dateRange: { from: normA.fromIso, to: normA.toIso },
          database: null,
          cubeA: null,
          cubeB: null,
          hourlyA,
          dailySeries: [],
          dailyByBranch: {},
          dailyUnattributed: {},
          hourlySeries: [],
          comparison: disconnectedComparison,
        }),
        { status: 200, headers: odooSyncResponseHeaders },
      )
    }

    const comparison = computeErpComparison(query, { cubeA, cubeB })

    const dailyMap = new Map<
      string,
      {
        day: string
        orders: number
        netKwd: number
        unattributedNetKwd: number
        unattributedOrders: number
      }
    >()
    for (const row of cubeB.dailySeries) dailyMap.set(row.day, row)
    for (const row of cubeA.dailySeries) dailyMap.set(row.day, row)
    const mergedDailySeries = [...dailyMap.values()].sort((a, b) =>
      a.day.localeCompare(b.day),
    )

    return NextResponse.json(
      sanitizeOdooPublicPayload({
        ok: true,
        readOnly: caller.isAuditor,
        role: caller.role,
        connected: true,
        sourceMode: 'odoo17-live',
        noData: Boolean(cubeA.noData && cubeB.noData),
        ...(cubeA.noData && cubeB.noData
          ? { messageAr: 'لا توجد بيانات من Odoo لهذه الفترة' }
          : {}),
        summary: null,
        lastSyncAt: cubeA.lastSyncAt,
        isStale24h: cubeA.isStale24h || cubeB.isStale24h,
        odooCompanyId: cubeA.odooCompanyId,
        dateRange: {
          from: normA.fromIso < normB.fromIso ? normA.fromIso : normB.fromIso,
          to: normA.toIso > normB.toIso ? normA.toIso : normB.toIso,
        },
        periodA: cubeA.dateRange,
        periodB: cubeB.dateRange,
        database: null,
        cubeA,
        cubeB,
        hourlyA,
        dailySeries: mergedDailySeries,
        dailyByBranch: { ...cubeB.dailyByBranch, ...cubeA.dailyByBranch },
        dailyUnattributed: { ...cubeB.dailyUnattributed, ...cubeA.dailyUnattributed },
        hourlySeries: cubeA.hourlySeries,
        comparison,
      }),
      { status: 200, headers: odooSyncResponseHeaders },
    )
  } catch {
    const disconnectedComparison = computeErpComparison(query, null)
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
        dateRange: { from: normA.fromIso, to: normA.toIso },
        database: null,
        cubeA: null,
        cubeB: null,
        dailySeries: [],
        dailyByBranch: {},
        dailyUnattributed: {},
        hourlySeries: [],
        comparison: disconnectedComparison,
      }),
      { status: 200, headers: odooSyncResponseHeaders },
    )
  }
}
