import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { computeBeforeAfterSnapshot } from '@/lib/aether/before-after-engine'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalPeriod,
} from '@/lib/aether/global-filter-engine'
import { isExcludedOdooEntity } from '@/lib/aether/period-delta'
import { computeStrategicPlanning } from '@/lib/aether/planning-engine'
import { computeErpComparison } from '@/lib/erp-comparison-engine'
import {
  askFeryalOdooAgent,
  FERYAL_COMPETITOR_REFUSAL,
  FERYAL_NO_ODOO_DATA_REPLY,
  resetFeryalAuditCache,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'
import {
  bustOdooLiveCache,
  fetchLiveOdooSnapshot,
  type OdooLivePurchaseSummary,
  type OdooLiveWarehouseChainPayload,
  type OdooPeriodCube,
} from '@/lib/odoo-live-connector'
import { sanitizePosTerminalDisplayName } from '@/lib/odoo-terminal-mappings'
import type { OdooBucketSummary, OdooLiveSummary, OdooPeriodBucketKey } from '@/lib/odoo/live-sync-core'
import { buildLiveEnterpriseDepartments } from '@/lib/reports/enterprise-reports-registry'
import { computeWarehouseDailyChain } from '@/lib/warehouse-prep-engine'

const KUWAIT_NOV_15_2026_MS = Date.parse('2026-11-15T09:00:00.000Z') // 12:00 Asia/Kuwait on 2026-11-15

const ODOO_ENV_KEYS = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_LOGIN',
  'ODOO_API_KEY',
  'ODOO_PASSWORD',
] as const

type ProductionSourceFile = {
  fullPath: string
  relPath: string
  rawText: string
  codeWithoutComments: string
  codeIdentifiersOnly: string
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

function stripStringLiterals(code: string): string {
  return code
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
}

async function collectProductionFiles(): Promise<ProductionSourceFile[]> {
  const rootDir = process.cwd()
  const scanRoots = [
    path.join(rootDir, 'src', 'app'),
    path.join(rootDir, 'src', 'components'),
    path.join(rootDir, 'src', 'lib'),
    path.join(rootDir, 'src', 'modules'),
    path.join(rootDir, 'src', 'services'),
  ]

  const out: ProductionSourceFile[] = []

  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === '.next') {
          continue
        }
        await walk(fullPath)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const rawText = await readFile(fullPath, 'utf8')
        const relPath = path.relative(rootDir, fullPath).split(path.sep).join('/')
        const codeWithoutComments = stripComments(rawText)
        out.push({
          fullPath,
          relPath,
          rawText,
          codeWithoutComments,
          codeIdentifiersOnly: stripStringLiterals(codeWithoutComments),
        })
      }
    }
  }

  for (const dir of scanRoots) {
    await walk(dir)
  }

  return out.sort((a, b) => a.relPath.localeCompare(b.relPath))
}

