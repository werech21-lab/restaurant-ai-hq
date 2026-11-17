import { beforeEach, describe, expect, it } from 'vitest'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import type { OdooReceivableClearingSummary } from '@/lib/odoo/live-sync-core'
import {
  detectOdooToolKind,
  detectTargetBranchFromQuestion,
  detectTargetBrandFromQuestion,
  detectTargetChannelFromQuestion,
  resolveFeryalComparisonPeriods,
  resolveFeryalQuestionPeriod,
} from '@/lib/feryal-intent'
import {
  askFeryalOdooAgent,
  FERYAL_NO_ODOO_DATA_REPLY,
  resetFeryalAuditCache,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'

/**
 * Reference instant: 2026-11-17 14:30:00 Asia/Kuwait (11:30:00 UTC).
 * - Kuwait today: 2026-11-17 (partial day up to 14:30)
 * - Kuwait yesterday: 2026-11-16
 * - Kuwait month-to-date: 2026-11-01 .. 2026-11-17
 */
const KUWAIT_NOV_17_2026_1430_MS = Date.UTC(2026, 10, 17, 11, 30, 0)

type ChannelCell = { netKwd: number; orders: number }
type ChannelKey =
  | 'dine-in'
  | 'takeaway-direct'
  | 'talabat-tgo'
  | 'talabat-tmp'
  | 'keeta'
  | 'deliveroo'
  | 'jahez'
  | 'snoonu'

function buildBranchChannels(overrides?: Partial<Record<ChannelKey, ChannelCell>>): Record<ChannelKey, ChannelCell> {
  return {
    'dine-in': { netKwd: 120, orders: 22 },
    'takeaway-direct': { netKwd: 85, orders: 18 },
    'talabat-tgo': { netKwd: 140.4, orders: 28 },
    'talabat-tmp': { netKwd: 64.6, orders: 13 },
    keeta: { netKwd: 92.5, orders: 19 },
    deliveroo: { netKwd: 45, orders: 8 },
    jahez: { netKwd: 18, orders: 4 },
    snoonu: { netKwd: 12, orders: 3 },
    ...overrides,
  }
}

function buildTestCube(fromIso: string, toIso: string): OdooPeriodCube {
  const isTodaySingle = fromIso === '2026-11-17' && toIso === '2026-11-17'
  const isYesterdaySingle = fromIso === '2026-11-16' && toIso === '2026-11-16'

  const alKoutChannels = buildBranchChannels({
    'talabat-tgo': { netKwd: 162.3, orders: 31 },
    'talabat-tmp': { netKwd: 78.2, orders: 15 },
    keeta: { netKwd: 114.6, orders: 24 },
  })

  const defaultChannels = buildBranchChannels()

  // Hourly series for partial-today vs full-yesterday same-hours verification:
  // Today (2026-11-17) only has hours up to 14:30 Kuwait:
  //   hour 11: 420.0 KWD (80 orders), hour 13: 510.0 KWD (95 orders), hour 14: 270.0 KWD (50 orders) => 1,200.0 KWD / 225 orders
  // Yesterday (2026-11-16) has BOTH daytime hours (<= 14) AND evening hours (19, 21):
  //   hours <= 14: hour 11: 380.0 (72), hour 13: 460.0 (88), hour 14: 160.0 (30) => 1,000.0 KWD / 190 orders
  //   hours > 14:  hour 19: 1,450.0 (260), hour 21: 1,809.1 (320) => full-day total = 4,259.1 KWD / 770 orders
  const hourlySeries = isTodaySingle
    ? [
        { hour: 11, netKwd: 420, orders: 80 },
        { hour: 13, netKwd: 510, orders: 95 },
        { hour: 14, netKwd: 270, orders: 50 },
      ]
    : isYesterdaySingle
      ? [
          { hour: 11, netKwd: 380, orders: 72 },
          { hour: 13, netKwd: 460, orders: 88 },
          { hour: 14, netKwd: 160, orders: 30 },
          { hour: 19, netKwd: 1450, orders: 260 },
          { hour: 21, netKwd: 1809.1, orders: 320 },
        ]
      : []

  const totalNet = isTodaySingle ? 1200 : 4523.5
  const totalOrders = isTodaySingle ? 225 : 861

  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-17T11:28:00.000Z',
    isStale24h: false,
    dateRange: { from: fromIso, to: toIso },
    days: fromIso === toIso ? 1 : 17,
    totals: {
      netSalesKwd: totalNet,
      orders: totalOrders,
      aovKwd: Number((totalNet / totalOrders).toFixed(3)),
      mappedBranchesNetKwd: 4149,
      mappedBranchesOrders: 801,
      unattributedSalesKwd: 374.5,
      unattributedOrders: 60,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 42.5,
      avgDiscountPct: 4.2,
      discountedLinesCount: 16,
    },
    byBranch: {
      '360-mall': { netKwd: 785.8, orders: 148, aovKwd: 5.31, channels: defaultChannels },
      salmiya: { netKwd: 582.1, orders: 118, aovKwd: 4.93, channels: defaultChannels },
      'al-kout': { netKwd: 549.3, orders: 109, aovKwd: 5.04, channels: alKoutChannels },
      ardiya: { netKwd: 526.1, orders: 96, aovKwd: 5.48, channels: defaultChannels },
      promenade: { netKwd: 517.9, orders: 107, aovKwd: 4.84, channels: defaultChannels },
      avenues: { netKwd: 495.5, orders: 86, aovKwd: 5.76, channels: defaultChannels },
      assima: { netKwd: 427.9, orders: 74, aovKwd: 5.78, channels: defaultChannels },
      // School canteens intentionally lower than Assima (264.4 < 427.9) to verify Prompt B.6:
      // Weakest/lowest branch must headline Assima (lowest restaurant), listing canteens separately!
      'school-canteens': { netKwd: 264.4, orders: 63, aovKwd: 4.2, channels: defaultChannels },
    },
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed',
      netKwd: 374.5,
      orders: 60,
      aovKwd: 6.24,
      channels: buildBranchChannels({
        'talabat-tgo': { netKwd: 0, orders: 0 },
        'talabat-tmp': { netKwd: 0, orders: 0 },
        keeta: { netKwd: 0, orders: 0 },
      }),
    },
    byBrand: {
      'china-garden': { netKwd: 1420.5, qty: 310, linesCount: 280, orders: 210, avgDiscountPct: 3, discountKwd: 12 },
      franks: { netKwd: 980.0, qty: 220, linesCount: 195, orders: 160, avgDiscountPct: 2, discountKwd: 8 },
      'farm-brown': { netKwd: 760.5, qty: 180, linesCount: 160, orders: 130, avgDiscountPct: 2, discountKwd: 7 },
      tahina: { netKwd: 610.0, qty: 150, linesCount: 140, orders: 115, avgDiscountPct: 2, discountKwd: 6 },
      'noodle-bar': { netKwd: 440.0, qty: 95, linesCount: 90, orders: 80, avgDiscountPct: 2, discountKwd: 5 },
      'karak-cafeteria': { netKwd: 312.5, qty: 140, linesCount: 120, orders: 95, avgDiscountPct: 1, discountKwd: 4.5 },
    },
    brandByBranch: {},
    byChannel: {
      'dine-in': { netKwd: 960, orders: 176 },
      'takeaway-direct': { netKwd: 680, orders: 144 },
      'talabat-tgo': { netKwd: 1145.1, orders: 227 },
      'talabat-tmp': { netKwd: 530.4, orders: 106 },
      keeta: { netKwd: 762.1, orders: 157 },
      deliveroo: { netKwd: 360, orders: 64 },
      jahez: { netKwd: 144, orders: 32 },
      snoonu: { netKwd: 96, orders: 24 },
    },
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries,
    hourlyByBranch: {},
    topProducts: [
      {
        productId: 501,
        name: 'دجاج سويت آند ساور',
        brandId: 'china-garden',
        netKwd: 412.5,
        qty: 95,
        linesCount: 88,
        avgDiscountPct: 0,
        discountKwd: 0,
      },
      {
        productId: 502,
        name: 'برجر فرانكس كلاسيك',
        brandId: 'franks',
        netKwd: 318.0,
        qty: 84,
        linesCount: 79,
        avgDiscountPct: 0,
        discountKwd: 0,
      },
      {
        productId: 503,
        name: 'شاورما طحينة دجاج',
        brandId: 'tahina',
        netKwd: 245.2,
        qty: 110,
        linesCount: 102,
        avgDiscountPct: 0,
        discountKwd: 0,
      },
    ],
    accounting: {
      available: true,
      from: fromIso,
      to: toIso,
      sourceModel: 'account.move.line',
      lineCount: 142,
      income: 61840.0,
      otherIncome: 0,
      totalRevenue: 61840.0,
      cogs: 24500.0,
      expense: 21200.5,
      depreciation: 2300.0,
      operatingProfit: 13839.5,
      completeAccrualPosted: true,
      glIncomplete: false,
    },
  }
}

