import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as postAiBriefRun } from '@/app/api/erp/ai-brief/run/route'
import {
  DELETE as deleteErpFeryal,
  PATCH as patchErpFeryal,
  POST as postErpFeryal,
  PUT as putErpFeryal,
} from '@/app/api/erp/feryal/route'
import {
  DELETE as deleteErpFeryalChat,
  PATCH as patchErpFeryalChat,
  POST as postErpFeryalChat,
  PUT as putErpFeryalChat,
} from '@/app/api/erp/feryal/chat/route'
import { POST as postErpFeryalVision } from '@/app/api/erp/feryal/vision/route'
import {
  DELETE as deleteGovernance,
  PATCH as patchGovernance,
  POST as postGovernance,
  PUT as putGovernance,
} from '@/app/api/erp/governance/route'
import { POST as postGovernanceMetrics } from '@/app/api/erp/governance/metrics/route'
import { POST as postErpOdooSync } from '@/app/api/erp/odoo-sync/route'
import { POST as postPlanningForecast } from '@/app/api/erp/planning/forecast/route'
import {
  DELETE as deleteTerminalMappings,
  POST as postTerminalMappings,
  PUT as putTerminalMappings,
} from '@/app/api/erp/terminal-mappings/route'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  GLOBAL_BRANCH_OPTIONS,
  isBrandBranchCompatible,
} from '@/lib/aether/global-filter-engine'
import {
  computePlanningHubSnapshot,
  INITIAL_STRATEGIC_PHASES,
  sanitizeStrategicPhases,
} from '@/lib/aether/planning-engine'
import {
  INITIAL_REGULATIONS,
  sanitizeRegulations,
} from '@/lib/aether/regulations-engine'
import {
  evaluateCampaignOdooHalo,
  sanitizeCampaigns,
  sanitizeRealCampaigns,
} from '@/lib/aether/social-campaigns'
import {
  createExecSessionToken,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_AUDITOR_EMAIL,
  DEFAULT_CFO_EMAIL,
  DEFAULT_GM_EMAIL,
  DEFAULT_MARKETING_EMAIL,
  DEFAULT_OPS_EMAIL,
  DEFAULT_SUPPLY_EMAIL,
  EXEC_SESSION_COOKIE,
  type ExecSessionRole,
} from '@/lib/auth/exec-session'
import {
  AUDITOR_FORBIDDEN_PAGE_PREFIXES,
  canTriggerManualOdooSync,
  isAuditorForbiddenPath,
  isErpRouteAllowedForRole,
  resolveCanonicalErpAlias,
} from '@/lib/auth/role-access-policy'
import {
  DEMO_PRODUCT_CODES,
  demoCatalogReadsHidden,
} from '@/lib/demo-catalog'
import {
  CHARGEBACKS,
  PREP_ITEMS,
  SUPPLIER_ITEMS,
} from '@/lib/enterprise-giants-engine'
import {
  BRAND_SUITABILITY_MATRIX,
  calculateBreakEven,
  calculateThreeScenarios,
  GOLDEN_EVENT_MENU,
  HISTORICAL_BENCHMARKS,
  OFFICIAL_EXB_MENUS,
  recommendBrandForEvent,
  VENTURE_FOODS_EVENTS,
} from '@/lib/events/venture-events-engine'
import {
  getShelfLifeRule,
  listShelfLifeRules,
  primaryOwnerBrand,
  ruleMatchesBrandFilter,
  SHELF_LIFE_MATRIX,
} from '@/lib/food-safety/shelf-life-matrix'
import { money } from '@/lib/money'
import {
  bustOdooLiveCache,
  fetchLiveOdooPeriodCube,
  fetchLiveOdooPurchaseOrders,
  fetchLiveOdooSnapshot,
  fetchLiveOdooWarehouseChain,
  resolveRestaurantBranchForConfig,
} from '@/lib/odoo-live-connector'
import {
  companyPosConfigAllowed,
  companyPosRegisterIds,
  isPinnedSchoolCanteenConfigId,
  restaurantRegisterIds,
  SCHOOL_CANTEEN_BRANCH_ID,
  schoolCanteenRegisterIds,
} from '@/lib/odoo/company-pos'
import {
  isExcludedOdooEntity,
  stripExcludedOdooTree,
} from '@/lib/odoo/excluded-entities'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import {
  isNonCompanyCatalogItem,
  NON_COMPANY_ITEM_SKUS,
  nonCompanyItemSql,
} from '@/lib/odoo/non-company-products'
import posRegistry from '@/lib/odoo/pos-registry.json'
import { sanitizePosTerminalDisplayName } from '@/lib/odoo-terminal-mappings'
import {
  computeDeliverySlaSnapshot,
  computeSocialReviewsSnapshot,
} from '@/lib/ops-expansion-part2'
import { isHiddenPanelProduct } from '@/lib/panel-visibility'
import { VENTURE_BRANCHES, VENTURE_BRANDS } from '@/lib/venture-hierarchy'
import { middleware } from '@/middleware'
import {
  listFoodSafetySites,
  PREP_CATALOG,
} from '@/modules/food-safety/domain/catalog'
import { analyzeContract } from '@/modules/governance/domain/analyze'
import {
  findShortages,
  planMovement,
  stockNeeds,
  stockValue,
} from '@/modules/inventory/domain/stock'
import {
  applyIssueCost,
  applyReceiptCost,
} from '@/modules/inventory/domain/valuation'
import {
  orderNeedsApproval,
  planReceipt,
  statusAfterReceipt,
} from '@/modules/procurement/domain/order'
import { buildAnalyticMatrix } from '@/modules/suite/domain/analytic-matrix'

const ROOT_DIR = process.cwd()
const TEST_REF_NOW_MS = Date.parse('2026-11-15T12:00:00.000Z')

const ODOO_ENV_KEYS = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_LOGIN',
  'ODOO_API_KEY',
] as const

function rpcJson(id: number, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function collectAllPageFiles(): Promise<string[]> {
  const appDir = path.join(ROOT_DIR, 'src', 'app')
  const found: string[] = []
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.name === 'page.tsx') {
        found.push(path.relative(ROOT_DIR, full).split(path.sep).join('/'))
      }
    }
  }
  await walk(appDir)
  return found.sort()
}

function pageFileToRouteUrl(relPagePath: string): string {
  // Strip 'src/app' prefix and '/page.tsx' suffix, drop Next.js route groups `(group)`,
  // and materialize dynamic segments (`[id]`, `[token]`, `[module]`) into concrete sample slugs.
  const withoutWrapper = relPagePath
    .replace(/^src\/app/, '')
    .replace(/\/page\.tsx$/, '')
  const segments = withoutWrapper
    .split('/')
    .filter(Boolean)
    .filter((seg) => !/^\([^)]+\)$/.test(seg))
    .map((seg) => {
      if (seg === '[token]') return 'pay-tok-sample-001'
      if (seg === '[module]') return 'inventory'
      if (seg === '[id]') return '11111111-1111-4111-8111-111111111111'
      return seg.replace(/^\[(.+)\]$/, 'sample-$1')
    })
  return segments.length === 0 ? '/' : `/${segments.join('/')}`
}

function buildPageRequest(pathname: string, token?: string): NextRequest {
  const headers = new Headers()
  if (token) {
    headers.set('cookie', `${EXEC_SESSION_COOKIE}=${token}`)
  }
  return new NextRequest(`https://aetherbi.com${pathname}`, {
    method: 'GET',
    headers,
  })
}