function buildPeriodBucketFixture(params: {
  key: OdooPeriodBucketKey
  from: string
  to: string
  days: number
  netSalesKwd: number
  orders: number
  unattributedSalesKwd: number
  unattributedOrders: number
  glComplete: boolean
  commissionUnposted: boolean
  deliveryCommissionsKwd: number
  cogsKwd: number
  expenseKwd: number
  depreciationKwd: number
  operatingProfitKwd: number
}): OdooBucketSummary {
  const mappedSales = Math.round((params.netSalesKwd - params.unattributedSalesKwd) * 1000) / 1000
  const mappedOrders = Math.max(0, params.orders - params.unattributedOrders)
  const aovKwd = params.orders > 0 ? Math.round((params.netSalesKwd / params.orders) * 1000) / 1000 : 0

  const branchWeights: Record<(typeof APPROVED_BRANCH_IDS)[number], number> = {
    '360-mall': 0.2023,
    salmiya: 0.1498,
    'al-kout': 0.1414,
    ardiya: 0.1354,
    promenade: 0.1333,
    avenues: 0.1276,
    assima: 0.1102,
  }

  const byLocation: Record<string, { netKwd: number; orders: number }> = {}
  for (const brId of APPROVED_BRANCH_IDS) {
    const share = branchWeights[brId]
    byLocation[brId] = {
      netKwd: Math.round(mappedSales * share * 1000) / 1000,
      orders: Math.max(1, Math.round(mappedOrders * share)),
    }
  }

  const brandWeights: Record<(typeof APPROVED_BRAND_IDS)[number], number> = {
    'china-garden': 0.25,
    franks: 0.18,
    tahina: 0.17,
    'farm-brown': 0.18,
    'noodle-bar': 0.14,
    'karak-cafeteria': 0.08,
  }

  const byBrand: Record<string, { netKwd: number; orders: number; qty: number }> = {}
  for (const brandId of APPROVED_BRAND_IDS) {
    const share = brandWeights[brandId]
    byBrand[brandId] = {
      netKwd: Math.round(params.netSalesKwd * share * 1000) / 1000,
      orders: Math.max(1, Math.round(params.orders * share)),
      qty: Math.max(1, Math.round(params.orders * share * 2)),
    }
  }

  const uiChannels: Record<string, { netKwd: number; orders: number }> = {
    'dine-in': { netKwd: Math.round(params.netSalesKwd * 0.28 * 1000) / 1000, orders: Math.round(params.orders * 0.26) },
    'takeaway-direct': { netKwd: Math.round(params.netSalesKwd * 0.16 * 1000) / 1000, orders: Math.round(params.orders * 0.17) },
    'talabat-tgo': { netKwd: Math.round(params.netSalesKwd * 0.22 * 1000) / 1000, orders: Math.round(params.orders * 0.22) },
    'talabat-tmp': { netKwd: Math.round(params.netSalesKwd * 0.10 * 1000) / 1000, orders: Math.round(params.orders * 0.10) },
    deliveroo: { netKwd: Math.round(params.netSalesKwd * 0.11 * 1000) / 1000, orders: Math.round(params.orders * 0.11) },
    jahez: { netKwd: Math.round(params.netSalesKwd * 0.07 * 1000) / 1000, orders: Math.round(params.orders * 0.08) },
    keeta: { netKwd: Math.round(params.netSalesKwd * 0.06 * 1000) / 1000, orders: Math.round(params.orders * 0.06) },
    snoonu: { netKwd: 0, orders: 0 },
  }

  return {
    key: params.key,
    from: params.from,
    to: params.to,
    days: params.days,
    totals: {
      netSalesKwd: params.netSalesKwd,
      orders: params.orders,
      aovKwd,
      restaurantNetKwd: mappedSales,
      restaurantOrders: mappedOrders,
    },
    byBrand,
    byLocation,
    mappedByLocation: byLocation,
    unattributedSalesKwd: params.unattributedSalesKwd,
    unattributedOrders: params.unattributedOrders,
    unattributedBranch: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netSalesKwd: params.unattributedSalesKwd,
      orders: params.unattributedOrders,
      sharePct: params.netSalesKwd > 0 ? (params.unattributedSalesKwd / params.netSalesKwd) * 100 : 0,
    },
    unmappedSummary: {
      netSalesKwd: params.unattributedSalesKwd,
      orders: params.unattributedOrders,
    },
    uiChannels,
    accounting: {
      available: params.glComplete,
      from: params.from,
      to: params.to,
      sourceModel: 'account.move.line',
      lineCount: params.glComplete ? 480 : 12,
      income: params.glComplete ? params.netSalesKwd : 0,
      otherIncome: 0,
      totalRevenue: params.glComplete ? params.netSalesKwd : 0,
      cogs: params.glComplete ? params.cogsKwd : 0,
      deliveryCommissions: params.commissionUnposted ? 0 : params.deliveryCommissionsKwd,
      deliveryCommissionLinesCount: params.commissionUnposted ? 0 : 24,
      expense: params.glComplete ? params.expenseKwd : 0,
      depreciation: params.glComplete ? params.depreciationKwd : 0,
      otherOpexAndDepreciation: params.glComplete ? params.expenseKwd + params.depreciationKwd : 0,
      operatingProfit: params.glComplete ? params.operatingProfitKwd : 0,
      completeAccrualPosted: params.glComplete,
      glIncomplete: !params.glComplete,
      glWarningAr: !params.glComplete ? 'قيود غير مكتملة لهذه الفترة' : undefined,
      aggregatorCommissionUnposted: params.commissionUnposted,
      aggregatorCommissionDisplayAr: params.commissionUnposted ? 'غير مُرحَّل بعد' : undefined,
      unavailableReasonAr: !params.glComplete ? 'قيود غير مكتملة لهذه الفترة' : undefined,
      unavailableReasonEn: !params.glComplete ? 'Incomplete GL entries for this period' : undefined,
    },
  }
}

