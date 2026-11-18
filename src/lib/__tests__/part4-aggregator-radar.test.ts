/**
 * Part 4: Delivery platforms page (/erp/aggregator-radar) accuracy & app-wide Calendar MTD preset.
 *
 * All expected sums, percentages, and row metrics are computed dynamically from real fixture inputs
 * (`dashboard-today-2026-11-17.json`, `venturefoods_odoo_cids1_dump.json`, `pos-registry.json`) —
 * zero invented business claims.
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type GlobalFilterContextValue = ReturnType<
  typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
>

const mockGlobalFilterState: { current: GlobalFilterContextValue | null } = {
  current: null,
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/aggregator-radar',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => {
    if (!mockGlobalFilterState.current) {
      throw new Error('mockGlobalFilterState.current must be initialized')
    }
    return mockGlobalFilterState.current
  },
}))

import { CoresHubStudio } from '@/components/aether/CoresHubStudio'
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'
import { FullJourney360 } from '@/components/aether/FullJourney360'
import { OdooSyncPill } from '@/components/aether/OdooSyncPill'
import {
  APPROVED_BRAND_IDS,
  DASHBOARD_BRANCH_CARD_IDS,
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  formatPeriodCalendarWindow,
  getChannelLabel,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { LanguageProvider } from '@/lib/i18n'
import { formatInt, formatKwd, formatPct } from '@/lib/format'
import {
  buildLedgerAccountingFromGroups,
  buildReconciledBucket,
  bustOdooLiveCache,
  fetchLiveOdooSnapshot,
  type OdooPeriodCube,
} from '@/lib/odoo-live-connector'
import type { GlAccountMeta, GlMoveLineGroupRow } from '@/lib/odoo/gl-statements'
import { periodWindowForBucket, type OdooBucketSummary, type OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { loadLiveTodaySummary } from './support/dashboard-fixture'

const TypedLangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const DeliveryRadarWithCube = DeliveryRadarV5 as unknown as React.ComponentType<{
  initialLiveCube?: OdooPeriodCube | null
}>

const TypedCoresHubStudio = CoresHubStudio as unknown as React.ComponentType<{
  initialTab?: 'marketing' | 'sales' | 'menu'
  initialLiveCube?: OdooPeriodCube | null
}>

const AGGREGATOR_KEYS = [
  'talabat-tgo',
  'talabat-tmp',
  'keeta',
  'deliveroo',
  'jahez',
  'snoonu',
] as const

const ALL_CHANNEL_KEYS = ['dine-in', 'takeaway-direct', ...AGGREGATOR_KEYS] as const

const ALL_BRANCH_CARD_IDS = [...DASHBOARD_BRANCH_CARD_IDS] as const

const DUMP_PATH = path.join(
  process.cwd(),
  'backups/odoo-full-dump/venturefoods_odoo_cids1_dump.json',
)
const DUMP_ACCOUNTS = (
  JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8')) as {
    models: { 'account.account': GlAccountMeta[] }
  }
).models['account.account']

function mustDumpAccount(code: string): GlAccountMeta {
  const acc = DUMP_ACCOUNTS.find((a) => a.code === code)
  if (!acc) throw new Error(`Missing account ${code} in ${DUMP_PATH}`)
  return acc
}

const r3 = (v: number): number => {
  const n = Math.round(v * 1000) / 1000
  return n === 0 ? 0 : n
}

const ODOO_ENV_KEYS = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_LOGIN',
  'ODOO_API_KEY',
] as const

const FIXTURE_NOW_NOV_15 = new Date('2026-11-15T12:00:00.000Z') // 15:00 Asia/Kuwait on 2026-11-15

function emptyChannelRecord(): Record<(typeof ALL_CHANNEL_KEYS)[number], { netKwd: number; orders: number }> {
  return Object.fromEntries(
    ALL_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]),
  ) as Record<(typeof ALL_CHANNEL_KEYS)[number], { netKwd: number; orders: number }>
}

function buildMultiBranchFixtureData() {
  const baseSummary = loadLiveTodaySummary()
  const baseToday = baseSummary.buckets!.today!

  // Start from real restaurant branch-channel figures in dashboard-today-2026-11-17.json,
  // and include active restaurants + 'exhibitions' + 'school-canteens' + 'unattributed'.
  const locUiRawMap = new Map<string, Record<string, { netKwd: number; orders: number }>>()
  const locNetMap = new Map<string, number>()
  const locOrdersMap = new Map<string, number>()

  for (const bid of ALL_BRANCH_CARD_IDS) {
    const chMap = emptyChannelRecord()
    const baseCell = baseToday.byLocation?.[bid]
    if (baseCell?.uiChannels) {
      for (const ck of ALL_CHANNEL_KEYS) {
        const entry = baseCell.uiChannels[ck]
        if (entry) {
          chMap[ck] = { netKwd: r3(entry.netKwd), orders: Math.max(0, Math.round(entry.orders)) }
        }
      }
    }
    locUiRawMap.set(bid, chMap)
  }

  // Add real-shape channel splits on active restaurant (avenues), exhibitions, school-canteens, and unattributed
  locUiRawMap.get('avenues')!['dine-in'] = { netKwd: 48.25, orders: 11 }
  locUiRawMap.get('avenues')!['jahez'] = { netKwd: 19.75, orders: 4 }
  locUiRawMap.get('avenues')!['snoonu'] = { netKwd: 11.4, orders: 3 }

  locUiRawMap.get('exhibitions')!['takeaway-direct'] = { netKwd: 26.5, orders: 6 }
  locUiRawMap.get('exhibitions')!['talabat-tgo'] = { netKwd: 34.125, orders: 7 }
  locUiRawMap.get('exhibitions')!['keeta'] = { netKwd: 14.875, orders: 3 }

  locUiRawMap.get('school-canteens')!['dine-in'] = { netKwd: 42.0, orders: 14 }
  locUiRawMap.get('school-canteens')!['deliveroo'] = { netKwd: 18.6, orders: 4 }
  locUiRawMap.get('school-canteens')!['talabat-tmp'] = { netKwd: 12.2, orders: 2 }

  const unmappedUiRaw: Record<string, { netKwd: number; orders: number }> = emptyChannelRecord()
  unmappedUiRaw['talabat-tgo'] = { netKwd: 15.35, orders: 3 }
  unmappedUiRaw['snoonu'] = { netKwd: 8.65, orders: 2 }
  unmappedUiRaw['takeaway-direct'] = { netKwd: 5.1, orders: 1 }

  for (const bid of ALL_BRANCH_CARD_IDS) {
    const ch = locUiRawMap.get(bid)!
    const sumNet = r3(Object.values(ch).reduce((s, x) => s + x.netKwd, 0))
    const sumOrd = Object.values(ch).reduce((s, x) => s + x.orders, 0)
    locNetMap.set(bid, sumNet)
    locOrdersMap.set(bid, sumOrd)
  }

  const unmappedNetKwd = r3(Object.values(unmappedUiRaw).reduce((s, x) => s + x.netKwd, 0))
  const unmappedOrders = Object.values(unmappedUiRaw).reduce((s, x) => s + x.orders, 0)

  const monthBucket = buildReconciledBucket({
    key: 'month',
    from: '2026-11-01',
    to: '2026-11-16',
    days: 15,
    locNetMap,
    locOrdersMap,
    unmappedNetKwd,
    unmappedOrders,
    brandRawWeights: new Map([
      ['china-garden', baseToday.byBrand?.['china-garden']?.netKwd ?? 133.55],
      ['franks', baseToday.byBrand?.franks?.netKwd ?? 23.5],
      ['noodle-bar', baseToday.byBrand?.['noodle-bar']?.netKwd ?? 3.25],
    ]),
    brandQtyWeights: new Map([['china-garden', 30], ['franks', 5], ['noodle-bar', 1]]),
    locUiRawMap,
    unmappedUiRaw,
  })

  // Compute expected aggregator sums dynamically from all branch & unattributed cells
  const expectedByPlatform = Object.fromEntries(
    AGGREGATOR_KEYS.map((ck) => {
      let sales = unmappedUiRaw[ck].netKwd
      let payments = unmappedUiRaw[ck].orders
      for (const bid of ALL_BRANCH_CARD_IDS) {
        const cell = locUiRawMap.get(bid)![ck]
        sales += cell.netKwd
        payments += cell.orders
      }
      return [ck, { salesKwd: r3(sales), payments }]
    }),
  ) as Record<(typeof AGGREGATOR_KEYS)[number], { salesKwd: number; payments: number }>

  const expectedTotalAggSales = r3(
    Object.values(expectedByPlatform).reduce((s, v) => s + v.salesKwd, 0),
  )
  const expectedTotalAggPayments = Object.values(expectedByPlatform).reduce(
    (s, v) => s + v.payments,
    0,
  )

  const byBranchCube = Object.fromEntries(
    ALL_BRANCH_CARD_IDS.map((bid) => {
      const ch = locUiRawMap.get(bid)!
      const net = locNetMap.get(bid)!
      const ord = locOrdersMap.get(bid)!
      return [
        bid,
        {
          netKwd: net,
          orders: ord,
          aovKwd: ord > 0 ? r3(net / ord) : 0,
          channels: ch,
        },
      ]
    }),
  ) as OdooPeriodCube['byBranch']

  const byChannelCube = Object.fromEntries(
    ALL_CHANNEL_KEYS.map((ck) => {
      let net = unmappedUiRaw[ck].netKwd
      let ord = unmappedUiRaw[ck].orders
      for (const bid of ALL_BRANCH_CARD_IDS) {
        net += locUiRawMap.get(bid)![ck].netKwd
        ord += locUiRawMap.get(bid)![ck].orders
      }
      return [ck, { netKwd: r3(net), orders: ord }]
    }),
  ) as OdooPeriodCube['byChannel']

  const mappedNet = r3(ALL_BRANCH_CARD_IDS.reduce((s, bid) => s + locNetMap.get(bid)!, 0))
  const mappedOrd = ALL_BRANCH_CARD_IDS.reduce((s, bid) => s + locOrdersMap.get(bid)!, 0)
  const companyNet = r3(mappedNet + unmappedNetKwd)
  const companyOrd = mappedOrd + unmappedOrders

  const cube: OdooPeriodCube = {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-15T12:00:00.000Z',
    isStale24h: false,
    dateRange: { from: '2026-11-01', to: '2026-11-15' },
    days: 15,
    totals: {
      netSalesKwd: companyNet,
      orders: companyOrd,
      aovKwd: companyOrd > 0 ? r3(companyNet / companyOrd) : 0,
      mappedBranchesNetKwd: mappedNet,
      mappedBranchesOrders: mappedOrd,
      unattributedSalesKwd: unmappedNetKwd,
      unattributedOrders: unmappedOrders,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 0,
      avgDiscountPct: 0,
      discountedLinesCount: 0,
    },
    byBranch: byBranchCube,
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netKwd: unmappedNetKwd,
      orders: unmappedOrders,
      aovKwd: unmappedOrders > 0 ? r3(unmappedNetKwd / unmappedOrders) : 0,
      channels: unmappedUiRaw,
    },
    byBrand: Object.fromEntries(
      APPROVED_BRAND_IDS.map((bid) => [
        bid,
        {
          netKwd: monthBucket.byBrand?.[bid]?.netKwd ?? 0,
          qty: monthBucket.byBrand?.[bid]?.qty ?? 0,
          linesCount: 0,
          orders: 0,
          avgDiscountPct: 0,
          discountKwd: 0,
        },
      ]),
    ) as OdooPeriodCube['byBrand'],
    brandByBranch: {},
    byChannel: byChannelCube,
    dailySeries: [
      {
        day: '2026-11-15',
        orders: companyOrd,
        netKwd: companyNet,
        unattributedNetKwd: unmappedNetKwd,
        unattributedOrders: unmappedOrders,
      },
    ],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [],
    hourlyByBranch: {},
    topProducts: [],
  }

  const summary: OdooLiveSummary = {
    ...baseSummary,
    latestOperationalDate: '2026-11-15',
    dateRange: { from: '2026-11-01', to: '2026-11-15' },
    period: { from: '2026-11-01', to: '2026-11-15' },
    totals: monthBucket.totals,
    unattributedSalesKwd: unmappedNetKwd,
    unattributedOrders: unmappedOrders,
    unattributedBranch: monthBucket.unattributedBranch ?? null,
    buckets: {
      month: monthBucket,
      today: { ...monthBucket, key: 'today', from: '2026-11-15', to: '2026-11-16', days: 1 },
      week: { ...monthBucket, key: 'week', from: '2026-11-09', to: '2026-11-16', days: 7 },
    },
    dailySeries: [{ day: '2026-11-15', orders: companyOrd, netKwd: companyNet }],
  }

  return {
    locUiRawMap,
    unmappedUiRaw,
    monthBucket,
    cube,
    summary,
    expectedByPlatform,
    expectedTotalAggSales,
    expectedTotalAggPayments,
  }
}

function renderRadar(
  locale: 'ar' | 'en',
  summary: OdooLiveSummary,
  filtersOverride: Partial<GlobalFilters> = {},
  liveCube: OdooPeriodCube | null = null,
): string {
  const filters: GlobalFilters = {
    ...DEFAULT_GLOBAL_FILTERS,
    period: 'month',
    ...filtersOverride,
  }
  mockGlobalFilterState.current = {
    filters,
    workspace: computeGlobalWorkspace(filters, summary, '/erp/aggregator-radar'),
    liveSummary: summary,
    sessionRole: 'admin',
  } as unknown as GlobalFilterContextValue

  return renderToStaticMarkup(
    React.createElement(
      TypedLangProvider,
      { initialLocale: locale },
      React.createElement(DeliveryRadarWithCube, { initialLiveCube: liveCube }),
    ),
  )
}

function stripTags(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseKwdNumber(text: string): number {
  const m = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!m) throw new Error(`Cannot parse KWD from "${text}"`)
  return Number(m[0])
}

function parseIntNumber(text: string): number {
  const m = text.replace(/,/g, '').match(/-?\d+/)
  if (!m) throw new Error(`Cannot parse int from "${text}"`)
  return Number(m[0])
}

function extractArticleContaining(html: string, marker: string): string {
  const idx = html.indexOf(marker)
  if (idx < 0) throw new Error(`Marker "${marker}" not found in HTML`)
  const start = html.lastIndexOf('<article', idx)
  const end = html.indexOf('</article>', idx)
  if (start < 0 || end < 0) throw new Error(`Unbalanced <article> around "${marker}"`)
  return html.slice(start, end + '</article>'.length)
}

function parseMatrixFromHtml(html: string) {
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)
  if (!tbodyMatch) throw new Error('Matrix <tbody> not found')
  const rowMatches = [...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
  const rows = rowMatches.map((rm) => {
    const cells = [...rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cm) => stripTags(cm[1]))
    return {
      branchLabel: cells[0],
      platformLabel: cells[1],
      salesKwd: parseKwdNumber(cells[2]),
      payments: parseIntNumber(cells[3]),
    }
  })

  const totalSalesMatch = html.match(/data-matrix-total-sales="true"[^>]*>([\s\S]*?)<\/td>/)
  const totalPaymentsMatch = html.match(/data-matrix-total-payments="true"[^>]*>([\s\S]*?)<\/td>/)
  if (!totalSalesMatch || !totalPaymentsMatch) {
    throw new Error('Matrix <tfoot> totals not found')
  }

  return {
    rows,
    totalSalesKwd: parseKwdNumber(stripTags(totalSalesMatch[1])),
    totalPayments: parseIntNumber(stripTags(totalPaymentsMatch[1])),
  }
}

function parseKpi1FromHtml(html: string, isAr: boolean) {
  const article = extractArticleContaining(
    html,
    isAr ? 'إجمالي مبيعات منصات التوصيل' : 'Aggregator POS Sales',
  )
  const divMatch = article.match(/<div dir="ltr"[^>]*>([\s\S]*?)<\/div>/)
  const pMatch = article.match(/<p class="mt-1\.5[^>]*>([\s\S]*?)<\/p>/)
  if (!divMatch || !pMatch) throw new Error('KPI 1 value/subtitle not found')
  const pText = stripTags(pMatch[1])
  const payMatch = isAr ? pText.match(/عدد الدفعات:\s*([\d,]+)/) : pText.match(/([\d,]+)\s*payments/)
  if (!payMatch) throw new Error(`KPI 1 payment count not found in "${pText}"`)
  return {
    salesKwd: parseKwdNumber(stripTags(divMatch[1])),
    payments: parseIntNumber(payMatch[1]),
  }
}

function parseDonutFromHtml(html: string, isAr: boolean) {
  const sectionStart = html.indexOf(isAr ? 'توزيع حصص منصات التوصيل' : 'Aggregator Mix Share')
  const sectionEnd = html.indexOf(
    isAr ? 'مصفوفة الفروع × منصات التوصيل الفعلية' : 'Branch × Platform Actual POS Matrix',
  )
  if (sectionStart < 0 || sectionEnd < 0) throw new Error('Donut section not found')
  const chunk = html.slice(sectionStart, sectionEnd)

  const centerMatch = chunk.match(
    /Center safe-zone|inset-0 flex items-center justify-center[\s\S]*?<span dir="ltr"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/,
  )
  // Fallback direct match on the center flex container
  const centerBlockMatch = chunk.match(
    /<div class="pointer-events-none absolute inset-0 flex items-center justify-center">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/,
  )
  const centerBlock = centerBlockMatch?.[1] ?? centerMatch?.[0] ?? ''
  const centerSpans = [...centerBlock.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((m) =>
    stripTags(m[1]),
  )
  const centerSalesKwd = parseKwdNumber(centerSpans[0] ?? '')
  const centerPayments = parseIntNumber(centerSpans[1] ?? '')

  const legendItems = [
    ...chunk.matchAll(
      /<p class="whitespace-normal text-\[13px\][^"]*">([\s\S]*?)<\/p><\/div><span dir="ltr"[^>]*>([\s\S]*?)<\/span><\/div><div[^>]*><p[^>]*>([\s\S]*?)<\/p>/g,
    ),
  ].map((m) => ({
    label: stripTags(m[1]),
    salesKwd: parseKwdNumber(stripTags(m[2])),
    payments: parseIntNumber(stripTags(m[3])),
  }))

  return { centerSalesKwd, centerPayments, slices: legendItems }
}

function textOfAttr(html: string, attr: string, value = 'true'): string | null {
  const start = html.indexOf(`${attr}="${value}"`)
  if (start < 0) return null
  const open = html.lastIndexOf('<', start)
  const tag = /^<([a-z0-9]+)/i.exec(html.slice(open))?.[1]
  if (!tag) return null
  let depth = 0
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  re.lastIndex = open
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1
    if (depth === 0) return stripTags(html.slice(open, m.index + m[0].length))
  }
  return null
}

function rawOfTagWithAttr(html: string, tag: string, attr: string, value = 'true'): string | null {
  const token = `${attr}="${value}"`
  const idx = html.indexOf(token)
  if (idx < 0) return null
  const open = html.lastIndexOf(`<${tag}`, idx)
  if (open < 0) return null
  let depth = 0
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  re.lastIndex = open
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1
    if (depth === 0) return html.slice(open, m.index + m[0].length)
  }
  return null
}

describe('Part 4 — Delivery Radar accuracy, commission breakdown, Payments labels, and MTD month preset', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXTURE_NOW_NOV_15, toFake: ['Date'] })
    mockGlobalFilterState.current = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  describe('1. Branch × Platform Matrix (active restaurants + exhibitions + school-canteens + unattributed) & Sum Equality', () => {
    function assertSumEquality(
      html: string,
      isAr: boolean,
      fixture: ReturnType<typeof buildMultiBranchFixtureData>,
    ) {
      const kpi1 = parseKpi1FromHtml(html, isAr)
      const donut = parseDonutFromHtml(html, isAr)
      const matrix = parseMatrixFromHtml(html)

      // Booths ('exhibitions'), School Canteens ('school-canteens'), and Unattributed MUST appear in matrix
      const expectedBoothLabel = isAr ? 'بوثات المعارض' : 'Exhibition Booths'
      const expectedCanteenLabel = isAr ? 'مقاصف المدارس' : 'School canteens'
      const expectedUnmappedLabel = isAr ? 'غير منسوب لفرع' : 'Unattributed to Branch'

      const boothRows = matrix.rows.filter((r) => r.branchLabel === expectedBoothLabel)
      const canteenRows = matrix.rows.filter((r) => r.branchLabel === expectedCanteenLabel)
      const unmappedRows = matrix.rows.filter((r) => r.branchLabel === expectedUnmappedLabel)

      expect(boothRows.length).toBeGreaterThan(0)
      expect(canteenRows.length).toBeGreaterThan(0)
      expect(unmappedRows.length).toBeGreaterThan(0)

      // Booth & canteen sums match fixture inputs
      const expectedBoothSales = r3(
        AGGREGATOR_KEYS.reduce(
          (s, ck) => s + fixture.locUiRawMap.get('exhibitions')![ck].netKwd,
          0,
        ),
      )
      const expectedCanteenSales = r3(
        AGGREGATOR_KEYS.reduce(
          (s, ck) => s + fixture.locUiRawMap.get('school-canteens')![ck].netKwd,
          0,
        ),
      )
      expect(r3(boothRows.reduce((s, r) => s + r.salesKwd, 0))).toBe(expectedBoothSales)
      expect(r3(canteenRows.reduce((s, r) => s + r.salesKwd, 0))).toBe(expectedCanteenSales)

      // Overall matrix sum === tfoot total === KPI 1 === Donut center === sum of donut slices (0.000 KWD delta)
      const matrixOverallSales = r3(matrix.rows.reduce((s, r) => s + r.salesKwd, 0))
      const matrixOverallPayments = matrix.rows.reduce((s, r) => s + r.payments, 0)
      const donutSliceSum = r3(donut.slices.reduce((s, sl) => s + sl.salesKwd, 0))
      const donutPaymentsSum = donut.slices.reduce((s, sl) => s + sl.payments, 0)

      expect(matrixOverallSales).toBe(fixture.expectedTotalAggSales)
      expect(matrix.totalSalesKwd).toBe(kpi1.salesKwd)
      expect(matrixOverallSales).toBe(kpi1.salesKwd)
      expect(donut.centerSalesKwd).toBe(kpi1.salesKwd)
      expect(donutSliceSum).toBe(kpi1.salesKwd)
      expect(r3(Math.abs(matrixOverallSales - kpi1.salesKwd))).toBe(0)
      expect(r3(Math.abs(donutSliceSum - kpi1.salesKwd))).toBe(0)

      expect(matrixOverallPayments).toBe(fixture.expectedTotalAggPayments)
      expect(matrix.totalPayments).toBe(kpi1.payments)
      expect(donut.centerPayments).toBe(kpi1.payments)
      expect(donutPaymentsSum).toBe(kpi1.payments)

      // Per-platform matrix sum === platform expected total === donut slice (0.000 KWD delta)
      for (const ck of AGGREGATOR_KEYS) {
        const label = getChannelLabel(ck, isAr)
        const platRows = matrix.rows.filter((r) => r.platformLabel === label)
        const platMatrixSales = r3(platRows.reduce((s, r) => s + r.salesKwd, 0))
        const platMatrixPayments = platRows.reduce((s, r) => s + r.payments, 0)
        expect(platMatrixSales).toBe(fixture.expectedByPlatform[ck].salesKwd)
        expect(platMatrixPayments).toBe(fixture.expectedByPlatform[ck].payments)

        const slice = donut.slices.find((sl) => sl.label === label)
        if (fixture.expectedByPlatform[ck].salesKwd > 0) {
          expect(slice?.salesKwd).toBe(platMatrixSales)
          expect(slice?.payments).toBe(platMatrixPayments)
        }
      }
    }

    it('matches KPI 1 == Donut == Matrix (per-platform & overall to 0.000 KWD) when rendered with liveCube', () => {
      const fixture = buildMultiBranchFixtureData()
      for (const locale of ['ar', 'en'] as const) {
        const html = renderRadar(locale, fixture.summary, { branch: 'all' }, fixture.cube)
        assertSumEquality(html, locale === 'ar', fixture)
      }
    })

    it('matches KPI 1 == Donut == Matrix when rendered with activeBucket only (both unmappedUiChannels AND residual derivation)', () => {
      const fixture = buildMultiBranchFixtureData()

      // 1) activeBucket built via buildReconciledBucket (carries explicit unmappedUiChannels)
      expect(fixture.monthBucket.unmappedUiChannels).toBeTruthy()
      for (const locale of ['ar', 'en'] as const) {
        const html = renderRadar(locale, fixture.summary, { branch: 'all' }, null)
        assertSumEquality(html, locale === 'ar', fixture)
      }

      // 2) legacy activeBucket without unmappedUiChannels -> residual derivation = uiChannels - Σ(known branches)
      const legacyBucket: OdooBucketSummary = { ...fixture.monthBucket }
      delete legacyBucket.unmappedUiChannels
      const legacySummary: OdooLiveSummary = {
        ...fixture.summary,
        buckets: { ...fixture.summary.buckets, month: legacyBucket },
      }
      for (const locale of ['ar', 'en'] as const) {
        const html = renderRadar(locale, legacySummary, { branch: 'all' }, null)
        assertSumEquality(html, locale === 'ar', fixture)
      }
    })

    it('supports filtering directly to exhibitions («بوثات المعارض») or school-canteens («مقاصف المدارس»)', () => {
      const fixture = buildMultiBranchFixtureData()

      for (const targetBranch of ['exhibitions', 'school-canteens'] as const) {
        const expectedSales = r3(
          AGGREGATOR_KEYS.reduce(
            (s, ck) => s + fixture.locUiRawMap.get(targetBranch)![ck].netKwd,
            0,
          ),
        )
        const expectedPayments = AGGREGATOR_KEYS.reduce(
          (s, ck) => s + fixture.locUiRawMap.get(targetBranch)![ck].orders,
          0,
        )
        for (const useCube of [fixture.cube, null] as const) {
          for (const locale of ['ar', 'en'] as const) {
            const isAr = locale === 'ar'
            const html = renderRadar(
              locale,
              fixture.summary,
              { branch: targetBranch },
              useCube,
            )
            const kpi1 = parseKpi1FromHtml(html, isAr)
            const matrix = parseMatrixFromHtml(html)
            expect(kpi1.salesKwd).toBe(expectedSales)
            expect(kpi1.payments).toBe(expectedPayments)
            expect(matrix.totalSalesKwd).toBe(expectedSales)
            expect(matrix.totalPayments).toBe(expectedPayments)

            const expectedLabel =
              targetBranch === 'exhibitions'
                ? isAr
                  ? 'بوثات المعارض'
                  : 'Exhibition Booths'
                : isAr
                  ? 'مقاصف المدارس'
                  : 'School canteens'
            expect(matrix.rows.every((r) => r.branchLabel === expectedLabel)).toBe(true)
            expect(html).not.toContain('All Branches')
          }
        }
      }
    })
  })

  describe('2. Commission KPI 3 (Part 2 platform_commission, separated lines, dual %, expandable GL accounts, today/week)', () => {
    function buildGlFixtureSummary(aggSalesKwd: number) {
      const fixture = buildMultiBranchFixtureData()

      const incomeFood = mustDumpAccount('50001')
      const incomeBev = mustDumpAccount('50002')
      const cogsAcc = mustDumpAccount('40001')
      const commTalabat = mustDumpAccount('40229')
      const commDeliveroo = mustDumpAccount('40230')
      const commBibayt = mustDumpAccount('40705')
      const subTalabat = mustDumpAccount('40224')
      const delivCary = mustDumpAccount('40231')
      const bankFeeAcc = mustDumpAccount('40756')

      const accountById = new Map<number, GlAccountMeta>(
        [
          incomeFood,
          incomeBev,
          cogsAcc,
          commTalabat,
          commDeliveroo,
          commBibayt,
          subTalabat,
          delivCary,
          bankFeeAcc,
        ].map((a) => [a.id, a]),
      )

      const rows: GlMoveLineGroupRow[] = [
        { account_id: [incomeFood.id, `${incomeFood.code} ${incomeFood.name}`], debit: 0, credit: 2850.5, balance: -2850.5, __count: 25 },
        { account_id: [incomeBev.id, `${incomeBev.code} ${incomeBev.name}`], debit: 0, credit: 649.5, balance: -649.5, __count: 10 },
        { account_id: [cogsAcc.id, `${cogsAcc.code} ${cogsAcc.name}`], debit: 920.25, credit: 0, balance: 920.25, __count: 14 },
        { account_id: [commTalabat.id, `${commTalabat.code} ${commTalabat.name}`], debit: 31.125, credit: 0, balance: 31.125, __count: 4 },
        { account_id: [commDeliveroo.id, `${commDeliveroo.code} ${commDeliveroo.name}`], debit: 14.5, credit: 0, balance: 14.5, __count: 3 },
        { account_id: [commBibayt.id, `${commBibayt.code} ${commBibayt.name}`], debit: 6.375, credit: 0, balance: 6.375, __count: 2 },
        { account_id: [subTalabat.id, `${subTalabat.code} ${subTalabat.name}`], debit: 18.75, credit: 0, balance: 18.75, __count: 1 },
        { account_id: [delivCary.id, `${delivCary.code} ${delivCary.name}`], debit: 11.25, credit: 0, balance: 11.25, __count: 2 },
        { account_id: [bankFeeAcc.id, `${bankFeeAcc.code} ${bankFeeAcc.name}`], debit: 4.9, credit: 0, balance: 4.9, __count: 1 },
      ]

      const expectedCommissionKwd = r3(31.125 + 14.5 + 6.375)
      const expectedSubKwd = 18.75
      const expectedThirdPartyKwd = 11.25
      const expectedGlRevKwd = r3(2850.5 + 649.5)
      const expectedAggPct = (expectedCommissionKwd / aggSalesKwd) * 100
      const expectedGlPct = Math.round((expectedCommissionKwd / expectedGlRevKwd) * 1000) / 10

      const builtGl = buildLedgerAccountingFromGroups({
        fromIso: '2026-11-01',
        toInclusiveIso: '2026-11-15',
        accountById,
        rows,
      })

      expect(builtGl.deliveryCommissions).toBe(expectedCommissionKwd)
      expect(builtGl.platformSubscriptionKwd).toBe(expectedSubKwd)
      expect(builtGl.thirdPartyDeliveryKwd).toBe(expectedThirdPartyKwd)

      const monthBkt = { ...fixture.summary.buckets!.month!, accounting: builtGl }
      const todayGl = buildLedgerAccountingFromGroups({
        fromIso: '2026-11-15',
        toInclusiveIso: '2026-11-15',
        accountById,
        rows,
      })
      const weekGl = buildLedgerAccountingFromGroups({
        fromIso: '2026-11-09',
        toInclusiveIso: '2026-11-15',
        accountById,
        rows,
      })

      const summary: OdooLiveSummary = {
        ...fixture.summary,
        buckets: {
          month: monthBkt,
          today: { ...fixture.summary.buckets!.today!, accounting: todayGl },
          week: { ...fixture.summary.buckets!.week!, accounting: weekGl },
        },
      }

      return {
        summary,
        cube: fixture.cube,
        commAccounts: [
          { acc: commTalabat, amountKwd: 31.125 },
          { acc: commDeliveroo, amountKwd: 14.5 },
          { acc: commBibayt, amountKwd: 6.375 },
        ],
        subAcc: { acc: subTalabat, amountKwd: expectedSubKwd },
        thirdPartyAcc: { acc: delivCary, amountKwd: expectedThirdPartyKwd },
        bankFeeAcc,
        expectedCommissionKwd,
        expectedSubKwd,
        expectedThirdPartyKwd,
        expectedAggPct,
        expectedGlPct,
      }
    }

    it('displays Part 2 platform_commission, separate subscription & 3rd-party delivery lines, dual %, and expandable <details> accounts', () => {
      const base = buildMultiBranchFixtureData()
      const glFix = buildGlFixtureSummary(base.expectedTotalAggSales)

      for (const locale of ['ar', 'en'] as const) {
        const isAr = locale === 'ar'
        const html = renderRadar(locale, glFix.summary, { period: 'month' }, glFix.cube)

        expect(textOfAttr(html, 'data-commission-value')).toBe(
          formatKwd(glFix.expectedCommissionKwd, { locale, decimals: 3 }),
        )

        const aggPctText = textOfAttr(html, 'data-commission-agg-pct')
        expect(aggPctText).toContain(formatPct(glFix.expectedAggPct, { locale, decimals: 1 }))
        expect(aggPctText).toContain(isAr ? 'من مبيعات تطبيقات التوصيل' : 'of aggregator sales')

        const glPctText = textOfAttr(html, 'data-commission-gl-pct')
        expect(glPctText).toContain(formatPct(glFix.expectedGlPct, { locale, decimals: 1 }))
        expect(glPctText).toContain(isAr ? 'من إجمالي إيراد الدفتر المرحّل' : 'of posted GL revenue')

        const subLine = textOfAttr(html, 'data-commission-subscription-line')
        expect(subLine).toContain(isAr ? 'اشتراكات المنصات' : 'Platform Subscriptions')
        expect(subLine).toContain(formatKwd(glFix.expectedSubKwd, { locale, decimals: 3 }))

        const thirdPartyLine = textOfAttr(html, 'data-commission-third-party-line')
        expect(thirdPartyLine).toContain(isAr ? 'توصيل الطرف الثالث' : '3rd-Party Delivery')
        expect(thirdPartyLine).toContain(formatKwd(glFix.expectedThirdPartyKwd, { locale, decimals: 3 }))

        const detailsHtml = rawOfTagWithAttr(html, 'details', 'data-commission-accounts-details')
        expect(detailsHtml).not.toBeNull()
        const detailsText = stripTags(detailsHtml!)
        for (const item of [...glFix.commAccounts, glFix.subAcc, glFix.thirdPartyAcc]) {
          expect(detailsText).toContain(item.acc.code)
          expect(detailsText).toContain(stripTags(item.acc.name))
          expect(detailsText).toContain(formatKwd(item.amountKwd, { locale, decimals: 3 }))
        }
        expect(detailsText).not.toContain(glFix.bankFeeAcc.code)
        expect(html).not.toContain('يحتاج تأكيد المحاسب')
      }
    })

    it('shows posted commission GL on today and week periods when present (no period-key forced unposted override)', () => {
      const base = buildMultiBranchFixtureData()
      const glFix = buildGlFixtureSummary(base.expectedTotalAggSales)

      for (const period of ['today', 'week'] as const) {
        for (const locale of ['ar', 'en'] as const) {
          const html = renderRadar(locale, glFix.summary, { period }, glFix.cube)
          expect(html).not.toContain('data-commission-unposted="true"')
          expect(textOfAttr(html, 'data-commission-value')).toBe(
            formatKwd(glFix.expectedCommissionKwd, { locale, decimals: 3 }),
          )
          const detailsHtml = rawOfTagWithAttr(html, 'details', 'data-commission-accounts-details')
          expect(detailsHtml).not.toBeNull()
          expect(detailsHtml).toContain(glFix.commAccounts[0].acc.code)
        }
      }
    })

    it('still shows posted subscriptions & 3rd-party delivery lines and accounts when platform_commission is unposted', () => {
      const base = buildMultiBranchFixtureData()
      const incomeFood = mustDumpAccount('50001')
      const subTalabat = mustDumpAccount('40224')
      const delivCary = mustDumpAccount('40231')
      const accountById = new Map<number, GlAccountMeta>(
        [incomeFood, subTalabat, delivCary].map((a) => [a.id, a]),
      )
      const builtGl = buildLedgerAccountingFromGroups({
        fromIso: '2026-11-01',
        toInclusiveIso: '2026-11-15',
        accountById,
        rows: [
          { account_id: [incomeFood.id, `${incomeFood.code} ${incomeFood.name}`], debit: 0, credit: 2200, balance: -2200, __count: 10 },
          { account_id: [subTalabat.id, `${subTalabat.code} ${subTalabat.name}`], debit: 22.5, credit: 0, balance: 22.5, __count: 1 },
          { account_id: [delivCary.id, `${delivCary.code} ${delivCary.name}`], debit: 9.75, credit: 0, balance: 9.75, __count: 1 },
        ],
      })
      const summary: OdooLiveSummary = {
        ...base.summary,
        buckets: {
          ...base.summary.buckets,
          month: { ...base.summary.buckets!.month!, accounting: builtGl },
        },
      }

      for (const locale of ['ar', 'en'] as const) {
        const isAr = locale === 'ar'
        const html = renderRadar(locale, summary, { period: 'month' }, base.cube)
        expect(html).toContain('data-commission-unposted="true"')
        expect(html).toContain(isAr ? 'غير مُرحَّل بعد' : 'Not posted yet')
        expect(html).toContain(isAr ? 'اشتراكات المنصات' : 'Platform Subscriptions')
        expect(html).toContain(formatKwd(22.5, { locale, decimals: 3 }))
        expect(html).toContain(isAr ? 'توصيل الطرف الثالث' : '3rd-Party Delivery')
        expect(html).toContain(formatKwd(9.75, { locale, decimals: 3 }))

        const detailsHtml = rawOfTagWithAttr(html, 'details', 'data-commission-accounts-details')
        expect(detailsHtml).not.toBeNull()
        expect(detailsHtml).toContain(subTalabat.code)
        expect(detailsHtml).toContain(delivCary.code)
      }
    })
  })

  describe('3. "عدد الدفعات" / "Payments" labels across DeliveryRadarV5 in AR and EN', () => {
    it('renders "عدد الدفعات" (AR) and "Payments" (EN) across KPIs, cards, donut, and matrix headers', () => {
      const fixture = buildMultiBranchFixtureData()
      const htmlAr = renderRadar('ar', fixture.summary, { period: 'month' }, fixture.cube)
      const htmlEn = renderRadar('en', fixture.summary, { period: 'month' }, fixture.cube)

      expect(htmlAr).toContain('مبيعات وعدد دفعات تطبيقات التوصيل الفعلية')
      expect(htmlAr).toContain(`عدد الدفعات: ${formatInt(fixture.expectedTotalAggPayments, 'ar')} دفعة • متوسط الدفعة`)
      expect(htmlAr).toContain('دفعة مباشرة بدون عمولة تطبيقات')
      expect(htmlAr).toContain('مبيعات وعدد دفعات كل منصة توصيل')
      expect(htmlAr).toContain('>عدد الدفعات<')
      expect(htmlAr).toContain('>متوسط الدفعة<')
      expect(htmlAr).not.toContain('مبيعات وطلبات كل منصة توصيل')

      expect(htmlEn).toContain('Actual aggregator sales &amp; payments from Odoo 17 POS payment methods')
      expect(htmlEn).toContain(`${formatInt(fixture.expectedTotalAggPayments, 'en')} payments • Avg per payment`)
      expect(htmlEn).toContain('direct payments without aggregator commission')
      expect(htmlEn).toContain('Sales by Delivery Platform')
      expect(htmlEn).toContain('>Payments<')
      expect(htmlEn).toContain('>Avg per payment<')
      expect(htmlEn).not.toContain('Payouts / Batches')
      expect(htmlEn).not.toContain('payouts / batches')
      expect(htmlEn).not.toContain('Avg per Payout')
    })
  })

  describe('4. Calendar MTD ("1st → today") across connector RPCs, formatPeriodCalendarWindow, Home, Cores, and OdooSyncPill', () => {
    it('queries monthBucket & gl.month over [2026-11-01, 2026-11-15] (days=15) while keeping journeyPulse.rolling30 at 30d', async () => {
      const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}
      for (const key of ODOO_ENV_KEYS) savedEnv[key] = process.env[key]
      process.env.ODOO_URL = 'https://localhost:8069'
      process.env.ODOO_DB = 'vf_mtd_test'
      process.env.ODOO_USERNAME = 'bi@example.com'
      process.env.ODOO_API_KEY = 'test_key'
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })

      const incomeFood = mustDumpAccount('50001')
      const cogsAcc = mustDumpAccount('40001')
      const commTalabat = mustDumpAccount('40229')
      const subTalabat = mustDumpAccount('40224')
      const delivCary = mustDumpAccount('40231')
      const glAccountList = [incomeFood, cogsAcc, commTalabat, subTalabat, delivCary]

      const glDateQueries: Array<{ from: string; to: string }> = []

      // Pre-build 65-day daily pos.order rows from 2026-09-12 through 2026-11-15 (10 KWD / 1 order per day)
      const dayOrderRows: Array<{
        session_id: [number, string]
        pricelist_id: [number, string]
        amount_total: number
        amount_tax: number
        __count: number
        __range: { 'date_order:day': { from: string; to: string } }
      }> = []
      const dayCountRows: Array<{
        session_id: [number, string]
        pricelist_id: [number, string]
        __count: number
        __range: { 'date_order:day': { from: string; to: string } }
      }> = []
      const startMs = Date.parse('2026-09-12T00:00:00Z')
      for (let i = 0; i < 65; i += 1) {
        const dIso = new Date(startMs + i * 86_400_000).toISOString().slice(0, 10)
        const nextIso = new Date(startMs + (i + 1) * 86_400_000).toISOString().slice(0, 10)
        const range = {
          'date_order:day': {
            from: `${dIso} 00:00:00`,
            to: `${nextIso} 00:00:00`,
          },
        }
        dayOrderRows.push({
          session_id: [501, 'POS/501'],
          pricelist_id: [3, 'Talabat Go'],
          amount_total: 10,
          amount_tax: 0,
          __count: 1,
          __range: range,
        })
        dayCountRows.push({
          session_id: [501, 'POS/501'],
          pricelist_id: [3, 'Talabat Go'],
          __count: 1,
          __range: range,
        })
      }

      try {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            id?: number
            params?: { service?: string; method?: string; args?: unknown[] }
          }
          const reqId = body.id ?? 1
          const rpcOk = (result: unknown) =>
            new Response(JSON.stringify({ jsonrpc: '2.0', id: reqId, result }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })

          if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
            return rpcOk(7)
          }

          const args = body.params?.args ?? []
          const model = String(args[3] ?? '')
          const method = String(args[4] ?? '')
          const methodArgs = (args[5] as unknown[]) ?? []
          const domain = (methodArgs[0] as unknown[][]) ?? []
          const domainStr = JSON.stringify(domain)
          const groupby = (methodArgs[2] as string[]) ?? []

          if (model === 'pos.config' && method === 'search_read') {
            return rpcOk([
              { id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] },
              { id: 26, name: 'EXB Booth 1', active: true, company_id: [1, 'Venture Foods'] },
              { id: 41, name: 'School Canteen 1', active: true, company_id: [1, 'Venture Foods'] },
            ])
          }
          if (model === 'pos.category' && method === 'search_read') {
            return rpcOk([{ id: 10, name: 'CG', parent_id: false }])
          }
          if (model === 'account.account' && method === 'search_read') {
            return rpcOk(glAccountList)
          }
          if (model === 'res.users' && method === 'read') {
            return rpcOk([{ id: 7, company_id: [1, 'Venture Foods'] }])
          }
          if (model === 'res.company' && method === 'search_read') {
            return rpcOk([{ period_lock_date: '2026-10-31', fiscalyear_lock_date: false }])
          }
          if (model === 'pos.session' && method === 'read') {
            return rpcOk([
              { id: 501, config_id: [8, 'Promenade 1'] },
              { id: 502, config_id: [26, 'EXB Booth 1'] },
              { id: 503, config_id: [41, 'School Canteen 1'] },
            ])
          }
          if (model === 'product.product' && method === 'read') {
            return rpcOk([{ id: 99, name: 'Sweet & Sour', pos_categ_id: [10, 'CG'] }])
          }
          if (model === 'pos.order' && method === 'search_read') {
            return rpcOk([
              {
                id: 1,
                date_order: '2026-11-15 10:15:00',
                amount_total: 10,
                config_id: [8, 'Promenade 1'],
                company_id: [1, 'Venture Foods'],
              },
            ])
          }
          if (model === 'pos.order' && method === 'read_group') {
            const isCount = domainStr.includes('["amount_total",">=",0]')
            if (groupby.includes('date_order:day')) {
              return rpcOk(isCount ? dayCountRows : dayOrderRows)
            }
            if (groupby.includes('date_order:hour')) {
              return rpcOk(
                isCount
                  ? [{ __count: 1, __range: { 'date_order:hour': { from: '2026-11-15 10:00:00', to: '2026-11-15 11:00:00' } } }]
                  : [{ amount_total: 10, amount_tax: 0, __count: 1, __range: { 'date_order:hour': { from: '2026-11-15 10:00:00', to: '2026-11-15 11:00:00' } } }],
              )
            }
            if (groupby.length === 1 && groupby[0] === 'session_id') {
              return rpcOk(
                isCount
                  ? [{ session_id: [501, 'POS/501'], __count: 65 }]
                  : [{ session_id: [501, 'POS/501'], amount_total: 650, amount_tax: 0, __count: 65 }],
              )
            }
            if (groupby.length === 0) {
              // prior30 query
              return rpcOk([{ amount_total: 300, amount_tax: 0, __count: 30 }])
            }
            return rpcOk([])
          }
          if (model === 'pos.order' && method === 'search_count') {
            return rpcOk(30)
          }
          if (model === 'pos.order.line' && method === 'read_group') {
            return rpcOk([{ product_id: [99, 'Sweet & Sour'], price_subtotal: 150, qty: 15 }])
          }
          if (model === 'pos.payment' && method === 'read_group') {
            const isCount = domainStr.includes('["pos_order_id.amount_total",">=",0]')
            return rpcOk(
              isCount
                ? [{ session_id: [501, 'POS/501'], payment_method_id: [7, 'Keeta'], __count: 15 }]
                : [{ session_id: [501, 'POS/501'], payment_method_id: [7, 'Keeta'], amount: 150, __count: 15 }],
            )
          }
          if (model === 'account.move.line' && method === 'read_group') {
            if (domainStr.includes('asset_receivable') || domainStr.includes('liability_payable')) {
              return rpcOk([])
            }
            const gte = domain.find((c) => Array.isArray(c) && c[0] === 'date' && c[1] === '>=')
            const lte = domain.find((c) => Array.isArray(c) && c[0] === 'date' && c[1] === '<=')
            if (gte && lte) {
              glDateQueries.push({ from: String(gte[2]), to: String(lte[2]) })
            }
            return rpcOk([
              { account_id: [incomeFood.id, incomeFood.name], debit: 0, credit: 500, balance: -500, __count: 10 },
              { account_id: [cogsAcc.id, cogsAcc.name], debit: 150, credit: 0, balance: 150, __count: 5 },
              { account_id: [commTalabat.id, commTalabat.name], debit: 30, credit: 0, balance: 30, __count: 2 },
              { account_id: [subTalabat.id, subTalabat.name], debit: 10, credit: 0, balance: 10, __count: 1 },
              { account_id: [delivCary.id, delivCary.name], debit: 8, credit: 0, balance: 8, __count: 1 },
            ])
          }
          return rpcOk([])
        })

        const snap = await fetchLiveOdooSnapshot({
          period: 'month',
          forceRefresh: true,
          referenceNowMs: FIXTURE_NOW_NOV_15.getTime(),
        })
        const summary = snap.summary!
        expect(summary.connected).toBe(true)

        const monthBucket = summary.buckets!.month!
        expect(monthBucket.from).toBe('2026-11-01')
        expect(monthBucket.to).toBe('2026-11-16')
        expect(monthBucket.days).toBe(15)
        expect(monthBucket.totals.netSalesKwd).toBe(150) // 15 days * 10 KWD/day = 150 KWD (MTD, NOT 300)
        expect(monthBucket.totals.orders).toBe(15)

        // gl.month was queried strictly over [2026-11-01, 2026-11-15]
        expect(glDateQueries).toContainEqual({ from: '2026-11-01', to: '2026-11-15' })
        expect(monthBucket.accounting?.from).toBe('2026-11-01')
        expect(monthBucket.accounting?.to).toBe('2026-11-15')

        // journeyPulse.rolling30 stays 30d rolling (2026-10-17..2026-11-15 = 30 days * 10 KWD = 300 KWD)
        expect(summary.journeyPulse?.rolling30.days).toBe(30)
        expect(summary.journeyPulse?.rolling30.from).toBe('2026-10-17')
        expect(summary.journeyPulse?.rolling30.to).toBe('2026-11-15')
        expect(summary.journeyPulse?.rolling30.netKwd).toBe(300)
        expect(summary.journeyPulse?.prior30.days).toBe(30)
        expect(summary.journeyPulse?.prior30.from).toBe('2026-09-17')
        expect(summary.journeyPulse?.prior30.to).toBe('2026-10-16')

        // periodWindowForBucket('month', FIXTURE_NOW_NOV_15) matches Calendar MTD
        expect(periodWindowForBucket('month', FIXTURE_NOW_NOV_15)).toEqual({
          from: '2026-11-01',
          to: '2026-11-16',
        })
      } finally {
        for (const key of ODOO_ENV_KEYS) {
          if (savedEnv[key] === undefined) delete process.env[key]
          else process.env[key] = savedEnv[key]
        }
      }
    })

    it('keeps Home (FullJourney360), Cores (CoresHubStudio), formatPeriodCalendarWindow, and OdooSyncPill aligned to Calendar MTD', () => {
      const fixture = buildMultiBranchFixtureData()
      const mtdWindow = formatPeriodCalendarWindow('month', { liveSummary: fixture.summary })
      expect(mtdWindow.fromIso).toBe('2026-11-01')
      expect(mtdWindow.toInclusiveIso).toBe('2026-11-15')

      // Fallback without liveSummary on 2026-11-15 (Kuwait yesterday = 2026-11-14) also uses 1st of month
      const fallbackWin = formatPeriodCalendarWindow('month', { liveSummary: null })
      expect(fallbackWin.fromIso).toBe('2026-11-01')
      expect(fallbackWin.toInclusiveIso).toBe('2026-11-14')

      const monthFilters: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, period: 'month' }
      const workspace = computeGlobalWorkspace(monthFilters, fixture.summary)
      expect(workspace.periodDays).toBe(15)

      mockGlobalFilterState.current = {
        filters: monthFilters,
        workspace,
        liveSummary: fixture.summary,
        sessionRole: 'admin',
      } as unknown as GlobalFilterContextValue

      const expectedNetSalesNum = formatKwd(fixture.summary.totals.netSalesKwd, {
        locale: 'en',
        showUnit: false,
        decimals: 3,
      })

      // Home (FullJourney360)
      const homeAr = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'ar' }, React.createElement(FullJourney360)),
      )
      const homeEn = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(FullJourney360)),
      )
      expect(homeAr).toContain('2026-11-01 → 2026-11-15')
      expect(homeAr).toContain(expectedNetSalesNum)
      expect(homeEn).toContain('2026-11-01 → 2026-11-15')
      expect(homeEn).toContain(expectedNetSalesNum)
      expect(homeAr).not.toContain('2026-10-17')
      expect(homeEn).not.toContain('2026-10-17')

      // Cores (CoresHubStudio)
      const coresAr = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'ar' },
          React.createElement(TypedCoresHubStudio, { initialTab: 'sales' }),
        ),
      )
      const coresEn = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'en' },
          React.createElement(TypedCoresHubStudio, { initialTab: 'sales' }),
        ),
      )
      expect(coresAr).toContain('2026-11-01 → 2026-11-15')
      expect(coresAr).toContain(expectedNetSalesNum)
      expect(coresEn).toContain('2026-11-01 → 2026-11-15')
      expect(coresEn).toContain(expectedNetSalesNum)
      expect(coresAr).not.toContain('2026-10-17')
      expect(coresEn).not.toContain('2026-10-17')

      // OdooSyncPill ('الشهر الجاري' / 'Month to Date', never 'آخر 30 يوماً' / 'Last 30d')
      const pillAr = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'ar' }, React.createElement(OdooSyncPill, { isAr: true })),
      )
      const pillEn = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(OdooSyncPill, { isAr: false })),
      )
      expect(pillAr).toContain('Odoo 17 · الشهر الجاري')
      expect(pillAr).toContain('2026-11-01 ← 2026-11-14')
      expect(pillAr).not.toContain('آخر 30 يوماً')
      expect(pillEn).toContain('Odoo 17 · Month to Date')
      expect(pillEn).toContain('2026-11-01 → 2026-11-14')
      expect(pillEn).not.toContain('Last 30d')
    })
  })
})
