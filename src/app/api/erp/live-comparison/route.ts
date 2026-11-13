import { NextResponse, type NextRequest } from 'next/server'
import { isSameSiteRequest } from '@/lib/odoo/live-sync-core'
import {
  fetchLiveOdooComparisonOverlay,
  sanitizeOdooPublicPayload,
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
 * - Authenticated (`200 OK`) for all 4 roles (`admin`, `gm`, `dgm`, `auditor`); `401` if unauthenticated.
 * - Accepts `?dateA=YYYY-MM-DD&toA=...&dateB=YYYY-MM-DD&toB=...&brand=...&branch=...&channel=...`
 * - Queries live Odoo 17 `read_group` aggregates in `Asia/Kuwait` (`UTC+3`) time (with 60s server cache + baseline fallback)
 *   so Company Summary, Sales, and Custom Date Comparison ALWAYS return 100% unified numbers with `0.000 KWD` gap.
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
  const isoRe = /^\d{4}-\d{2}-\d{2}$/

  const dateA = isoRe.test(sp.get('dateA') ?? '')
    ? (sp.get('dateA') as string)
    : DEFAULT_COMPARISON_DATE_A
  const toA = isoRe.test(sp.get('toA') ?? '') ? (sp.get('toA') as string) : dateA
  const dateB = isoRe.test(sp.get('dateB') ?? '')
    ? (sp.get('dateB') as string)
    : DEFAULT_COMPARISON_DATE_B
  const toB = isoRe.test(sp.get('toB') ?? '') ? (sp.get('toB') as string) : dateB

  const mode: ComparisonModeType =
    sp.get('mode') === 'entity-vs-entity' ? 'entity-vs-entity' : 'date-vs-date'
  const granularity: ComparisonGranularity =
    sp.get('granularity') === 'range' || dateA !== toA || dateB !== toB ? 'range' : 'single'

  const brandIds = parseMultiIdParam<BrandEntityId>(sp.get('brand'), APPROVED_BRAND_IDS)
  const branchIds = parseMultiIdParam<BranchEntityId>(sp.get('branch'), APPROVED_BRANCH_IDS)
  const channelIds = parseMultiIdParam<ChannelEntityId>(sp.get('channel'), APPROVED_CHANNEL_IDS)
  const entityDimension: EntityComparisonDimension =
    sp.get('entityDimension') === 'branch' ? 'branch' : 'brand'

  const query: ErpComparisonQuery = {
    mode,
    granularity,
    periodA: { from: dateA, to: toA },
    periodB: { from: dateB, to: toB },
    brandIds,
    branchIds,
    channelIds,
    entityDimension,
    entityA: (sp.get('entityA') as BrandEntityId | BranchEntityId) || undefined,
    entityB: (sp.get('entityB') as BrandEntityId | BranchEntityId) || undefined,
  }

  const liveOverlay = await fetchLiveOdooComparisonOverlay({
    fromA: dateA,
    toA,
    fromB: dateB,
    toB,
    readOnly: caller.isAuditor,
    referenceNowMs: Date.now(),
  })

  const comparison = computeErpComparison(query, liveOverlay)

  return NextResponse.json(
    sanitizeOdooPublicPayload({
      ok: true,
      readOnly: caller.isAuditor,
      role: caller.role,
      connected: liveOverlay.connected,
      sourceMode: liveOverlay.sourceMode,
      latestRecordAt: liveOverlay.latestRecordAt,
      latestRecordKuwaitIso: liveOverlay.latestRecordKuwaitIso,
      kuwaitSyncedAt: liveOverlay.kuwaitSyncedAt,
      hoursSinceLatestRecord: liveOverlay.hoursSinceLatestRecord,
      isStaleOver24h: liveOverlay.isStaleOver24h,
      syncCooldownRemainingSec: liveOverlay.syncCooldownRemainingSec,
      diagnosticCode: liveOverlay.diagnosticCode,
      database: null,
      dailySeries: liveOverlay.dailySeries ?? [],
      hourlySeries: liveOverlay.hourlySeries ?? [],
      comparison,
    }),
    { status: 200, headers: odooSyncResponseHeaders },
  )
}