function buildMultiPeriodLiveSummaryFixture(): OdooLiveSummary {
  const todayBucket = buildPeriodBucketFixture({
    key: 'today',
    from: '2026-11-14',
    to: '2026-11-15',
    days: 1,
    netSalesKwd: 4259.1,
    orders: 812,
    unattributedSalesKwd: 374.5,
    unattributedOrders: 74,
    glComplete: false,
    commissionUnposted: true,
    deliveryCommissionsKwd: 0,
    cogsKwd: 0,
    expenseKwd: 0,
    depreciationKwd: 0,
    operatingProfitKwd: 0,
  })

  const weekBucket = buildPeriodBucketFixture({
    key: 'week',
    from: '2026-11-08',
    to: '2026-11-15',
    days: 7,
    netSalesKwd: 29840.4,
    orders: 5620,
    unattributedSalesKwd: 2410.2,
    unattributedOrders: 465,
    glComplete: false,
    commissionUnposted: true,
    deliveryCommissionsKwd: 0,
    cogsKwd: 0,
    expenseKwd: 0,
    depreciationKwd: 0,
    operatingProfitKwd: 0,
  })

  const monthBucket = buildPeriodBucketFixture({
    key: 'month',
    from: '2026-10-16',
    to: '2026-11-15',
    days: 30,
    netSalesKwd: 124680.0,
    orders: 23450,
    unattributedSalesKwd: 9840.0,
    unattributedOrders: 1890,
    glComplete: true,
    commissionUnposted: false,
    deliveryCommissionsKwd: 11220.0,
    cogsKwd: 42390.0,
    expenseKwd: 45120.0,
    depreciationKwd: 6000.0,
    operatingProfitKwd: 19950.0,
  })

  const yearBucket = buildPeriodBucketFixture({
    key: 'year',
    from: '2026-01-01',
    to: '2026-11-15',
    days: 318,
    netSalesKwd: 1385400.0,
    orders: 261200,
    unattributedSalesKwd: 104200.0,
    unattributedOrders: 19800,
    glComplete: true,
    commissionUnposted: false,
    deliveryCommissionsKwd: 124686.0,
    cogsKwd: 471036.0,
    expenseKwd: 498744.0,
    depreciationKwd: 62334.0,
    operatingProfitKwd: 228600.0,
  })

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    envConfigured: true,
    syncedAt: '2026-11-15T08:55:00.000Z',
    lastSyncAt: '2026-11-15T08:55:00.000Z',
    latestRecordAt: '2026-11-14T20:58:00.000Z',
    latestOperationalDate: '2026-11-14',
    isStale24h: false,
    isStaleOver24h: false,
    odooCompanyId: 1,
    bucket: 'month',
    period: { from: '2026-10-16', to: '2026-11-14' },
    dateRange: { from: '2026-10-16', to: '2026-11-14' },
    database: null,
    totals: {
      netSalesKwd: monthBucket.totals.netSalesKwd,
      orders: monthBucket.totals.orders,
      aovKwd: monthBucket.totals.aovKwd,
    },
    unattributedSalesKwd: monthBucket.unattributedSalesKwd,
    unattributedOrders: monthBucket.unattributedOrders,
    unattributedBranch: monthBucket.unattributedBranch,
    brands: APPROVED_BRAND_IDS.map((id) => ({
      id,
      brand: id,
      netKwd: monthBucket.byBrand?.[id]?.netKwd ?? 0,
      sharePct: 16.6,
    })),
    branches: APPROVED_BRANCH_IDS.map((id) => ({
      id,
      name: id,
      unit: id,
      netSalesKwd: monthBucket.byLocation?.[id]?.netKwd ?? 0,
      orders: monthBucket.byLocation?.[id]?.orders ?? 0,
      sharePct: 14.2,
    })),
    channels: Object.entries(monthBucket.uiChannels ?? {}).map(([name, row]) => ({
      name,
      amountKwd: row.netKwd,
    })),
    buckets: {
      today: todayBucket,
      week: weekBucket,
      month: monthBucket,
      year: yearBucket,
    },
  }
}