const PROD_UNRECONCILED_RECEIVABLES: OdooReceivableClearingSummary = {
  readable: true,
  openReceivableKwd: -77462.759,
  grossPositiveReceivableKwd: 1804.295,
  creditClearingOffsetKwd: -79267.054,
  openLinesCount: 66570,
  posClearingLinesCount: 62766,
  platformAndCorporateLinesCount: 3804,
  openDebitsKwd: 3822787.227,
  unappliedCreditsKwd: -3900249.986,
  sourceModel: 'account.move.line',
}

function createDialectTestDataSource(options?: {
  receivables?: OdooReceivableClearingSummary | null
  stripHourlySeries?: boolean
}): FeryalOdooDataSource {
  return {
    fetchPeriodCube: async (fromIso, toIso) => {
      const cube = buildTestCube(fromIso, toIso)
      if (options?.stripHourlySeries) {
        return { ...cube, hourlySeries: [], hourlyByBranch: {} }
      }
      return cube
    },
    fetchPurchaseOrders: async (fromIso, toIso) => ({
      connected: true,
      sourceMode: 'odoo17-live',
      noData: false,
      odooCompanyId: 1,
      lastSyncAt: '2026-11-17T11:28:00.000Z',
      isStale24h: false,
      dateRange: { from: fromIso, to: toIso },
      totals: {
        ordersCount: 9,
        vendorsCount: 2,
        productsCount: 4,
        linesCount: 28,
        totalUntaxedKwd: 4310.2,
        totalTaxKwd: 0,
        totalAmountKwd: 4310.2,
      },
      byVendor: [
        {
          partnerId: 11,
          vendorName: 'شركة مطاحن الدقيق والمخابز الكويتية',
          ordersCount: 9,
          linesCount: 28,
          totalUntaxedKwd: 4310.2,
          totalTaxKwd: 0,
          totalAmountKwd: 4310.2,
          latestOrderDate: toIso,
        },
      ],
      byProduct: [],
    }),
    fetchWarehouseChain: async (fromIso, toIso) => ({
      connected: true,
      sourceMode: 'odoo17-live',
      noData: false,
      odooCompanyId: 1,
      lastSyncAt: '2026-11-17T11:28:00.000Z',
      isStale24h: false,
      dateRange: { from: fromIso, to: toIso },
      quantHasValueField: true,
      totals: {
        currentOnHandQty: 1420,
        currentOnHandValueKwd: 18450.0,
        ckOnHandValueKwd: 11200.0,
        branchesOnHandValueKwd: 7250.0,
        inboundSupplierKwd: 6840.5,
        ckToBranchTransferKwd: 5120.4,
        posConsumptionKwd: 4890.0,
        scrapKwd: 92.6,
        scrapPctOfConsumption: 1.89,
        doneMovesCount: 184,
        scrapOrdersCount: 7,
        quantsCount: 310,
      },
      byBranchOnHand: {},
      dailyMoves: [],
      products: [],
      scraps: [],
    }),
    fetchReceivablesSummary: async () =>
      options?.receivables !== undefined ? options.receivables : PROD_UNRECONCILED_RECEIVABLES,
    fetchBranchTopProducts: async () => [
      {
        productId: 501,
        name: 'دجاج سويت آند ساور',
        brandId: 'china-garden',
        netKwd: 142.5,
        qty: 31,
        linesCount: 29,
        avgDiscountPct: 0,
        discountKwd: 0,
      },
    ],
    fetchHrEmployees: async () => null,
  }
}