function buildApiRequest(
  pathname: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  token?: string,
  body?: Record<string, unknown>,
): NextRequest {
  const headers = new Headers({
    accept: 'application/json',
    origin: 'https://aetherbi.com',
    host: 'aetherbi.com',
    'sec-fetch-site': 'same-origin',
  })
  if (token) {
    headers.set('cookie', `${EXEC_SESSION_COOKIE}=${token}`)
  }
  if (body) {
    headers.set('content-type', 'application/json')
  }
  return new NextRequest(`https://aetherbi.com${pathname}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

function buildConnectedLiveSummaryForTier2(): OdooLiveSummary {
  const byBrand = {
    'china-garden': { netKwd: 25000, orders: 4500, qty: 9000 },
    franks: { netKwd: 18000, orders: 3200, qty: 6400 },
    tahina: { netKwd: 17000, orders: 3100, qty: 6200 },
    'farm-brown': { netKwd: 18000, orders: 3000, qty: 6000 },
    'noodle-bar': { netKwd: 14000, orders: 2400, qty: 4800 },
    'karak-cafeteria': { netKwd: 8000, orders: 2000, qty: 4000 },
  }
  const byLocation = {
    avenues: { netKwd: 18000, orders: 3200 },
    '360-mall': { netKwd: 17000, orders: 3000 },
    assima: { netKwd: 14000, orders: 2500 },
    promenade: { netKwd: 13000, orders: 2400 },
    salmiya: { netKwd: 13000, orders: 2300 },
    'al-kout': { netKwd: 12000, orders: 2200 },
    ardiya: { netKwd: 9000, orders: 1800 },
    'school-canteens': { netKwd: 4000, orders: 800 },
  }
  const uiChannels = {
    'dine-in': { netKwd: 28000, orders: 4800 },
    'takeaway-direct': { netKwd: 16000, orders: 3100 },
    'talabat-tgo': { netKwd: 22000, orders: 4100 },
    'talabat-tmp': { netKwd: 10000, orders: 1900 },
    deliveroo: { netKwd: 11000, orders: 2000 },
    jahez: { netKwd: 7000, orders: 1200 },
    keeta: { netKwd: 6000, orders: 1100 },
    snoonu: { netKwd: 0, orders: 0 },
  }
  const monthBucket = {
    key: 'month' as const,
    from: '2026-10-16',
    to: '2026-11-15',
    days: 30,
    totals: {
      netSalesKwd: 100000,
      orders: 18200,
      aovKwd: 5.495,
      restaurantNetKwd: 96000,
      restaurantOrders: 17400,
    },
    byBrand,
    byLocation,
    mappedByLocation: byLocation,
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
    uiChannels,
    accounting: {
      available: true,
      from: '2026-10-16',
      to: '2026-11-15',
      sourceModel: 'account.move.line' as const,
      lineCount: 320,
      income: 100000,
      otherIncome: 0,
      totalRevenue: 100000,
      cogs: 32000,
      deliveryCommissions: 9500,
      deliveryCommissionLinesCount: 18,
      expense: 36000,
      depreciation: 4500,
      otherOpexAndDepreciation: 40500,
      operatingProfit: 18000,
      completeAccrualPosted: true,
      glIncomplete: false,
      aggregatorCommissionUnposted: false,
    },
  }

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    envConfigured: true,
    syncedAt: '2026-11-15T11:55:00.000Z',
    lastSyncAt: '2026-11-15T11:55:00.000Z',
    latestRecordAt: '2026-11-15T11:40:00.000Z',
    latestOperationalDate: '2026-11-15',
    isStale24h: false,
    isStaleOver24h: false,
    odooCompanyId: 1,
    bucket: 'month',
    period: { from: '2026-10-16', to: '2026-11-15' },
    dateRange: { from: '2026-10-16', to: '2026-11-15' },
    database: null,
    totals: { netSalesKwd: 100000, orders: 18200, aovKwd: 5.495 },
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
    brands: APPROVED_BRAND_IDS.map((id) => ({
      id,
      brand: id,
      netKwd: byBrand[id].netKwd,
      sharePct: byBrand[id].netKwd / 1000,
    })),
    branches: [...APPROVED_BRANCH_IDS, 'school-canteens' as const].map((id) => ({
      id,
      name: id,
      unit: id === 'school-canteens' ? 'canteen' : 'restaurant',
      netSalesKwd: byLocation[id].netKwd,
      orders: byLocation[id].orders,
      sharePct: byLocation[id].netKwd / 1000,
    })),
    channels: Object.entries(uiChannels).map(([name, row]) => ({
      name,
      amountKwd: row.netKwd,
    })),
    dailySeries: [
      { day: '2026-11-08', netKwd: 3100, orders: 560 },
      { day: '2026-11-09', netKwd: 3200, orders: 580 },
      { day: '2026-11-10', netKwd: 3300, orders: 590 },
      { day: '2026-11-11', netKwd: 3800, orders: 690 },
      { day: '2026-11-12', netKwd: 4100, orders: 740 },
      { day: '2026-11-13', netKwd: 4400, orders: 790 },
    ],
    dailyByBranch: {
      '2026-11-08': { 'school-canteens': { netKwd: 180, orders: 42 } },
      '2026-11-09': { 'school-canteens': { netKwd: 190, orders: 45 } },
      '2026-11-10': { 'school-canteens': { netKwd: 200, orders: 48 } },
      '2026-11-11': { 'school-canteens': { netKwd: 260, orders: 61 } },
      '2026-11-12': { 'school-canteens': { netKwd: 275, orders: 64 } },
      '2026-11-13': { 'school-canteens': { netKwd: 290, orders: 68 } },
    },
    buckets: {
      today: { ...monthBucket, key: 'today', days: 1 },
      week: { ...monthBucket, key: 'week', days: 7 },
      month: monthBucket,
      year: { ...monthBucket, key: 'year', days: 318 },
    },
  }
}

describe('Wave 3B — Tier 2 Data Honesty, Exclusions, School Canteens & 109-Route Auth/RBAC Suite', () => {
  const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}

  beforeEach(() => {
    for (const k of ODOO_ENV_KEYS) {
      savedEnv[k] = process.env[k]
    }
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    for (const k of ODOO_ENV_KEYS) {
      const prev = savedEnv[k]
      if (prev === undefined) delete process.env[k]
      else process.env[k] = prev
    }
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  describe('1. Tier 2 Zero Fabricated/Demo Numbers & Non-Company Products (croissant, avocado)', () => {
    it('purges static demo datasets and enforces honest unlinked / noData states across Tier 2 engines', () => {
      // Events & Booth engines: zero hardcoded historical events, menus, benchmarks
      expect(VENTURE_FOODS_EVENTS).toEqual([])
      expect(BRAND_SUITABILITY_MATRIX).toEqual([])
      expect(GOLDEN_EVENT_MENU).toEqual([])
      expect(OFFICIAL_EXB_MENUS).toEqual([])
      expect(HISTORICAL_BENCHMARKS).toEqual([])
      const unlinkedEventRec = recommendBrandForEvent('mega_expo', 5000, 'medium')
      expect(unlinkedEventRec.primaryBrands).toEqual([])
      expect(unlinkedEventRec.recommendedMenu).toEqual([])
      expect(unlinkedEventRec.projectedAovKwd).toBe(0)
      expect(unlinkedEventRec.recommendedConceptAr).toContain('غير مربوط بمصدر')

      // Planning & Regulations engines: zero pre-populated static phases or synthetic regulations
      expect(INITIAL_STRATEGIC_PHASES).toEqual([])
      expect(INITIAL_REGULATIONS).toEqual([])

      // Enterprise Giants engine: zero static supplier items, prep items, or chargebacks
      expect(SUPPLIER_ITEMS).toEqual([])
      expect(PREP_ITEMS).toEqual([])
      expect(CHARGEBACKS).toEqual([])

      // Social Reviews & Delivery SLA engines: honest unlinked telemetry state
      const reviewsSnap = computeSocialReviewsSnapshot()
      expect(reviewsSnap.unlinkedSource).toBe(true)
      expect(reviewsSnap.messageAr).toBe('غير مربوط بمصدر')
      expect(reviewsSnap.reviews).toEqual([])
      expect(reviewsSnap.totalReviews).toBe(0)
      expect(reviewsSnap.avgRating).toBe(0)

      const deliverySlaSnap = computeDeliverySlaSnapshot()
      expect(deliverySlaSnap.unlinkedSource).toBe(true)
      expect(deliverySlaSnap.messageAr).toBe('غير مربوط بمصدر')
      expect(deliverySlaSnap.trips).toEqual([])
      expect(deliverySlaSnap.meanMinutes).toBe(0)

      // Disconnected Planning & Campaign Halo: strict noData with zero fabricated numbers
      const disconnectedWs = computeGlobalWorkspace(DEFAULT_GLOBAL_FILTERS, null)
      const disconnectedPlan = computePlanningHubSnapshot(
        disconnectedWs,
        [],
        '90d',
        '2026-11-01',
        '2026-12-15',
        null,
      )
      expect(disconnectedPlan.odooConnected).toBe(false)
      expect(disconnectedPlan.noData).toBe(true)
      expect(disconnectedPlan.noDataMessageAr).toBe('لا توجد بيانات من Odoo لهذه الفترة')
      expect(disconnectedPlan.monthlyBaselineSalesKwd).toBe(0)
      expect(disconnectedPlan.scenarios).toEqual([])

      const [camp] = sanitizeCampaigns([
        {
          id: 'c-test-1',
          brand: 'china-garden',
          branch: 'avenues',
          adType: 'instagram',
          campaignName: 'حملة الأفنيوز',
          spendKwd: 150,
          date: '2026-11-11',
        },
      ])
      const disconnectedHalo = evaluateCampaignOdooHalo(camp!, 'all', 'all', null)
      expect(disconnectedHalo.odooConnected).toBe(false)
      expect(disconnectedHalo.noData).toBe(true)
      expect(disconnectedHalo.before3dSalesKwd).toBe(0)
      expect(disconnectedHalo.after3dSalesKwd).toBe(0)
      expect(disconnectedHalo.verdictAr).toBe('لا توجد بيانات من Odoo لهذه الفترة')
    })

    it('blocks all 10 non-company SKUs plus croissant and avocado (Arabic & English) while preserving real Venture Foods SKUs', () => {
      expect(NON_COMPANY_ITEM_SKUS).toHaveLength(10)
      for (const sku of NON_COMPANY_ITEM_SKUS) {
        expect(isNonCompanyCatalogItem(sku, 'Standard Roll')).toBe(true)
        expect(isHiddenPanelProduct(sku, 'Standard Roll')).toBe(true)
      }

      // Croissant & Avocado variants (English + Arabic spellings) MUST all be flagged as non-company
      for (const badName of [
        'Butter Croissant',
        'Chocolate croissant',
        'كرواسون جبن',
        'كرواسان زبدة',
        'Fresh Avocado Toast',
        'Hass avocado 1kg',
        'سلطة أفوكادو',
        'عصير افوكادو',
      ]) {
        expect(isNonCompanyCatalogItem('CUSTOM-SKU-99', badName), badName).toBe(true)
        expect(isHiddenPanelProduct('CUSTOM-SKU-99', badName), badName).toBe(true)
      }

      // Authentic Venture Foods 6-brand items & HACCP preps must remain allowed
      for (const [sku, name] of [
        ['PP03192', 'Chicken Brined FB Prod'],
        ['PP03199', 'Beef Franks Sliced Prod'],
        ['PP03159', 'Par-Cooked Chicken Sliced'],
        ['PP03167', 'Boiled Noodles TNB Prod'],
        ['PP03191', 'Karak Tea Mix Prod'],
        ['PP03279', 'Chicken Shawarma Skewer Frozen Prod'],
      ] as const) {
        expect(isNonCompanyCatalogItem(sku, name)).toBe(false)
        expect(isHiddenPanelProduct(sku, name)).toBe(false)
      }

      // SQL helper preserves exact parameter shape (1 tenant + 1 SKU array + 6 name terms + 1 bracketed SKU array)
      const params: unknown[] = ['tenant-001']
      const clause = nonCompanyItemSql('i.sku', 'i.name', params)
      expect(clause).toContain('i.sku <> all($2::text[])')
      expect(params).toHaveLength(9)

      // Demo catalog hidden in production
      expect(DEMO_PRODUCT_CODES.length).toBeGreaterThanOrEqual(15)
      expect(demoCatalogReadsHidden({ NODE_ENV: 'production' })).toBe(true)

      // Food-Safety Shelf-Life Matrix & Prep Catalog contain zero croissant/avocado items
      const nonCompanyInMatrix = SHELF_LIFE_MATRIX.filter((r) =>
        isNonCompanyCatalogItem(r.code, `${r.nameEn} ${r.nameAr}`),
      )
      expect(nonCompanyInMatrix).toEqual([])
      expect(PREP_CATALOG.length).toBe(SHELF_LIFE_MATRIX.length)
      expect(primaryOwnerBrand(getShelfLifeRule('PP03192')!)).toBe('FARM-BROWN')
      expect(ruleMatchesBrandFilter(getShelfLifeRule('PP03192')!, 'CHINA-GARDEN')).toBe(false)
      expect(listShelfLifeRules({ brand: 'SHAWARMA-TAHINA' }).some((r) => r.code === 'PP03279')).toBe(true)
    })
  })

  describe('2. Exclusions (Heisenberg, Qurain, Jahra) Never Surface in Tier 2 Domain Outputs; Hawally names are accepted', () => {
    it('strips excluded entities and non-company items from planning, regulations, social-reviews, booth/events, food-safety, and suite matrix while keeping school canteens', () => {
      // 2A. Planning Engine (`sanitizeStrategicPhases` + `computePlanningHubSnapshot`)
      const sanitizedPhases = sanitizeStrategicPhases([
        {
          id: 'ph-valid-ard',
          titleAr: 'رفع كفاءة تحضير مطبخ العارضية المركزي',
          titleEn: 'Ardiya Central Kitchen Prep Optimization',
          costCapKwd: 1200,
          expectedMonthlyGainKwd: 2400,
        },
        {
          id: 'ph-valid-canteen',
          titleAr: 'تطوير خط تغذية مقصف مدرسة NPIS',
          titleEn: 'NPIS Hawally School Canteen Prep Line',
          costCapKwd: 600,
          expectedMonthlyGainKwd: 950,
        },
        {
          id: 'ph-bad-heisenberg',
          titleAr: 'إطلاق علامة هايزنبرغ',
          titleEn: 'Heisenberg Relaunch',
          costCapKwd: 5000,
          expectedMonthlyGainKwd: 9000,
        },
        {
          id: 'ph-bad-qurain',
          titleAr: 'تشغيل مستودع القرين',
          titleEn: 'Qurain Warehouse Expansion',
          costCapKwd: 3000,
          expectedMonthlyGainKwd: 4000,
        },
        {
          id: 'ph-bad-hawally',
          titleAr: 'إعادة افتتاح فرع حولي التجاري',
          titleEn: 'Hawally Restaurant Reopening',
          costCapKwd: 8000,
          expectedMonthlyGainKwd: 12000,
        },
        {
          id: 'ph-bad-jahra',
          titleAr: 'افتتاح فرع الجهراء',
          titleEn: 'Jahra Branch Fitout',
          costCapKwd: 7000,
          expectedMonthlyGainKwd: 11000,
        },
        {
          id: 'ph-bad-croissant',
          titleAr: 'خط إنتاج كرواسون وأفوكادو',
          titleEn: 'Butter Croissant & Avocado Line',
          costCapKwd: 1500,
          expectedMonthlyGainKwd: 2000,
        },
      ])
      // Owner decision 2026-11-18: Hawally names are no longer excluded (no closed Hawally restaurant).
      expect(sanitizedPhases.map((p) => p.id)).toEqual(['ph-valid-ard', 'ph-valid-canteen', 'ph-bad-hawally'])

      const liveSummary = buildConnectedLiveSummaryForTier2()
      const ws = computeGlobalWorkspace(DEFAULT_GLOBAL_FILTERS, liveSummary, '/erp/planning')
      const planSnap = computePlanningHubSnapshot(
        ws,
        sanitizedPhases,
        '90d',
        '2026-11-16',
        '2027-02-14',
        liveSummary,
      )
      expect(planSnap.odooConnected).toBe(true)
      expect(planSnap.noData).toBe(false)
      expect(planSnap.scenarios).toHaveLength(3)
      const serializedPlan = JSON.stringify(planSnap)
      expect(serializedPlan).not.toMatch(/heisenberg|qurain|jahra|هايزن|القرين|الجهراء/i)

      // 2B. Regulations Engine (`sanitizeRegulations`)
      const regs = sanitizeRegulations([
        {
          id: 'reg-1',
          track: 'municipality-pafn',
          titleAr: 'ترخيص سلامة الغذاء — مجمع الأفنيوز ومول 360',
          titleEn: 'PAFN Renewal — The Avenues & 360 Mall',
          costImpactKwd: 250,
          penaltyAvoidedKwd: 2000,
        },
        {
          id: 'reg-canteen',
          track: 'municipality-pafn',
          titleAr: 'اشتراطات مقصف مدرسة FAIPS الأحمدي و NPIS',
          titleEn: 'FAIPS Ahmadi & NPIS Hawally School Canteen Inspection',
          costImpactKwd: 120,
          penaltyAvoidedKwd: 1000,
        },
        {
          id: 'reg-bad-1',
          track: 'municipality-pafn',
          titleAr: 'رخصة فرع حولي المغلق',
          titleEn: 'Hawally Restaurant License',
        },
        {
          id: 'reg-bad-2',
          track: 'municipality-pafn',
          titleAr: 'مخزن القرين والجهراء وهايزنبرغ',
          titleEn: 'Qurain & Jahra Heisenberg Storage',
        },
      ])
      expect(regs.map((r) => r.id)).toEqual(['reg-1', 'reg-canteen', 'reg-bad-1']) // Hawally accepted

      // 2C. Social Campaigns & Halo Engine (`sanitizeCampaigns` / `evaluateCampaignOdooHalo`)
      const campaigns = sanitizeRealCampaigns([
        {
          id: 'sc-valid-canteen',
          brand: 'farm-brown',
          branch: 'school-canteens',
          adType: 'instagram',
          campaignName: 'وجبات مقاصف المدارس',
          campaignNameEn: 'School Canteens Meal Deal',
          promotedItem: 'شرائح دجاج فارم براون',
          spendKwd: 80,
          date: '2026-11-11',
        },
        {
          id: 'sc-bad-heisenberg',
          brand: 'franks',
          branch: 'salmiya',
          adType: 'tiktok',
          campaignName: 'حملة هايزنبرغ',
          campaignNameEn: 'Heisenberg Special',
          spendKwd: 200,
          date: '2026-11-11',
        },
        {
          id: 'sc-bad-hawally',
          brand: 'tahina',
          branch: 'promenade',
          adType: 'snapchat',
          campaignName: 'عرض فرع حولي',
          spendKwd: 150,
          date: '2026-11-11',
        },
        {
          id: 'sc-bad-jahra-qurain',
          brand: 'china-garden',
          branch: 'al-kout',
          adType: 'influencer',
          campaignName: 'توصيل الجهراء والقرين',
          spendKwd: 300,
          date: '2026-11-11',
        },
        {
          id: 'sc-bad-avocado',
          brand: 'karak-cafeteria',
          branch: 'salmiya',
          adType: 'instagram',
          campaignName: 'فطور الصباح',
          promotedItem: 'Croissant & Avocado Toast',
          spendKwd: 90,
          date: '2026-11-11',
        },
      ])
      expect(campaigns.map((c) => c.id)).toEqual(['sc-valid-canteen', 'sc-bad-hawally']) // Hawally accepted
      expect(campaigns[0]?.branch).toBe('school-canteens')
      const canteenHalo = evaluateCampaignOdooHalo(campaigns[0]!, 'all', 'all', liveSummary)
      expect(canteenHalo.odooConnected).toBe(true)
      expect(canteenHalo.noData).toBe(false)
      expect(canteenHalo.after3dSalesKwd).toBeGreaterThan(canteenHalo.before3dSalesKwd)

      // 2D. Booth & Events Calculators (`calculateBreakEven` & `calculateThreeScenarios`)
      const be = calculateBreakEven({
        boothRentKwd: 1500,
        fitoutSignageKwd: 500,
        permitsTransportKwd: 200,
        daysCount: 10,
        staffCount: 4,
        dailyWagePerStaffKwd: 15,
        expectedAovKwd: 5,
        estimatedCogsPercent: 32,
        dailyOtherFixedCostKwd: 20,
      })
      expect(be.totalFixedCostsKwd).toBe(1500 + 500 + 200 + 600 + 200)
      expect(be.contributionMarginPercent).toBe(68)
      expect(be.projectedNetProfitAtSales(6000).netProfitKwd).toBeCloseTo(6000 * 0.68 - 3000, 3)

      const scenarios = calculateThreeScenarios({
        daysCount: 14,
        totalRentKwd: 2800,
        fitoutKwd: 700,
        staffCount: 4,
        dailyWagePerStaffKwd: 15,
        expectedAovKwd: 5.5,
        estimatedCogsPercent: 30,
        marketingOpexKwd: 300,
        baselineDailyOrders: 120,
        selectedBrands: [
          'China Garden',
          "Frank's",
          'Heisenberg',
          'هايزنبرغ',
          'Qurain Kitchen',
          'Jahra Booth',
          'Hawally Pop-up',
        ],
      })
      expect(scenarios.brandBreakdown.map((b) => b.brandName)).toEqual([
        'China Garden',
        "Frank's",
        'Hawally Pop-up', // Hawally accepted (owner decision 2026-11-18)
      ])

      // 2E. Food-Safety Sites & Suite Analytic Matrix
      const fsSites = listFoodSafetySites()
      const siteIds = fsSites.map((s) => s.id)
      expect(new Set(siteIds).size).toBe(siteIds.length)
      expect(
        fsSites.some((s) =>
          isExcludedOdooEntity(`${s.id} ${s.nameEn} ${s.nameAr} ${s.areaEn} ${s.areaAr}`),
        ),
      ).toBe(false)

      const matrix = buildAnalyticMatrix([
        { brandName: 'Farm Brown', branchName: 'Ardiya', amountMinor: 500_000 },
        { brandName: 'China Garden', branchName: 'NPIS Hawally Canteen', amountMinor: 200_000 },
        { brandName: 'Tahina', branchName: 'FAIPS Ahmadi Canteen', amountMinor: 180_000 },
        { brandName: 'Heisenberg', branchName: 'Salmiya', amountMinor: 999_000 },
        { brandName: 'Farm Brown', branchName: 'Hawally Branch', amountMinor: 400_000 },
        { brandName: 'China Garden', branchName: 'Jahra', amountMinor: 300_000 },
        { brandName: 'Franks', branchName: 'Qurain', amountMinor: 250_000 },
      ])
      expect(matrix.map((m) => `${m.brandName}@${m.branchName}`)).toEqual([
        'Farm Brown@Ardiya',
        'China Garden@NPIS Hawally Canteen',
        'Tahina@FAIPS Ahmadi Canteen',
        'Farm Brown@Hawally Branch', // Hawally accepted (owner decision 2026-11-18)
      ])
    })

    it('filters excluded entities & croissant/avocado out of live Odoo inventory (warehouse-chain) & procurement (purchase-orders) while preserving NPIS #41 & FAIPS #42 canteens', async () => {
      process.env.ODOO_URL = 'https://odoo.venturefoodskw.test'
      process.env.ODOO_DB = 'vf_prod'
      process.env.ODOO_USERNAME = 'api@venturefoodskw.test'
      process.env.ODOO_API_KEY = 'secret-test-key'

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number
          params?: { service?: string; method?: string; args?: unknown[] }
        }
        const reqId = body.id ?? 1
        if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
          return rpcJson(reqId, 7)
        }
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')

        if (model === 'res.users' && method === 'read') {
          return rpcJson(reqId, [{ id: 7, company_id: [1, 'Venture Foods'] }])
        }
        if (method === 'fields_get') {
          return rpcJson(reqId, {
            value: { type: 'float' },
            quantity: { type: 'float' },
            date_done: { type: 'datetime' },
            product_uom_id: { type: 'many2one' },
          })
        }
        if (model === 'pos.category' && method === 'search_read') {
          return rpcJson(reqId, [
            { id: 10, name: 'CG', parent_id: false },
            { id: 13, name: 'FB', parent_id: false },
            { id: 150, name: 'Heisenberg', parent_id: false },
          ])
        }
        if (model === 'stock.location' && method === 'search_read') {
          return rpcJson(reqId, [
            { id: 1, name: 'Vendors', complete_name: 'Partner Locations/Vendors', usage: 'supplier' },
            { id: 2, name: 'Customers', complete_name: 'Partner Locations/Customers', usage: 'customer' },
            { id: 10, name: 'Stock', complete_name: 'EXB/Central Kitchen Stock', usage: 'internal' },
            { id: 11, name: 'Stock', complete_name: '360 Mall/Stock', usage: 'internal' },
            { id: 41, name: 'Canteen', complete_name: 'NPIS Hawally School Canteen/Stock', usage: 'internal' },
            { id: 42, name: 'Canteen', complete_name: 'FAIPS Ahmadi Canteen/Stock', usage: 'internal' },
            { id: 91, name: 'Stock', complete_name: 'Qurain Warehouse/Stock', usage: 'internal' },
            { id: 92, name: 'Stock', complete_name: 'Jahra Branch/Stock', usage: 'internal' },
            { id: 93, name: 'Stock', complete_name: 'Hawally Restaurant/Stock', usage: 'internal' },
            { id: 94, name: 'Stock', complete_name: 'Heisenberg Kitchen/Stock', usage: 'internal' },
          ])
        }
        if (model === 'stock.quant' && method === 'read_group') {
          return rpcJson(reqId, [
            { product_id: [501, '[PP03192] Chicken Brined FB'], location_id: [10, 'EXB/Central Kitchen Stock'], quantity: 80, value: 148.0, __count: 1 },
            { product_id: [501, '[PP03192] Chicken Brined FB'], location_id: [11, '360 Mall/Stock'], quantity: 25, value: 46.25, __count: 1 },
            { product_id: [501, '[PP03192] Chicken Brined FB'], location_id: [41, 'NPIS Hawally School Canteen/Stock'], quantity: 12, value: 22.2, __count: 1 },
            { product_id: [501, '[PP03192] Chicken Brined FB'], location_id: [42, 'FAIPS Ahmadi Canteen/Stock'], quantity: 8, value: 14.8, __count: 1 },
            // Poisoned locations & non-company items that MUST be excluded:
            { product_id: [501, '[PP03192] Chicken Brined FB'], location_id: [91, 'Qurain Warehouse/Stock'], quantity: 999, value: 1800, __count: 1 },
            { product_id: [501, '[PP03192] Chicken Brined FB'], location_id: [93, 'Hawally Restaurant/Stock'], quantity: 500, value: 925, __count: 1 },
            { product_id: [601, '[RIFDC013] Butter Croissant'], location_id: [10, 'EXB/Central Kitchen Stock'], quantity: 50, value: 75, __count: 1 },
            { product_id: [602, '[AVO-01] Fresh Avocado'], location_id: [11, '360 Mall/Stock'], quantity: 30, value: 60, __count: 1 },
            { product_id: [603, '[HB-01] Heisenberg Burger Patty'], location_id: [10, 'EXB/Central Kitchen Stock'], quantity: 40, value: 90, __count: 1 },
          ])
        }
        if (model === 'stock.move' && method === 'read_group') {
          return rpcJson(reqId, [])
        }
        if (model === 'stock.scrap' && method === 'search_read') {
          return rpcJson(reqId, [])
        }
        if (model === 'product.product' && method === 'read') {
          return rpcJson(reqId, [
            { id: 501, name: 'Chicken Brined FB', default_code: 'PP03192', standard_price: 1.85, categ_id: [1, 'Poultry'], pos_categ_id: [13, 'FB'], uom_id: [1, 'kg'] },
            { id: 601, name: 'Butter Croissant', default_code: 'RIFDC013', standard_price: 1.5, categ_id: [2, 'Bakery'], pos_categ_id: [13, 'FB'], uom_id: [1, 'Unit'] },
            { id: 602, name: 'Fresh Avocado', default_code: 'AVO-01', standard_price: 2.0, categ_id: [3, 'Produce'], pos_categ_id: [10, 'CG'], uom_id: [1, 'kg'] },
            { id: 603, name: 'Heisenberg Burger Patty', default_code: 'HB-01', standard_price: 2.25, categ_id: [1, 'Beef'], pos_categ_id: [150, 'Heisenberg'], uom_id: [1, 'kg'] },
          ])
        }
        if (model === 'purchase.order' && method === 'read_group') {
          return rpcJson(reqId, [
            { partner_id: [201, 'Kuwait Poultry Supply Co.'], amount_untaxed: 1850, amount_tax: 0, amount_total: 1850, __count: 4 },
            { partner_id: [202, 'Qurain Cold Logistics'], amount_untaxed: 900, amount_tax: 0, amount_total: 900, __count: 2 },
            { partner_id: [203, 'Jahra Food Trading'], amount_untaxed: 750, amount_tax: 0, amount_total: 750, __count: 1 },
            { partner_id: [204, 'Hawally Wholesale Market'], amount_untaxed: 620, amount_tax: 0, amount_total: 620, __count: 1 },
            { partner_id: [205, 'Heisenberg Ingredients Ltd'], amount_untaxed: 540, amount_tax: 0, amount_total: 540, __count: 1 },
          ])
        }
        if (model === 'purchase.order' && method === 'search_read') {
          return rpcJson(reqId, [
            { id: 801, partner_id: [201, 'Kuwait Poultry Supply Co.'], date_order: '2026-11-14 08:00:00' },
          ])
        }
        if (model === 'purchase.order.line' && method === 'search_read') {
          return rpcJson(reqId, [
            { id: 1, order_id: [801, 'PO00801'], partner_id: [201, 'Kuwait Poultry Supply Co.'], product_id: [501, '[PP03192] Chicken Brined FB'], product_uom: [1, 'kg'], product_qty: 1000, price_unit: 1.85, price_subtotal: 1850 },
            { id: 2, order_id: [802, 'PO00802'], partner_id: [201, 'Kuwait Poultry Supply Co.'], product_id: [601, '[RIFDC013] Butter Croissant'], product_uom: [1, 'Unit'], product_qty: 100, price_unit: 0.8, price_subtotal: 80 },
            { id: 3, order_id: [803, 'PO00803'], partner_id: [201, 'Kuwait Poultry Supply Co.'], product_id: [602, 'Hass Avocado'], product_uom: [1, 'kg'], product_qty: 50, price_unit: 2.1, price_subtotal: 105 },
            { id: 4, order_id: [804, 'PO00804'], partner_id: [202, 'Qurain Cold Logistics'], product_id: [501, '[PP03192] Chicken Brined FB'], product_uom: [1, 'kg'], product_qty: 200, price_unit: 1.85, price_subtotal: 370 },
            { id: 5, order_id: [805, 'PO00805'], partner_id: [201, 'Kuwait Poultry Supply Co.'], product_id: [603, 'Heisenberg Sauce'], product_uom: [1, 'kg'], product_qty: 40, price_unit: 3.0, price_subtotal: 120 },
          ])
        }
        return rpcJson(reqId, [])
      })

      const rawWarehouse = await fetchLiveOdooWarehouseChain('2026-11-01', '2026-11-15', TEST_REF_NOW_MS)
      const wh = stripExcludedOdooTree(rawWarehouse)
      expect(wh.connected).toBe(true)
      expect(wh.products.map((p) => p.skuCode)).toEqual(['PP03192'])
      expect(wh.byBranchOnHand['360-mall']).toEqual({ qty: 25, valueKwd: 46.25 })
      // NPIS Hawally (#41 -> 12 qty / 22.2 KWD) + FAIPS Ahmadi (#42 -> 8 qty / 14.8 KWD) preserved under school-canteens!
      expect(wh.byBranchOnHand[SCHOOL_CANTEEN_BRANCH_ID]).toEqual({ qty: 20, valueKwd: 37 })
      // The Hawally Restaurant/Stock location (500) is no longer dropped by name (owner decision 2026-11-18).
      expect(wh.totals.currentOnHandQty).toBe(80 + 25 + 12 + 8 + 500)
      expect(JSON.stringify(wh)).not.toMatch(/heisenberg|qurain|jahra|croissant|avocado/i)

      const po = await fetchLiveOdooPurchaseOrders('2026-11-01', '2026-11-15', {
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(po.connected).toBe(true)
      // Hawally Wholesale Market is no longer dropped by name (owner decision 2026-11-18).
      expect(po.byVendor.map((v) => v.vendorName)).toEqual(['Kuwait Poultry Supply Co.', 'Hawally Wholesale Market'])
      expect(po.byProduct.map((p) => p.productName)).toEqual(['[PP03192] Chicken Brined FB'])
      expect(po.totals.totalUntaxedKwd).toBe(1850 + 620)
      expect(JSON.stringify(po)).not.toMatch(/heisenberg|qurain|jahra|croissant|avocado/i)
    })

    it('preserves pure Tier 2 inventory, procurement, and contract domain math in integer fils', () => {
      // Inventory stock & weighted-average valuation domain
      const transferRows = planMovement(
        {
          type: 'TRANSFER',
          itemId: 'item-fb-1',
          fromWarehouseId: 'wh-ardiya-ck',
          toWarehouseId: 'wh-360-mall',
          quantity: 15,
          note: 'CK dispatch',
        },
        'tr-001',
      )
      expect(transferRows).toHaveLength(2)
      expect(transferRows[0]?.quantity + transferRows[1]!.quantity).toBe(0)
      const needs = stockNeeds(transferRows)
      expect(findShortages(needs, new Map([['item-fb-1:wh-ardiya-ck', 20]]))).toEqual([])
      expect(stockValue(10, money(1850)).amountMinor).toBe(18_500)

      const receiptSnap = applyReceiptCost(10, 1_800, 10, 2_000)
      expect(receiptSnap.averageAfterMinor).toBe(1_900)
      const issueSnap = applyIssueCost(receiptSnap.qtyAfter, receiptSnap.averageAfterMinor, 5)
      expect(issueSnap.averageAfterMinor).toBe(1_900)
      expect(issueSnap.qtyAfter).toBe(15)

      // Procurement order & receipt domain
      expect(orderNeedsApproval(500_000, 500_000)).toBe(false)
      expect(orderNeedsApproval(500_001, 500_000)).toBe(true)
      const planned = planReceipt(
        [
          {
            id: 'ol-1',
            lineNo: 1,
            itemId: 'item-fb-1',
            description: 'Chicken Brined FB',
            quantity: 20,
            unitCostMinor: 1850,
            taxRateBps: 0,
            receivedQuantity: 5,
            invoicedQuantity: 0,
            returnedQuantity: 0,
            creditedQuantity: 0,
          },
        ],
        [{ orderLineId: 'ol-1', quantity: 15 }],
      )
      expect(planned).toEqual([{ orderLineId: 'ol-1', itemId: 'item-fb-1', quantity: 15 }])
      expect(statusAfterReceipt([{ quantity: 20, receivedQuantity: 20 }])).toBe('received')

      // Governance / Operations contract clause analyzer
      const draft = analyzeContract(
        {
          title: 'عقد توريد دواجن مبردة — مطبخ العارضية',
          counterparty: 'شركة الدواجن الكويتية',
          startDate: '2026-01-01',
          endDate: '2026-11-25',
          valueMinor: 3_500_000,
          renewalAlertDays: 30,
        },
        '2026-11-15',
      )
      expect(draft.riskScore).toBe(80)
      expect(draft.risks.map((r) => r.code)).toEqual(['renewal', 'value'])
    })
  })

  describe('3. School Canteens 41 (NPIS Hawally) & 42 (FAIPS Ahmadi) Preserved Where Branch Lists Are Derived', () => {
    it('preserves pos.config 41 (NPIS Hawally) & 42 (FAIPS Ahmadi) while accepting Hawally names and rejecting vetoed exclusions', () => {
      expect(posRegistry.schoolCanteenPosConfigIds).toEqual([41, 42, 43])
      expect(schoolCanteenRegisterIds()).toEqual([41, 42, 43])
      expect(isPinnedSchoolCanteenConfigId(41)).toBe(true)
      expect(isPinnedSchoolCanteenConfigId(42)).toBe(true)
      expect(isPinnedSchoolCanteenConfigId(43)).toBe(true)

      // Full company register list = restaurant registers + [41, 42, 43]
      const fullCompanyIds = companyPosRegisterIds()
      expect(fullCompanyIds).toContain(41)
      expect(fullCompanyIds).toContain(42)
      expect(fullCompanyIds).toContain(43)
      expect(restaurantRegisterIds()).not.toContain(41)
      expect(restaurantRegisterIds()).not.toContain(42)
      expect(restaurantRegisterIds()).not.toContain(43)

      // Pinned canteens 41 & 42 allowed even when #41 contains closed-branch district name "Hawally"
      expect(companyPosConfigAllowed(41, 'NPIS Hawally School Canteen', true)).toBe(true)
      expect(companyPosConfigAllowed(42, 'FAIPS Ahmadi School Canteen', true)).toBe(true)
      expect(companyPosConfigAllowed(41, 'NPIS Hawally School Canteen', false)).toBe(false)

      // Pinned canteens STILL vetoed if Heisenberg, Qurain, or Jahra appears
      expect(companyPosConfigAllowed(41, 'Heisenberg NPIS Hawally', true)).toBe(false)
      expect(companyPosConfigAllowed(41, 'Qurain Canteen', true)).toBe(false)
      expect(companyPosConfigAllowed(42, 'Jahra Canteen', true)).toBe(false)

      // Owner decision 2026-11-18: a Hawally name is not excluded; a register outside the whitelist
      // (99) still stays out, a whitelisted one (8, Promenade) is accepted.
      expect(companyPosConfigAllowed(99, 'Hawally Restaurant POS', true)).toBe(false)
      expect(companyPosConfigAllowed(8, 'Promenade Hawally', true)).toBe(true)
      expect(isExcludedOdooEntity('Hawally Restaurant POS')).toBe(false)
      expect(isExcludedOdooEntity('NPIS Hawally School Canteen')).toBe(false)
      expect(isExcludedOdooEntity('FAIPS Ahmadi School Canteen')).toBe(false)

      // Branch resolver maps 41 & 42 -> 'school-canteens', and terminal label sanitizer strips district word
      expect(resolveRestaurantBranchForConfig(41, 'NPIS Hawally School Canteen')).toBe('school-canteens')
      expect(resolveRestaurantBranchForConfig(42, 'FAIPS Ahmadi School Canteen')).toBe('school-canteens')
      const display41 = sanitizePosTerminalDisplayName(41, 'NPIS Hawally School Canteen')
      expect(display41).toContain('NPIS')
      expect(display41.toLowerCase()).not.toContain('hawally')
      const display42 = sanitizePosTerminalDisplayName(42, 'FAIPS Ahmadi School Canteen')
      expect(display42).toContain('FAIPS')

      // Global filter & hierarchy branch lists
      expect(GLOBAL_BRANCH_OPTIONS.map((b) => b.id)).toContain('school-canteens')
      expect(VENTURE_BRANDS).toHaveLength(6)
      expect(VENTURE_BRANCHES).toHaveLength(7)
      for (const brandId of APPROVED_BRAND_IDS) {
        expect(isBrandBranchCompatible(brandId, 'school-canteens')).toBe(true)
      }

      // Also verify live POS snapshot & period cube filter out croissant/avocado from topProducts while keeping canteen 41/42 sales
      process.env.ODOO_URL = 'https://odoo.venturefoodskw.test'
      process.env.ODOO_DB = 'vf_prod'
      process.env.ODOO_USERNAME = 'api@venturefoodskw.test'
      process.env.ODOO_API_KEY = 'secret-test-key'

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number
          params?: { service?: string; method?: string; args?: unknown[] }
        }
        const reqId = body.id ?? 1
        if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
          return rpcJson(reqId, 7)
        }
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        if (model === 'res.users' && method === 'read') {
          return rpcJson(reqId, [{ id: 7, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'pos.config' && method === 'search_read') {
          return rpcJson(reqId, [
            { id: 34, name: 'The Avenues POS 1', active: true, company_id: [1, 'Venture Foods'] },
            { id: 41, name: 'NPIS Hawally School Canteen', active: true, company_id: [1, 'Venture Foods'] },
            { id: 42, name: 'FAIPS Ahmadi School Canteen', active: true, company_id: [1, 'Venture Foods'] },
          ])
        }
        if (model === 'pos.session' && method === 'read') {
          return rpcJson(reqId, [
            { id: 701, config_id: [34, 'The Avenues POS 1'] },
            { id: 741, config_id: [41, 'NPIS Hawally School Canteen'] },
            { id: 742, config_id: [42, 'FAIPS Ahmadi School Canteen'] },
          ])
        }
        if (model === 'pos.category' && method === 'search_read') {
          return rpcJson(reqId, [
            { id: 10, name: 'CG', parent_id: false },
            { id: 15, name: 'Karak Cafeteria', parent_id: false },
          ])
        }
        if (model === 'product.product' && method === 'read') {
          return rpcJson(reqId, [
            { id: 101, name: '[CG-01] Sweet & Sour Chicken', default_code: 'CG-01', pos_categ_id: [10, 'CG'] },
            { id: 901, name: '[RIFDC013] Butter Croissant', default_code: 'RIFDC013', pos_categ_id: [15, 'Karak Cafeteria'] },
            { id: 902, name: 'Avocado Salad', default_code: 'AVO-99', pos_categ_id: [10, 'CG'] },
          ])
        }
        if (model === 'pos.order.line' && method === 'read_group') {
          return rpcJson(reqId, [
            { product_id: [101, '[CG-01] Sweet & Sour Chicken'], price_subtotal: 320, qty: 80, discount: 0, __count: 80 },
            { product_id: [901, '[RIFDC013] Butter Croissant'], price_subtotal: 95, qty: 40, discount: 0, __count: 40 },
            { product_id: [902, 'Avocado Salad'], price_subtotal: 60, qty: 20, discount: 0, __count: 20 },
          ])
        }
        if (model === 'pos.order' && method === 'read_group') {
          return rpcJson(reqId, [
            { session_id: [701, 'POS/701'], pricelist_id: [1, 'Dine-In'], amount_total: 500, amount_tax: 0, __count: 100, __range: { 'date_order:day': { from: '2026-11-14 21:00:00', to: '2026-11-15 21:00:00' } } },
            { session_id: [741, 'POS/741'], pricelist_id: [1, 'Dine-In'], amount_total: 160, amount_tax: 0, __count: 45, __range: { 'date_order:day': { from: '2026-11-14 21:00:00', to: '2026-11-15 21:00:00' } } },
            { session_id: [742, 'POS/742'], pricelist_id: [1, 'Dine-In'], amount_total: 140, amount_tax: 0, __count: 38, __range: { 'date_order:day': { from: '2026-11-14 21:00:00', to: '2026-11-15 21:00:00' } } },
          ])
        }
        return rpcJson(reqId, [])
      })

      return Promise.all([
        fetchLiveOdooPeriodCube('2026-11-15', '2026-11-15', TEST_REF_NOW_MS),
        fetchLiveOdooSnapshot({ period: 'month', forceRefresh: true, referenceNowMs: TEST_REF_NOW_MS }),
      ]).then(([cube, snap]) => {
        expect(cube.connected).toBe(true)
        expect(cube.byBranch['school-canteens']?.netKwd).toBe(300)
        expect(cube.byBranch['school-canteens']?.orders).toBe(83)
        expect(cube.topProducts.map((p) => p.name)).toEqual(['[CG-01] Sweet & Sour Chicken'])
        expect(snap.connected).toBe(true)
        expect(JSON.stringify(cube.topProducts)).not.toMatch(/croissant|avocado/i)
      })
    })
  })

  describe('4. Auth & RBAC Sanity Across All 109 Routes + Auditor Read-Only Enforcement on /api/erp/*', () => {
    it('discovers all 109 page.tsx routes and enforces unauthenticated /login redirect on every non-login route', async () => {
      const pageFiles = await collectAllPageFiles()
      expect(pageFiles).toHaveLength(109)

      const routeUrls = pageFiles.map(pageFileToRouteUrl)
      expect(routeUrls).toContain('/')
      expect(routeUrls).toContain('/login')
      expect(routeUrls).toContain('/erp')
      expect(routeUrls).toContain('/dashboard')
      expect(routeUrls).toContain('/admin')
      expect(routeUrls).toContain('/admin/ai-runs')
      expect(routeUrls).toContain('/pos')
      expect(routeUrls).toContain('/kds')
      expect(routeUrls).toContain('/ess')

      const unguardedInternalRoutes: string[] = []
      for (const routeUrl of routeUrls) {
        const res = await middleware(buildPageRequest(routeUrl))
        if (routeUrl === '/login') {
          expect(res.status, '/login should render publicly when unauthenticated').toBe(200)
          continue
        }
        const loc = res.headers.get('location') ?? ''
        if (res.status !== 307 || !loc.includes('/login')) {
          unguardedInternalRoutes.push(`${routeUrl} (status=${res.status}, location=${loc})`)
        }
      }
      expect(unguardedInternalRoutes).toEqual([])
    })

    it('verifies layout & server-component auth guards alongside role-scoped RBAC matrix across all 8 roles', async () => {
      // Verify server-side layout/page auth guard presence in source
      const [panelShell, erpShell, posPage, adminPage, adminAiRunsPage] = await Promise.all([
        readFile(path.join(ROOT_DIR, 'src/components/shell.tsx'), 'utf8'),
        readFile(path.join(ROOT_DIR, 'src/components/erp/shell.tsx'), 'utf8'),
        readFile(path.join(ROOT_DIR, 'src/app/(pos)/pos/page.tsx'), 'utf8'),
        readFile(path.join(ROOT_DIR, 'src/app/admin/page.tsx'), 'utf8'),
        readFile(path.join(ROOT_DIR, 'src/app/admin/ai-runs/page.tsx'), 'utf8'),
      ])
      expect(panelShell).toContain('await requireUser()')
      expect(erpShell).toContain('await requireUser()')
      expect(posPage).toContain('await requireUser()')
      expect(adminPage).toContain('authenticateUser(')
      expect(adminAiRunsPage).toContain('verifyExecSessionToken(')

      // Canonical short ERP aliases
      expect(resolveCanonicalErpAlias('/erp/booth')).toBe('/erp/booth-feasibility')
      expect(resolveCanonicalErpAlias('/erp/reviews')).toBe('/erp/social-reviews')
      expect(resolveCanonicalErpAlias('/erp/commissions')).toBe('/erp/aggregator-radar')

      const tokens: Record<ExecSessionRole, string> = {
        admin: await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin'),
        gm: await createExecSessionToken(DEFAULT_GM_EMAIL, 'gm'),
        dgm: await createExecSessionToken('dgm@venturefoodskw.com', 'dgm'),
        ops: await createExecSessionToken(DEFAULT_OPS_EMAIL, 'ops'),
        cfo: await createExecSessionToken(DEFAULT_CFO_EMAIL, 'cfo'),
        marketing: await createExecSessionToken(DEFAULT_MARKETING_EMAIL, 'marketing'),
        supply: await createExecSessionToken(DEFAULT_SUPPLY_EMAIL, 'supply'),
        auditor: await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor'),
      }

      // Admin-only routes (`/erp/admin`, `/erp/iam`, `/api/erp/terminal-mappings`, `/api/erp/role-directory`)
      expect((await middleware(buildPageRequest('/erp/admin', tokens.admin))).status).toBe(200)
      expect((await middleware(buildPageRequest('/erp/iam', tokens.admin))).status).toBe(200)
      for (const nonAdmin of ['gm', 'dgm', 'ops', 'cfo', 'marketing', 'supply'] as const) {
        const resAdminPage = await middleware(buildPageRequest('/erp/admin', tokens[nonAdmin]))
        expect(resAdminPage.status, `${nonAdmin} blocked from /erp/admin`).toBe(307)
        const resTermApi = await middleware(
          buildApiRequest('/api/erp/terminal-mappings', 'GET', tokens[nonAdmin]),
        )
        expect(resTermApi.status, `${nonAdmin} 403 on /api/erp/terminal-mappings`).toBe(403)
      }

      // Marketing & Supply scope isolation
      expect(isErpRouteAllowedForRole('marketing', '/erp/booth-feasibility')).toBe(true)
      expect(isErpRouteAllowedForRole('marketing', '/erp/social-reviews')).toBe(true)
      expect(isErpRouteAllowedForRole('marketing', '/erp/planning')).toBe(false)
      expect(isErpRouteAllowedForRole('marketing', '/pos')).toBe(false)
      expect(isErpRouteAllowedForRole('supply', '/erp/warehouse-chain')).toBe(true)
      expect(isErpRouteAllowedForRole('supply', '/erp/food-safety')).toBe(true)
      expect(isErpRouteAllowedForRole('supply', '/erp/executive-pnl')).toBe(false)
      expect(isErpRouteAllowedForRole('supply', '/kds')).toBe(false)

      // Auditor forbidden read/page prefixes return 403
      for (const forbiddenPrefix of AUDITOR_FORBIDDEN_PAGE_PREFIXES) {
        expect(isAuditorForbiddenPath(forbiddenPrefix)).toBe(true)
        const res = await middleware(buildPageRequest(forbiddenPrefix, tokens.auditor))
        expect(res.status, `auditor 403 on ${forbiddenPrefix}`).toBe(403)
      }

      // Manual Odoo sync role gate
      expect(canTriggerManualOdooSync('admin')).toBe(true)
      expect(canTriggerManualOdooSync('gm')).toBe(true)
      expect(canTriggerManualOdooSync('cfo')).toBe(true)
      expect(canTriggerManualOdooSync('marketing')).toBe(false)
      expect(canTriggerManualOdooSync('supply')).toBe(false)
      expect(canTriggerManualOdooSync('auditor')).toBe(false)
    })

    it('enforces strict 403 Read-Only Auditor block on all Tier 2 & /api/erp/* mutation endpoints (Edge + Route Handlers)', async () => {
      const auditorToken = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor')

      // 1. Edge middleware blocks POST / PUT / PATCH / DELETE across every /api/erp/* and Tier 2 mutation prefix
      const mutationTargets: readonly {
        path: string
        methods: readonly ('POST' | 'PUT' | 'PATCH' | 'DELETE')[]
      }[] = [
        { path: '/api/erp/odoo-sync', methods: ['POST'] },
        { path: '/api/erp/governance', methods: ['POST', 'PUT', 'PATCH', 'DELETE'] },
        { path: '/api/erp/governance/metrics', methods: ['POST', 'PUT', 'PATCH', 'DELETE'] },
        { path: '/api/erp/ai-brief/run', methods: ['POST'] },
        { path: '/api/erp/planning/forecast', methods: ['POST'] },
        { path: '/api/erp/terminal-mappings', methods: ['POST', 'PUT', 'DELETE'] },
        { path: '/api/erp/feryal', methods: ['POST', 'PUT', 'PATCH', 'DELETE'] },
        { path: '/api/erp/feryal/chat', methods: ['POST', 'PUT', 'PATCH', 'DELETE'] },
        { path: '/api/erp/feryal/vision', methods: ['POST'] },
        { path: '/api/food-safety/batches', methods: ['POST'] },
        { path: '/api/food-safety/dispose', methods: ['POST'] },
        { path: '/api/food-safety/check-in', methods: ['POST'] },
        { path: '/api/smart-dropzone/process', methods: ['POST'] },
        { path: '/api/kds/tickets', methods: ['POST', 'PATCH'] },
        { path: '/api/v1/procurement/orders', methods: ['POST'] },
        { path: '/api/v1/inventory/items', methods: ['POST'] },
        { path: '/api/v1/kitchen/waste', methods: ['POST'] },
        { path: '/api/v1/operations/contracts', methods: ['POST'] },
      ]

      for (const target of mutationTargets) {
        for (const method of target.methods) {
          const mwRes = await middleware(buildApiRequest(target.path, method, auditorToken, {}))
          expect(mwRes.status, `Edge middleware auditor ${method} ${target.path}`).toBe(403)
          const body = (await mwRes.json()) as { ok?: boolean; error?: string }
          expect(body.ok).toBe(false)
        }
      }

      // 2. Defense-in-depth: direct Route Handler invocations ALSO reject auditor with 403 Forbidden
      const directHandlerResponses = await Promise.all([
        postErpOdooSync(buildApiRequest('/api/erp/odoo-sync', 'POST', auditorToken, {})),
        postGovernance(buildApiRequest('/api/erp/governance', 'POST', auditorToken, { action: 'verifyPin', pin: '0000' })),
        patchGovernance(buildApiRequest('/api/erp/governance', 'PATCH', auditorToken, { action: 'approve', approvalId: 'x' })),
        putGovernance(buildApiRequest('/api/erp/governance', 'PUT', auditorToken, {})),
        deleteGovernance(buildApiRequest('/api/erp/governance', 'DELETE', auditorToken)),
        postGovernanceMetrics(buildApiRequest('/api/erp/governance/metrics', 'POST', auditorToken, {})),
        postAiBriefRun(buildApiRequest('/api/erp/ai-brief/run', 'POST', auditorToken, {})),
        postPlanningForecast(buildApiRequest('/api/erp/planning/forecast', 'POST', auditorToken, {})),
        postTerminalMappings(buildApiRequest('/api/erp/terminal-mappings', 'POST', auditorToken, { terminal_id: 41, branch_id: 'salmiya' })),
        putTerminalMappings(buildApiRequest('/api/erp/terminal-mappings', 'PUT', auditorToken, { terminal_id: 41, branch_id: 'salmiya' })),
        deleteTerminalMappings(buildApiRequest('/api/erp/terminal-mappings?terminal_id=41', 'DELETE', auditorToken)),
        postErpFeryal(buildApiRequest('/api/erp/feryal', 'POST', auditorToken, { question: 'مبيعات أمس' })),
        putErpFeryal(buildApiRequest('/api/erp/feryal', 'PUT', auditorToken, {})),
        patchErpFeryal(buildApiRequest('/api/erp/feryal', 'PATCH', auditorToken, {})),
        deleteErpFeryal(buildApiRequest('/api/erp/feryal', 'DELETE', auditorToken)),
        postErpFeryalChat(buildApiRequest('/api/erp/feryal/chat', 'POST', auditorToken, { question: 'مبيعات أمس' })),
        putErpFeryalChat(buildApiRequest('/api/erp/feryal/chat', 'PUT', auditorToken, {})),
        patchErpFeryalChat(buildApiRequest('/api/erp/feryal/chat', 'PATCH', auditorToken, {})),
        deleteErpFeryalChat(buildApiRequest('/api/erp/feryal/chat', 'DELETE', auditorToken)),
        postErpFeryalVision(buildApiRequest('/api/erp/feryal/vision', 'POST', auditorToken, {})),
      ])

      for (const res of directHandlerResponses) {
        expect(res.status).toBe(403)
      }
    })
  })
})