function buildNov14AcceptanceCube(includeTopProducts = true): OdooPeriodCube {
  const emptyChannels = () => ({
    'dine-in': { netKwd: 0, orders: 0 },
    'takeaway-direct': { netKwd: 0, orders: 0 },
    'talabat-tgo': { netKwd: 0, orders: 0 },
    'talabat-tmp': { netKwd: 0, orders: 0 },
    keeta: { netKwd: 0, orders: 0 },
    deliveroo: { netKwd: 0, orders: 0 },
    jahez: { netKwd: 0, orders: 0 },
    snoonu: { netKwd: 0, orders: 0 },
  })

  const emptyBrands = () => ({
    'china-garden': { netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 },
    franks: { netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 },
    tahina: { netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 },
    'farm-brown': { netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 },
    'noodle-bar': { netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 },
    'karak-cafeteria': { netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 },
  })

  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-15T08:55:00.000Z',
    isStale24h: false,
    dateRange: { from: '2026-11-14', to: '2026-11-14' },
    days: 1,
    totals: {
      netSalesKwd: 4259.1,
      orders: 810,
      aovKwd: 5.258,
      mappedBranchesNetKwd: 3884.55,
      mappedBranchesOrders: 712,
      unattributedSalesKwd: 374.55,
      unattributedOrders: 98,
      excludedEntitiesKwd: 708.93,
      excludedEntitiesOrders: 99,
      totalDiscountKwd: 0.495,
      avgDiscountPct: 0.03,
      discountedLinesCount: 2,
    },
    byBranch: {
      '360-mall': { netKwd: 785.835, orders: 133, aovKwd: 5.909, channels: emptyChannels() },
      salmiya: { netKwd: 582.1, orders: 90, aovKwd: 6.468, channels: emptyChannels() },
      'al-kout': { netKwd: 549.275, orders: 106, aovKwd: 5.182, channels: emptyChannels() },
      ardiya: { netKwd: 526.055, orders: 84, aovKwd: 6.263, channels: emptyChannels() },
      promenade: { netKwd: 517.911, orders: 107, aovKwd: 4.84, channels: emptyChannels() },
      avenues: { netKwd: 495.512, orders: 106, aovKwd: 4.675, channels: emptyChannels() },
      assima: { netKwd: 427.862, orders: 86, aovKwd: 4.975, channels: emptyChannels() },
    },
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netKwd: 374.55,
      orders: 98,
      aovKwd: 3.822,
      channels: emptyChannels(),
    },
    byBrand: emptyBrands(),
    brandByBranch: {},
    byChannel: emptyChannels(),
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [],
    hourlyByBranch: {},
    topProducts: includeTopProducts
      ? [
          { productId: 101, name: 'دجاج سويت آند ساور', brandId: 'china-garden', netKwd: 412.5, qty: 95, linesCount: 90, avgDiscountPct: 0, discountKwd: 0 },
          { productId: 102, name: 'نودلز دجاج سيشوان', brandId: 'noodle-bar', netKwd: 348.0, qty: 87, linesCount: 82, avgDiscountPct: 0, discountKwd: 0 },
          { productId: 103, name: 'ساندويتش فرانكس كلاسيك', brandId: 'franks', netKwd: 289.4, qty: 110, linesCount: 102, avgDiscountPct: 0, discountKwd: 0 },
          { productId: 104, name: 'بوكس شاورما طحينة', brandId: 'tahina', netKwd: 244.8, qty: 68, linesCount: 65, avgDiscountPct: 0, discountKwd: 0 },
          { productId: 105, name: 'بروستد فارم براون عائلي', brandId: 'farm-brown', netKwd: 219.2, qty: 42, linesCount: 40, avgDiscountPct: 0, discountKwd: 0 },
        ]
      : [],
    accounting: {
      available: false,
      from: '2026-11-14',
      to: '2026-11-15',
      sourceModel: 'account.move.line',
      lineCount: 14,
      income: 0,
      otherIncome: 0,
      totalRevenue: 0,
      cogs: 0,
      deliveryCommissions: 0,
      deliveryCommissionLinesCount: 0,
      expense: 0,
      depreciation: 0,
      otherOpexAndDepreciation: 0,
      operatingProfit: 0,
      completeAccrualPosted: false,
      glIncomplete: true,
      glWarningAr: 'قيود غير مكتملة لهذه الفترة',
      aggregatorCommissionUnposted: true,
      aggregatorCommissionDisplayAr: 'غير مُرحَّل بعد',
    },
  }
}