describe('Audit 2026-11-17 — Prompt A.4 & Prompt B: Feryal Dialect, Routing, Channels, Top Products, Lowest Branch & Same-Hour Comparisons', () => {
  beforeEach(() => {
    resetFeryalAuditCache()
  })

  describe('Prompt B exact replay table-driven suite (tool, period, branch, channel, and reply semantics)', () => {
    const EXACT_PROMPT_B_CASES: {
      question: string
      expectedTool:
        | 'pos_orders'
        | 'pos_order_lines'
        | 'pos_comparison'
        | 'not_pos_orders'
      expectedPeriod?: { from: string; to: string }
      expectedBranchId?: string | null
      forbidBranchId?: string
      expectedChannelId?: string | null
      expectUnknownBranch?: boolean
      expectedRankingDirection?: 'highest' | 'lowest' | null
    }[] = [
      {
        question: 'شو كانت مبيعات امبارح؟',
        expectedTool: 'pos_orders',
        expectedPeriod: { from: '2026-11-16', to: '2026-11-16' },
        expectedBranchId: null,
        expectedChannelId: null,
      },
      {
        question: 'كم مبيعات كيتا بالكوت امبارح؟',
        expectedTool: 'pos_orders',
        expectedPeriod: { from: '2026-11-16', to: '2026-11-16' },
        expectedBranchId: 'al-kout',
        expectedChannelId: 'keeta',
      },
      {
        question: 'كم مبيعات طلبات بالكوت امس؟',
        expectedTool: 'pos_orders',
        expectedPeriod: { from: '2026-11-16', to: '2026-11-16' },
        expectedBranchId: 'al-kout',
        expectedChannelId: 'talabat',
      },
      {
        question: 'كم مصاريف فرع الكوت هالشهر؟',
        expectedTool: 'not_pos_orders',
        expectedPeriod: { from: '2026-11-01', to: '2026-11-17' },
        expectedBranchId: 'al-kout',
      },
      {
        question: 'كم المخزون بالفرع؟',
        expectedTool: 'not_pos_orders',
        expectedBranchId: null,
      },
      {
        question: 'كم مبيعات فرع الفحاحيل؟',
        expectedTool: 'pos_orders',
        forbidBranchId: 'al-kout',
        expectedBranchId: null,
        expectUnknownBranch: true,
      },
      {
        question: 'شو أكثر صنف انباع امس؟',
        expectedTool: 'pos_order_lines',
        expectedPeriod: { from: '2026-11-16', to: '2026-11-16' },
        expectedBranchId: null,
      },
      {
        question: 'شو أضعف فرع هالشهر؟',
        expectedTool: 'pos_orders',
        expectedPeriod: { from: '2026-11-01', to: '2026-11-17' },
        expectedBranchId: null,
        expectedRankingDirection: 'lowest',
      },
      {
        question: 'قارن مبيعات اليوم مع امبارح',
        expectedTool: 'pos_comparison',
        expectedBranchId: null,
      },
    ]

    it.each(EXACT_PROMPT_B_CASES)(
      'routes "$question" to expected tool/period/branch/channel',
      ({
        question,
        expectedTool,
        expectedPeriod,
        expectedBranchId,
        forbidBranchId,
        expectedChannelId,
        expectUnknownBranch,
        expectedRankingDirection,
      }) => {
        const branchDet = detectTargetBranchFromQuestion(question)
        const brandDet = detectTargetBrandFromQuestion(question)
        const channelDet = detectTargetChannelFromQuestion(question)
        const compPeriods = resolveFeryalComparisonPeriods(question, KUWAIT_NOV_17_2026_1430_MS)
        const resolvedPeriod = resolveFeryalQuestionPeriod(question, KUWAIT_NOV_17_2026_1430_MS)
        const tool = detectOdooToolKind(
          question,
          branchDet.branchId,
          brandDet,
          compPeriods !== null,
          branchDet.isBranchRanking,
        )

        if (forbidBranchId) {
          expect(branchDet.branchId).not.toBe(forbidBranchId)
        }
        if (expectedBranchId !== undefined) {
          expect(branchDet.branchId).toBe(expectedBranchId)
        }
        if (expectUnknownBranch !== undefined) {
          expect(branchDet.unknownBranchRequested).toBe(expectUnknownBranch)
        }
        if (expectedRankingDirection !== undefined) {
          expect(branchDet.rankingDirection).toBe(expectedRankingDirection)
        }
        if (expectedChannelId !== undefined) {
          expect(channelDet.channelId).toBe(expectedChannelId)
        }
        if (expectedPeriod) {
          expect({ from: resolvedPeriod.from, to: resolvedPeriod.to }).toEqual(expectedPeriod)
        }
        if (expectedTool === 'not_pos_orders') {
          expect(tool).not.toBe('pos_orders')
        } else {
          expect(tool).toBe(expectedTool)
        }
      },
    )

    const EXISTING_SIX_RANKING_QUESTIONS = [
      'أي فرع حقق أعلى مبيعات اليوم؟',
      'مين الفرع اللي باع أكثر اليوم؟',
      'شو أعلى فرع مبيعاً اليوم',
      'أي فرع كان الأعلى مبيعاً مؤخراً؟',
      'أعلى فرع بالمبيعات',
      'which branch had the highest sales today',
    ]

    it.each(EXISTING_SIX_RANKING_QUESTIONS)(
      'keeps existing ranking question "%s" on pos_orders with highest direction and zero unknown_branch',
      async (question) => {
        const branchDet = detectTargetBranchFromQuestion(question)
        const brandDet = detectTargetBrandFromQuestion(question)
        const compPeriods = resolveFeryalComparisonPeriods(question, KUWAIT_NOV_17_2026_1430_MS)
        const tool = detectOdooToolKind(
          question,
          branchDet.branchId,
          brandDet,
          compPeriods !== null,
          branchDet.isBranchRanking,
        )

        expect(branchDet.unknownBranchRequested).toBe(false)
        expect(branchDet.isBranchRanking).toBe(true)
        expect(tool).toBe('pos_orders')

        const res = await askFeryalOdooAgent({
          question,
          referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
          dataSource: createDialectTestDataSource(),
        })
        expect(res.status).toBe('answered')
        expect(res.verifier.valid).toBe(true)
        expect(res.reply).toContain('تصدر فرع مول 360')
      },
    )
  })

  describe('Prompt B.1 — Yesterday words everywhere (never falling back to 30 days)', () => {
    const YESTERDAY_VARIANTS = [
      'امبارح',
      'مبارح',
      'إمبارح',
      'البارح',
      'البارحة',
      'أمس',
      'امس',
      'الامس',
    ]

    it.each(YESTERDAY_VARIANTS)(
      'resolves "%s" to yesterday (2026-11-16) in single-period, comparison, and vendor extraction',
      async (word) => {
        const single = resolveFeryalQuestionPeriod(
          `شو كانت المبيعات ${word}؟`,
          KUWAIT_NOV_17_2026_1430_MS,
        )
        expect({ from: single.from, to: single.to, hasExplicitPeriod: single.hasExplicitPeriod }).toEqual({
          from: '2026-11-16',
          to: '2026-11-16',
          hasExplicitPeriod: true,
        })

        const comp = resolveFeryalComparisonPeriods(
          `قارن مبيعات اليوم مع ${word}`,
          KUWAIT_NOV_17_2026_1430_MS,
        )
        expect(comp).not.toBeNull()
        expect(comp?.periodA.from).toBe('2026-11-17')
        expect(comp?.periodB.from).toBe('2026-11-16')

        const vendorRes = await askFeryalOdooAgent({
          question: `كم تكلفة المورد شركة مطاحن الدقيق والمخابز الكويتية ${word}؟`,
          referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
          dataSource: createDialectTestDataSource(),
        })
        expect(vendorRes.status).toBe('answered')
        expect(vendorRes.period).toEqual({ from: '2026-11-16', to: '2026-11-16' })
        expect(vendorRes.reply).toContain('4,310.2 د.ك')
      },
    )
  })

  describe('Prompt B.2 — Non-sales metrics never route to pos_orders or answer with sales numbers', () => {
    const NON_SALES_QUESTIONS = [
      'كم مصاريف فرع الكوت هالشهر؟',
      'كم مصروف فرع السالمية اليوم؟',
      'كم صرفنا بالفرع امبارح؟',
      'كم صرف الفرع اليوم؟',
      'كم المخزون بالفرع؟',
      'كم مخزون فرع الكوت؟',
      'كم رواتب فرع الكوت هالشهر؟',
      'كم عمولة التوصيل بالفرع؟',
      'كم ذمم الفرع المفتوحة؟',
      'كم الكاش بالفرع اليوم؟',
      'كم ايداع بنك الفرع امس؟',
      'what are the branch expenses this month?',
      'how much inventory is in the branch?',
      'branch stock today',
      'branch salary this month',
      'branch delivery commission today',
    ]

    it.each(NON_SALES_QUESTIONS)(
      'never routes "%s" to pos_orders and never answers with POS branch sales numbers',
      async (question) => {
        const branchDet = detectTargetBranchFromQuestion(question)
        const brandDet = detectTargetBrandFromQuestion(question)
        const comp = resolveFeryalComparisonPeriods(question, KUWAIT_NOV_17_2026_1430_MS)
        const tool = detectOdooToolKind(
          question,
          branchDet.branchId ?? 'al-kout',
          brandDet,
          comp !== null,
          branchDet.isBranchRanking,
        )

        expect(tool).not.toBe('pos_orders')

        const res = await askFeryalOdooAgent({
          question,
          referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
          dataSource: createDialectTestDataSource(),
        })
        expect(res.verifier.valid).toBe(true)
        expect(res.executedQueries.some((q) => q.model === 'pos.order')).toBe(false)
        // Must never emit Al-Kout POS sales (549.3) or company POS sales (4,523.5) as expenses/stock!
        expect(res.reply).not.toContain('549.3')
        expect(res.reply).not.toContain('4,523.5')
      },
    )
  })

  describe('Prompt B.3 — Fahaheel removed from Al-Kout aliases', () => {
    it('refuses "كم مبيعات فرع الفحاحيل؟" as unknown_branch instead of answering with Al-Kout numbers', async () => {
      const res = await askFeryalOdooAgent({
        question: 'كم مبيعات فرع الفحاحيل؟',
        referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
        dataSource: createDialectTestDataSource(),
      })
      expect(res.status).toBe('no_odoo_data')
      expect(res.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY)).toBe(true)
      expect(res.reply).not.toContain('الكوت')
      expect(res.reply).not.toContain('549.3')
      expect(res.verifier.extractedNumbers).toEqual([])
    })
  })

  describe('Prompt B.4 — Talabat & Keeta channel detection + «دفعات» payment count label', () => {
    it('answers Keeta and combined Talabat (TGO+TMP) at Al-Kout with exact summed amounts and «دفعات» label', async () => {
      const ds = createDialectTestDataSource()

      const keetaRes = await askFeryalOdooAgent({
        question: 'كم مبيعات كيتا بالكوت امبارح؟',
        referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
        dataSource: ds,
      })
      expect(keetaRes.status).toBe('answered')
      expect(keetaRes.verifier.valid).toBe(true)
      expect(keetaRes.period).toEqual({ from: '2026-11-16', to: '2026-11-16' })
      expect(keetaRes.reply).toContain('كيتا')
      expect(keetaRes.reply).toContain('الكوت')
      expect(keetaRes.reply).toContain('114.6 د.ك')
      expect(keetaRes.reply).toContain('24 دفعات')
      expect(keetaRes.reply).not.toContain('24 طلبات')

      // Talabat combined at Al-Kout: TGO (162.3, 31) + TMP (78.2, 15) = 240.5 KWD, 46 دفعات
      const talabatRes = await askFeryalOdooAgent({
        question: 'كم مبيعات طلبات بالكوت امس؟',
        referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
        dataSource: ds,
      })
      expect(talabatRes.status).toBe('answered')
      expect(talabatRes.verifier.valid).toBe(true)
      expect(talabatRes.period).toEqual({ from: '2026-11-16', to: '2026-11-16' })
      expect(talabatRes.reply).toContain('الكوت')
      expect(talabatRes.reply).toContain('240.5 د.ك')
      expect(talabatRes.reply).toContain('46 دفعات')
      expect(talabatRes.reply).not.toContain('46 طلبات')
    })

    it('maps TGO -> talabat-tgo, TMP/ماركت -> talabat-tmp, plain Talabat -> talabat, and ignores generic order-count questions', () => {
      expect(detectTargetChannelFromQuestion('كم مبيعات طلبات TGO بالكوت؟').channelId).toBe('talabat-tgo')
      expect(detectTargetChannelFromQuestion('كم مبيعات تي جي او اليوم؟').channelId).toBe('talabat-tgo')
      expect(detectTargetChannelFromQuestion('كم مبيعات طلبات TMP بالكوت؟').channelId).toBe('talabat-tmp')
      expect(detectTargetChannelFromQuestion('كم مبيعات طلبات ماركت امبارح؟').channelId).toBe('talabat-tmp')
      expect(detectTargetChannelFromQuestion('كم بعنا على منصة طلبات امبارح؟').channelId).toBe('talabat')
      expect(detectTargetChannelFromQuestion('how much Talabat sales yesterday?').channelId).toBe('talabat')
      // Generic order-count questions must NOT match Talabat
      expect(detectTargetChannelFromQuestion('كم صافي المبيعات وعدد الطلبات؟').channelId).toBeNull()
      expect(detectTargetChannelFromQuestion('كم مبيعات وطلبات أمس؟').channelId).toBeNull()
    })
  })

  describe('Prompt B.5 — Top product singular & dialect questions route to pos_order_lines', () => {
    const TOP_PRODUCT_QUESTIONS = [
      'شو أكثر صنف انباع امس؟',
      'شنو أكثر منتج مبيعاً امبارح؟',
      'ما هو أعلى صنف اليوم؟',
      'what was the best seller yesterday?',
      'what is our top product this month?',
    ]

    it.each(TOP_PRODUCT_QUESTIONS)(
      'routes "%s" to pos.order.line topProducts and never the branch sales table',
      async (question) => {
        const res = await askFeryalOdooAgent({
          question,
          referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
          dataSource: createDialectTestDataSource(),
        })
        expect(res.status).toBe('answered')
        expect(res.verifier.valid).toBe(true)
        expect(res.executedQueries[0]?.model).toBe('pos.order.line')
        expect(res.reply).toContain('دجاج سويت آند ساور')
        expect(res.reply).toContain('412.5 د.ك')
        expect(res.reply).not.toContain('توزعت المبيعات حسب الفرع')
      },
    )
  })

  describe('Prompt B.6 — Weakest / lowest branch headlines LOWEST restaurant branch with canteens separate', () => {
    const LOWEST_BRANCH_QUESTIONS = [
      'شو أضعف فرع هالشهر؟',
      'ما أقل فرع بالمبيعات هالشهر؟',
      'مين أسوأ فرع هالشهر؟',
      'which branch had the lowest sales this month?',
      'worst branch this month',
    ]

    it.each(LOWEST_BRANCH_QUESTIONS)(
      'headlines Assima (427.9 KWD, lowest restaurant) for "%s" and lists school canteens (264.4 KWD) separately',
      async (question) => {
        const res = await askFeryalOdooAgent({
          question,
          referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
          dataSource: createDialectTestDataSource(),
        })
        expect(res.status).toBe('answered')
        expect(res.verifier.valid).toBe(true)
        expect(res.period).toEqual({ from: '2026-11-01', to: '2026-11-17' })

        const firstLine = res.reply.split('\n')[0] ?? ''
        // Must headline Assima (lowest restaurant: 427.9), NOT 360 Mall (top) and NOT school canteens (264.4)
        expect(firstLine).toContain('فرع العاصمة')
        expect(firstLine).toContain('427.9 د.ك')
        expect(firstLine).not.toContain('تصدر فرع مول 360')
        expect(firstLine).not.toContain('سجل فرع مقاصف المدارس أقل')
        // Canteens are still listed separately for full transparency
        expect(res.reply).toContain('مقاصف المدارس')
        expect(res.reply).toContain('264.4 د.ك')
      },
    )
  })

  describe('Prompt B.7 — Two-period comparisons & partial-today same-hours cutoff', () => {
    it('parses «قارن اليوم مع امبارح/امس», «هالاسبوع مع الاسبوع الماضي», and «هالشهر مع الشهر الماضي» into two periods', () => {
      const dayComp = resolveFeryalComparisonPeriods(
        'قارن مبيعات اليوم مع امبارح',
        KUWAIT_NOV_17_2026_1430_MS,
      )
      expect(dayComp).not.toBeNull()
      expect(dayComp?.periodA).toMatchObject({ from: '2026-11-17', to: '2026-11-17' })
      expect(dayComp?.periodB).toMatchObject({ from: '2026-11-16', to: '2026-11-16' })

      const weekComp = resolveFeryalComparisonPeriods(
        'هالاسبوع مع الاسبوع الماضي',
        KUWAIT_NOV_17_2026_1430_MS,
      )
      expect(weekComp).not.toBeNull()
      expect(weekComp?.periodA).toMatchObject({ from: '2026-11-11', to: '2026-11-17' })
      expect(weekComp?.periodB).toMatchObject({ from: '2026-11-04', to: '2026-11-10' })

      const monthComp = resolveFeryalComparisonPeriods(
        'هالشهر مع الشهر الماضي',
        KUWAIT_NOV_17_2026_1430_MS,
      )
      expect(monthComp).not.toBeNull()
      expect(monthComp?.periodA).toMatchObject({ from: '2026-11-01', to: '2026-11-17' })
      expect(monthComp?.periodB).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
    })

    it('compares same hours (<= 14:30 Kuwait) when one side is partial today instead of silently comparing against full 24h yesterday', async () => {
      const res = await askFeryalOdooAgent({
        question: 'قارن مبيعات اليوم مع امبارح',
        referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
        dataSource: createDialectTestDataSource(),
      })

      expect(res.status).toBe('answered')
      expect(res.verifier.valid).toBe(true)
      expect(res.executedQueries).toHaveLength(2)
      // Today up to 14:30 = 1,200.0 KWD (225 orders); Yesterday same hours (<= 14) = 1,000.0 KWD (190 orders), +200.0 KWD (+20.0%)
      // Must NOT compare 1,200.0 against full-day 4,523.5!
      expect(res.reply).toContain('حتى الساعة 14:30')
      expect(res.reply).toContain('1,200.0 د.ك')
      expect(res.reply).toContain('1,000.0 د.ك')
      expect(res.reply).toContain('200.0 د.ك')
      expect(res.reply).not.toContain('4,523.5')
    })

    it('explicitly states «حتى الساعة 14:30» even when hourly buckets are unavailable on a cube', async () => {
      const res = await askFeryalOdooAgent({
        question: 'قارن اليوم مع امس',
        referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
        dataSource: createDialectTestDataSource({ stripHourlySeries: true }),
      })

      expect(res.status).toBe('answered')
      expect(res.verifier.valid).toBe(true)
      expect(res.reply).toContain('حتى الساعة 14:30')
    })
  })

  describe('Prompt A.4 — Receivables honesty in Feryal (unreconciled POS clearing / negative net / >10x gross debits)', () => {
    it('returns finalizeNoData with exact Arabic reason and zero digits on prod receivables shape and each trigger independently', async () => {
      const triggerShapes: { label: string; rec: OdooReceivableClearingSummary }[] = [
        { label: 'prod shape', rec: PROD_UNRECONCILED_RECEIVABLES },
        {
          label: 'posClearingLinesCount > 0 alone',
          rec: {
            readable: true,
            openReceivableKwd: 1500,
            grossPositiveReceivableKwd: 1500,
            openDebitsKwd: 1500,
            unappliedCreditsKwd: 0,
            openLinesCount: 12,
            posClearingLinesCount: 1,
          },
        },
        {
          label: 'openReceivableKwd < 0 alone',
          rec: {
            readable: true,
            openReceivableKwd: -12.4,
            grossPositiveReceivableKwd: 500,
            openDebitsKwd: 500,
            unappliedCreditsKwd: -512.4,
            openLinesCount: 8,
            posClearingLinesCount: 0,
          },
        },
        {
          label: 'openDebitsKwd > 10x grossPositiveReceivableKwd alone',
          rec: {
            readable: true,
            openReceivableKwd: 200,
            grossPositiveReceivableKwd: 200,
            openDebitsKwd: 2001,
            unappliedCreditsKwd: -1801,
            openLinesCount: 40,
            posClearingLinesCount: 0,
          },
        },
      ]

      for (const { label, rec } of triggerShapes) {
        const res = await askFeryalOdooAgent({
          question: 'كم رصيد الذمم المدينة المفتوحة هذا الشهر؟',
          referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
          dataSource: createDialectTestDataSource({ receivables: rec }),
        })
        expect(res.status, label).toBe('no_odoo_data')
        expect(res.reply, label).toContain('قيد المطابقة مع المحاسبة — غير متاح بعد')
        expect(res.verifier.valid, label).toBe(true)
        expect(res.verifier.extractedNumbers, label).toEqual([])
        expect(res.reply, label).not.toContain('77,462')
        expect(res.reply, label).not.toContain('3,822,787')
      }

      // Clean reconciled receivables still answer accurately
      const cleanRes = await askFeryalOdooAgent({
        question: 'كم رصيد الذمم المدينة المفتوحة هذا الشهر؟',
        referenceNowMs: KUWAIT_NOV_17_2026_1430_MS,
        dataSource: createDialectTestDataSource({
          receivables: {
            readable: true,
            openReceivableKwd: 1804.295,
            grossPositiveReceivableKwd: 1804.295,
            openDebitsKwd: 1804.295,
            unappliedCreditsKwd: 0,
            openLinesCount: 19,
            posClearingLinesCount: 0,
          },
        }),
      })
      expect(cleanRes.status).toBe('answered')
      expect(cleanRes.verifier.valid).toBe(true)
      expect(cleanRes.reply).toContain('1,804.3 د.ك')
    })
  })
})