describe('Zero Invented Data & Live Odoo 17 Truth — Comprehensive Acceptance Suite', () => {
  describe('1. Static Production Scan (src/app, src/components, src/lib, src/modules, src/services)', () => {
    it('contains zero Math.random, faker, mock/seed production data generators, OdooAuditCertificate, فارق 0.000, or Hawally UI strings while preserving server-side Odoo exclusion filters', async () => {
      const files = await collectProductionFiles()
      expect(files.length).toBeGreaterThan(150)

      const violations: string[] = []
      const hawallyUiRe = /\u062d\u0648\u0644\u064a|hawally|hawalli/i
      const auditBadgeRe = /OdooAuditCertificate|\u0641\u0627\u0631\u0642\s*0\.000/
      const fakerRe = /\bfaker\b|@faker-js/i
      const mathRandomRe = /\bMath\.random\s*\(/
      const mockOrSeedCodeRe =
        /\b(mock[A-Za-z0-9_]*|MOCK_[A-Z0-9_]+|seed[A-Za-z0-9_]*|SEED_[A-Z0-9_]+)\b/
      const forbiddenUiBuzzwordRe = /\bWatchdog\b|Verified Executive|Live Odoo|سجل التدقيق/i
      const forbiddenStaticRatiosRe = /(?<![\d.])(14\.7|64\.7|24\.71|10\.6)(?![\d.])/

      for (const file of files) {
        if (mathRandomRe.test(file.codeWithoutComments)) {
          violations.push(`${file.relPath}: contains Math.random()`)
        }
        if (fakerRe.test(file.codeWithoutComments)) {
          violations.push(`${file.relPath}: contains faker`)
        }
        if (auditBadgeRe.test(file.rawText)) {
          violations.push(`${file.relPath}: contains OdooAuditCertificate or فارق 0.000 badge`)
        }
        if (hawallyUiRe.test(file.rawText)) {
          violations.push(`${file.relPath}: contains Hawally / حولي string`)
        }
        if (forbiddenStaticRatiosRe.test(file.codeWithoutComments)) {
          violations.push(`${file.relPath}: contains static hardcoded ratio (14.7 / 64.7 / 24.71 / 10.6)`)
        }

        const isUiComponentOrPage =
          (file.relPath.startsWith('src/components/') ||
            (file.relPath.startsWith('src/app/') && !file.relPath.startsWith('src/app/api/'))) &&
          file.relPath.endsWith('.tsx')
        if (isUiComponentOrPage && forbiddenUiBuzzwordRe.test(file.codeWithoutComments)) {
          violations.push(`${file.relPath}: contains forbidden UI buzzword (Watchdog / Verified Executive / Live Odoo / سجل التدقيق)`)
        }

        const tokenMatch = mockOrSeedCodeRe.exec(file.codeIdentifiersOnly)
        if (tokenMatch) {
          violations.push(`${file.relPath}: contains mock/seed identifier "${tokenMatch[0]}"`)
        }
      }

      expect(violations).toEqual([])

      // Verify all legacy snapshot JSON files are permanently deleted and no large JSON snapshot exists in src/
      const rootDir = process.cwd()
      const bannedSnapshotPaths = [
        'src/lib/odoo-live-snapshot.json',
        'src/lib/odoo/delivery-receipts-proof.json',
        'src/lib/odoo/odoo-journey.json',
        'src/lib/odoo/odoo-intel.json',
      ]
      for (const rel of bannedSnapshotPaths) {
        expect(existsSync(path.join(rootDir, rel)), `${rel} must be deleted`).toBe(false)
      }

      const walkJson = async (dir: string): Promise<string[]> => {
        const found: string[] = []
        const entries = await readdir(dir, { withFileTypes: true })
        for (const e of entries) {
          const fp = path.join(dir, e.name)
          if (e.isDirectory()) {
            if (e.name !== 'node_modules' && e.name !== '.next' && e.name !== '__tests__') {
              found.push(...(await walkJson(fp)))
            }
          } else if (e.name.endsWith('.json')) {
            const st = await stat(fp)
            if (st.size > 10_240) {
              found.push(`${path.relative(rootDir, fp).replace(/\\/g, '/')} (${st.size} bytes)`)
            }
          }
        }
        return found
      }
      expect(await walkJson(path.join(rootDir, 'src'))).toEqual([])

      // Verify KpiProvenanceBadge uses yellow styling for «قديمة» and always displays sync timestamp
      const badgeSrc = await readFile(
        path.join(rootDir, 'src/components/erp/KpiProvenanceBadge.tsx'),
        'utf8',
      )
      expect(badgeSrc).toContain('bg-yellow-100')
      expect(badgeSrc).toContain('text-yellow-900')
      expect(badgeSrc).toContain('قديمة')
      expect(badgeSrc).not.toContain('!compact && (')

      // Verify server-side exclusion filters remain active for raw Odoo records («القرين», «هايزن بريج»)
      expect(isExcludedOdooEntity('القرين')).toBe(true)
      expect(isExcludedOdooEntity('Al-Qurain Kitchen')).toBe(true)
      expect(isExcludedOdooEntity('هايزن بريج')).toBe(true)
      expect(isExcludedOdooEntity('Heisenberg')).toBe(true)
      expect(isExcludedOdooEntity('هايزنبرغ')).toBe(true)
      expect(isExcludedOdooEntity('الجهراء')).toBe(true)
      expect(isExcludedOdooEntity('Jahra')).toBe(true)
      expect(isExcludedOdooEntity('Promenade')).toBe(false)
      expect(isExcludedOdooEntity('مول 360')).toBe(false)

      // Verify terminal sanitizer replaces any raw upstream #40/#41 label cleanly without leaking district names
      const sanitized41 = sanitizePosTerminalDisplayName(41, 'NPIS Canteen #41')
      expect(sanitized41).toContain('NPIS')
      expect(hawallyUiRe.test(sanitized41)).toBe(false)
    })
  })

  describe('2. Temporary Odoo Disconnect Truth (Zero Static Fallback)', () => {
    const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}

    beforeEach(() => {
      for (const key of ODOO_ENV_KEYS) {
        savedEnv[key] = process.env[key]
        delete process.env[key]
      }
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      resetFeryalAuditCache()
    })

    afterEach(() => {
      for (const key of ODOO_ENV_KEYS) {
        const prev = savedEnv[key]
        if (prev === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = prev
        }
      }
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      resetFeryalAuditCache()
    })

    it('returns strict no-data state across fetchLiveOdooSnapshot, GlobalWorkspace, Comparison, BeforeAfter, WarehouseChain, StrategicPlanning, and Feryal when Odoo env vars are removed', async () => {
      // 1. fetchLiveOdooSnapshot
      const envelope = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
      })
      expect(envelope.connected).toBe(false)
      expect(envelope.noData).toBe(true)
      expect(envelope.messageAr).toBe('لا توجد بيانات من Odoo لهذه الفترة')
      expect(envelope.totals.netSalesKwd).toBe(0)
      expect(envelope.totals.orders).toBe(0)

      // 2. computeGlobalWorkspace
      const workspace = computeGlobalWorkspace(DEFAULT_GLOBAL_FILTERS, envelope.summary)
      expect(workspace.odooConnected).toBe(false)
      expect(workspace.noData).toBe(true)
      expect(workspace.noDataMessageAr).toBe('لا توجد بيانات من Odoo لهذه الفترة')
      expect(workspace.salesKwd).toBe(0)
      expect(workspace.orders).toBe(0)
      expect(workspace.weightedNetPct).toBe(0)
      expect(workspace.per10.netPocket10).toBe(0)
      expect(workspace.accounting.operatingProfitKwd).toBeNull()

      // 3. computeErpComparison
      const comparison = computeErpComparison(
        {
          mode: 'date-vs-date',
          granularity: 'single',
          periodA: { from: '2026-11-14', to: '2026-11-14' },
          periodB: { from: '2026-11-07', to: '2026-11-07' },
          brandIds: 'all',
          branchIds: 'all',
          channelIds: 'all',
        },
        envelope.summary,
      )
      expect(comparison.connected).toBe(false)
      expect(comparison.noData).toBe(true)
      expect(comparison.messageAr).toBe('لا توجد بيانات من Odoo لهذه الفترة')
      for (const kpi of comparison.kpiList) {
        expect(kpi.valueA).toBe(0)
        expect(kpi.valueB).toBe(0)
      }

      // 4. computeBeforeAfterSnapshot
      const beforeAfter = computeBeforeAfterSnapshot(
        DEFAULT_GLOBAL_FILTERS,
        'period-prev',
        null,
        [],
        [],
        envelope.summary,
      )
      expect(beforeAfter.connected).toBe(false)
      expect(beforeAfter.noData).toBe(true)
      expect(beforeAfter.messageAr).toBe('لا توجد بيانات من Odoo لهذه الفترة')
      expect(beforeAfter.summary.sales.after).toBe(0)
      expect(beforeAfter.summary.sales.before).toBe(0)

      // 5. computeWarehouseDailyChain
      const warehouseChain = computeWarehouseDailyChain(
        DEFAULT_GLOBAL_FILTERS,
        undefined,
        'all',
        envelope.summary,
      )
      expect(warehouseChain.connected).toBe(false)
      expect(warehouseChain.noData).toBe(true)
      expect(warehouseChain.messageAr).toBe('لا توجد بيانات من Odoo لهذه الفترة')
      expect(warehouseChain.skuFlows).toEqual([])
      expect(warehouseChain.periodTotals.totalBranchesSalesKwd).toBe(0)

      // 6. computeStrategicPlanning
      const planning = computeStrategicPlanning(DEFAULT_GLOBAL_FILTERS, envelope.summary)
      expect(planning.odooConnected).toBe(false)
      expect(planning.noData).toBe(true)
      expect(planning.noDataMessageAr).toBe('لا توجد بيانات من Odoo لهذه الفترة')
      expect(planning.monthlyBaselineSalesKwd).toBe(0)
      expect(planning.scenarios).toEqual([])

      // 7. askFeryalOdooAgent
      const feryalRes = await askFeryalOdooAgent({
        question: 'كم مبيعات أمس 14/11 حسب الفرع؟',
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
      })
      expect(feryalRes.status).toBe('no_odoo_data')
      expect(feryalRes.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY)).toBe(true)
      expect(feryalRes.reply).toContain('يلزم')
      expect(feryalRes.verifier.valid).toBe(true)
    })
  })

  describe('3. Dynamic Period Reactivity (today, week, month, year) & Accounting Honesty', () => {
    it('updates GlobalWorkspace, Enterprise Reports, Accounting, and Strategic Planning across today/week/month/year and renders غير مُرحَّل بعد + قيود غير مكتملة لهذه الفترة when unposted', () => {
      const liveSummary = buildMultiPeriodLiveSummaryFixture()
      const periods: readonly GlobalPeriod[] = ['today', 'week', 'month', 'year']

      const workspaceSales: number[] = []
      const workspaceOrders: number[] = []
      const reportHeadlines: string[] = []
      const planningActiveSales: number[] = []
      const planningMonthlyBaselines: number[] = []

      for (const period of periods) {
        const filters = { ...DEFAULT_GLOBAL_FILTERS, period }
        const ws = computeGlobalWorkspace(filters, liveSummary, '/erp/dashboard')
        const departments = buildLiveEnterpriseDepartments(ws, liveSummary, true)
        const posReport = departments
          .flatMap((d) => d.reports)
          .find((r) => r.odooModel === 'pos.order')
        const glReport = departments
          .flatMap((d) => d.reports)
          .find((r) => r.odooModel === 'account.move.line')
        const planning = computeStrategicPlanning(ws, liveSummary)

        expect(ws.odooConnected).toBe(true)
        expect(ws.noData).toBe(false)
        expect(posReport).toBeDefined()
        expect(glReport).toBeDefined()

        workspaceSales.push(ws.salesKwd)
        workspaceOrders.push(ws.orders)
        reportHeadlines.push(posReport?.headlineMetricAr ?? '')
        planningActiveSales.push(planning.activePeriodSalesKwd)
        planningMonthlyBaselines.push(planning.monthlyBaselineSalesKwd)

        if (period === 'today' || period === 'week') {
          // Unposted aggregator commissions must display «غير مُرحَّل بعد» and NEVER 0
          expect(ws.aggregatorCommissionUnposted).toBe(true)
          expect(ws.accounting.aggregatorCommissionUnposted).toBe(true)
          expect(ws.accounting.aggregatorCommissionDisplayAr).toBe('غير مُرحَّل بعد')
          expect(ws.accounting.deliveryCommissionsKwd).toBeNull()

          // Incomplete GL entries must surface «قيود غير مكتملة لهذه الفترة»
          expect(ws.glIncomplete).toBe(true)
          expect(ws.glWarningAr).toBe('قيود غير مكتملة لهذه الفترة')
          expect(ws.accounting.glIncomplete).toBe(true)
          expect(ws.accounting.glWarningAr).toBe('قيود غير مكتملة لهذه الفترة')

          expect(planning.glIncomplete).toBe(true)
          expect(planning.glWarningAr).toBe('قيود غير مكتملة لهذه الفترة')
          expect(planning.aggregatorCommissionUnposted).toBe(true)

          const serializedGlReport = JSON.stringify(glReport)
          expect(serializedGlReport).toContain('قيود غير مكتملة لهذه الفترة')
          expect(serializedGlReport).toContain('غير مُرحَّل بعد')
        } else {
          // Complete posted accrual periods (month, year) expose real GL figures
          expect(ws.glIncomplete).toBe(false)
          expect(ws.aggregatorCommissionUnposted).toBe(false)
          expect(ws.accounting.available).toBe(true)
          expect(ws.accounting.deliveryCommissionsKwd).toBeGreaterThan(0)
          expect(ws.accounting.operatingProfitKwd).toBeGreaterThan(0)
          expect(planning.accountingAvailable).toBe(true)
          expect(planning.monthlyBaselineNetKwd).toBeGreaterThan(0)
        }
      }

      // Every period must yield strictly increasing sales & orders from today -> week -> month -> year
      expect(new Set(workspaceSales).size).toBe(4)
      expect(workspaceSales[0]).toBeLessThan(workspaceSales[1])
      expect(workspaceSales[1]).toBeLessThan(workspaceSales[2])
      expect(workspaceSales[2]).toBeLessThan(workspaceSales[3])

      expect(new Set(workspaceOrders).size).toBe(4)
      expect(new Set(reportHeadlines).size).toBe(4)
      expect(new Set(planningActiveSales).size).toBe(4)
      expect(new Set(planningMonthlyBaselines).size).toBe(4)
    })
  })

  describe('4. Feryal 5 Acceptance Questions (Exact Odoo Truth & Refusals)', () => {
    beforeEach(() => {
      resetFeryalAuditCache()
    })

    function createAcceptanceDataSource(options?: {
      topProductsPresent?: boolean
      purchaseOrdersPresent?: boolean
    }): FeryalOdooDataSource {
      const topProductsPresent = options?.topProductsPresent ?? true
      const purchaseOrdersPresent = options?.purchaseOrdersPresent ?? true

      const emptyWarehouse: OdooLiveWarehouseChainPayload = {
        connected: true,
        sourceMode: 'odoo17-live',
        noData: true,
        odooCompanyId: 1,
        lastSyncAt: '2026-11-15T08:55:00.000Z',
        isStale24h: false,
        dateRange: { from: '2026-11-14', to: '2026-11-14' },
        quantHasValueField: true,
        totals: {
          currentOnHandQty: 0,
          currentOnHandValueKwd: 0,
          ckOnHandValueKwd: 0,
          branchesOnHandValueKwd: 0,
          inboundSupplierKwd: 0,
          ckToBranchTransferKwd: 0,
          posConsumptionKwd: 0,
          scrapKwd: 0,
          scrapPctOfConsumption: 0,
          doneMovesCount: 0,
          scrapOrdersCount: 0,
          quantsCount: 0,
        },
        byBranchOnHand: {},
        dailyMoves: [],
        products: [],
        scraps: [],
      }

      const purchasePayload: OdooLivePurchaseSummary = purchaseOrdersPresent
        ? {
            connected: true,
            sourceMode: 'odoo17-live',
            noData: false,
            odooCompanyId: 1,
            lastSyncAt: '2026-11-15T08:55:00.000Z',
            isStale24h: false,
            dateRange: { from: '2026-10-16', to: '2026-11-14' },
            totals: {
              ordersCount: 6,
              linesCount: 18,
              vendorsCount: 1,
              productsCount: 5,
              totalUntaxedKwd: 3840.5,
              totalTaxKwd: 0,
              totalAmountKwd: 3840.5,
            },
            byVendor: [
              {
                partnerId: 501,
                vendorName: 'شركة المواشي الكويتية للتوريد',
                ordersCount: 6,
                linesCount: 18,
                totalUntaxedKwd: 3840.5,
                totalTaxKwd: 0,
                totalAmountKwd: 3840.5,
                latestOrderDate: '2026-11-14',
              },
            ],
            byProduct: [],
          }
        : {
            connected: true,
            sourceMode: 'odoo17-live',
            noData: true,
            odooCompanyId: 1,
            lastSyncAt: '2026-11-15T08:55:00.000Z',
            isStale24h: false,
            dateRange: { from: '2026-10-16', to: '2026-11-14' },
            totals: {
              ordersCount: 0,
              linesCount: 0,
              vendorsCount: 0,
              productsCount: 0,
              totalUntaxedKwd: 0,
              totalTaxKwd: 0,
              totalAmountKwd: 0,
            },
            byVendor: [],
            byProduct: [],
          }

      const cube = buildNov14AcceptanceCube(topProductsPresent)

      return {
        fetchPeriodCube: async () => cube,
        fetchWarehouseChain: async () => emptyWarehouse,
        fetchPurchaseOrders: async () => purchasePayload,
        fetchReceivablesSummary: async () => null,
        fetchBranchTopProducts: async () => cube.topProducts,
      }
    }

    it('Q1: «مبيعات أمس 14/11 حسب الفرع» returns all 7 exact branch numbers + 374.5 unattributed = 4,259.1 KWD', async () => {
      const res = await askFeryalOdooAgent({
        question: 'مبيعات أمس 14/11 حسب الفرع',
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: createAcceptanceDataSource(),
      })

      expect(res.status).toBe('answered')
      expect(res.verifier.valid).toBe(true)
      expect(res.executedQueries.some((q) => q.model === 'pos.order')).toBe(true)
      expect(res.reply).toContain('785.8') // مول 360
      expect(res.reply).toContain('582.1') // السالمية
      expect(res.reply).toContain('549.3') // الكوت
      expect(res.reply).toContain('526.1') // العارضية
      expect(res.reply).toContain('517.9') // بروميناد
      expect(res.reply).toContain('495.5') // الأفنيوز
      expect(res.reply).toContain('427.9') // العاصمة
      expect(res.reply).toContain('4,259.1') // إجمالي الشركة
      expect(res.reply).toContain('374.5') // غير منسوب لفرع
    })

    it('Q2: «مبيعات بروميناد يوم 14/11» returns 517.9 KWD and 107 orders (never 822)', async () => {
      const res = await askFeryalOdooAgent({
        question: 'مبيعات بروميناد يوم 14/11',
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: createAcceptanceDataSource(),
      })

      expect(res.status).toBe('answered')
      expect(res.verifier.valid).toBe(true)
      expect(res.reply).toContain('517.9')
      expect(res.reply).toContain('107')
      expect(res.reply).not.toContain('822')
    })

    it('Q3: «أعلى 5 أصناف أمس» returns either pos.order.line top items or «لا أملك بيانات من Odoo عن هذا»', async () => {
      const withItems = await askFeryalOdooAgent({
        question: 'أعلى 5 أصناف أمس',
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: createAcceptanceDataSource({ topProductsPresent: true }),
      })
      expect(withItems.status).toBe('answered')
      expect(withItems.executedQueries.some((q) => q.model === 'pos.order.line')).toBe(true)
      expect(withItems.reply).toContain('دجاج سويت آند ساور')
      expect(withItems.reply).toContain('412.5')

      const withoutItems = await askFeryalOdooAgent({
        question: 'أعلى 5 أصناف أمس',
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: createAcceptanceDataSource({ topProductsPresent: false }),
      })
      expect(withoutItems.status).toBe('no_odoo_data')
      expect(withoutItems.reply.startsWith('لا أملك بيانات من Odoo عن هذا')).toBe(true)
      expect(withoutItems.reply).toContain('يلزم')
      expect(withoutItems.verifier.valid).toBe(true)
    })

    it('Q4: «تكلفة مورد معين» returns either purchase.order vendor totals or «لا أملك بيانات من Odoo عن هذا» + linking suggestion', async () => {
      const withVendor = await askFeryalOdooAgent({
        question: 'كم تكلفة مورد شركة المواشي الكويتية؟',
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: createAcceptanceDataSource({ purchaseOrdersPresent: true }),
      })
      expect(withVendor.status).toBe('answered')
      expect(withVendor.executedQueries.some((q) => q.model === 'purchase.order')).toBe(true)
      expect(withVendor.reply).toContain('3,840.5')

      const withoutVendor = await askFeryalOdooAgent({
        question: 'كم تكلفة مورد شركة الأغذية المتحدة؟',
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: createAcceptanceDataSource({ purchaseOrdersPresent: false }),
      })
      expect(withoutVendor.status).toBe('no_odoo_data')
      expect(withoutVendor.reply.startsWith('لا أملك بيانات من Odoo عن هذا')).toBe(true)
      expect(withoutVendor.reply).toContain('يلزم')
      expect(withoutVendor.verifier.valid).toBe(true)
    })

    it('Q5: «مبيعات منافس» returns the single literal answer «لا أعرف»', async () => {
      const res = await askFeryalOdooAgent({
        question: 'كم مبيعات منافس مطعم بيك أمس في الكويت؟',
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: createAcceptanceDataSource(),
      })

      expect(res.status).toBe('competitor_refusal')
      expect(res.reply).toBe(FERYAL_COMPETITOR_REFUSAL)
      expect(res.reply).toBe('لا أعرف')
    })
  })
})
