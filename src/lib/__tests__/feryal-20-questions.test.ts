import { beforeEach, describe, expect, it } from 'vitest'
import {
  askFeryalOdooAgent,
  enforceVerifiedFeryalReply,
  FERYAL_COMPETITOR_REFUSAL,
  FERYAL_NO_ODOO_DATA_REPLY,
  resetFeryalAuditCache,
  verifyFeryalReplyNumbers,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'
import type {
  OdooLiveHrSummary,
  OdooLivePurchaseSummary,
  OdooLiveWarehouseChainPayload,
  OdooPeriodCube,
} from '@/lib/odoo-live-connector'

const KUWAIT_NOV_15_2026_MS = Date.parse('2026-11-15T09:00:00.000Z') // 12:00 Asia/Kuwait on 2026-11-15

function emptyChannels() {
  return {
    'dine-in': { netKwd: 0, orders: 0 },
    'takeaway-direct': { netKwd: 0, orders: 0 },
    'talabat-tgo': { netKwd: 0, orders: 0 },
    'talabat-tmp': { netKwd: 0, orders: 0 },
    keeta: { netKwd: 0, orders: 0 },
    deliveroo: { netKwd: 0, orders: 0 },
    jahez: { netKwd: 0, orders: 0 },
    snoonu: { netKwd: 0, orders: 0 },
  }
}

function buildDayNov14Cube(): OdooPeriodCube {
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
      orders: 812,
      aovKwd: 5.245,
      mappedBranchesNetKwd: 3884.6,
      mappedBranchesOrders: 738,
      unattributedSalesKwd: 374.5,
      unattributedOrders: 74,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 64.2,
      avgDiscountPct: 1.5,
      discountedLinesCount: 38,
    },
    byBranch: {
      '360-mall': { netKwd: 785.8, orders: 148, aovKwd: 5.309, channels: emptyChannels() },
      salmiya: { netKwd: 582.1, orders: 118, aovKwd: 4.933, channels: emptyChannels() },
      'al-kout': { netKwd: 549.3, orders: 109, aovKwd: 5.039, channels: emptyChannels() },
      ardiya: { netKwd: 526.1, orders: 96, aovKwd: 5.48, channels: emptyChannels() },
      promenade: { netKwd: 517.9, orders: 107, aovKwd: 4.84, channels: emptyChannels() },
      avenues: { netKwd: 495.5, orders: 86, aovKwd: 5.762, channels: emptyChannels() },
      assima: { netKwd: 427.9, orders: 74, aovKwd: 5.782, channels: emptyChannels() },
      'school-canteens': { netKwd: 0, orders: 0, aovKwd: 0, channels: emptyChannels() },
    },
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netKwd: 374.5,
      orders: 74,
      aovKwd: 5.061,
      channels: emptyChannels(),
    },
    byBrand: {
      'china-garden': { netKwd: 1120.4, qty: 260, linesCount: 245, orders: 210, avgDiscountPct: 1.2, discountKwd: 14.0 },
      franks: { netKwd: 845.2, qty: 220, linesCount: 205, orders: 165, avgDiscountPct: 1.1, discountKwd: 10.2 },
      'farm-brown': { netKwd: 790.5, qty: 180, linesCount: 170, orders: 145, avgDiscountPct: 1.5, discountKwd: 12.0 },
      tahina: { netKwd: 640.0, qty: 175, linesCount: 160, orders: 130, avgDiscountPct: 1.4, discountKwd: 9.0 },
      'noodle-bar': { netKwd: 528.0, qty: 132, linesCount: 125, orders: 98, avgDiscountPct: 1.3, discountKwd: 7.0 },
      'karak-cafeteria': { netKwd: 335.0, qty: 210, linesCount: 190, orders: 64, avgDiscountPct: 1.0, discountKwd: 4.0 },
    },
    brandByBranch: {},
    byChannel: emptyChannels(),
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [],
    hourlyByBranch: {},
    topProducts: [
      { productId: 101, name: 'دجاج سويت آند ساور', brandId: 'china-garden', netKwd: 412.5, qty: 95, linesCount: 90, avgDiscountPct: 0, discountKwd: 0 },
      { productId: 102, name: 'نودلز دجاج سيشوان', brandId: 'noodle-bar', netKwd: 348.0, qty: 87, linesCount: 82, avgDiscountPct: 0, discountKwd: 0 },
      { productId: 103, name: 'ساندويتش فرانكس كلاسيك', brandId: 'franks', netKwd: 289.4, qty: 110, linesCount: 102, avgDiscountPct: 0, discountKwd: 0 },
      { productId: 104, name: 'بوكس شاورما طحينة', brandId: 'tahina', netKwd: 244.8, qty: 68, linesCount: 65, avgDiscountPct: 0, discountKwd: 0 },
      { productId: 105, name: 'كرك زعفران عائلي', brandId: 'karak-cafeteria', netKwd: 196.2, qty: 109, linesCount: 98, avgDiscountPct: 0, discountKwd: 0 },
    ],
    accounting: {
      available: true,
      from: '2026-11-14',
      to: '2026-11-14',
      sourceModel: 'account.move.line',
      lineCount: 42,
      income: 4259.1,
      otherIncome: 0,
      totalRevenue: 4259.1,
      cogs: 1420.5,
      expense: 980.2,
      depreciation: 0,
      operatingProfit: 1858.4,
      completeAccrualPosted: false,
      glIncomplete: true,
      glWarningAr: 'دفتر الأستاذ بلا بند مصروف لهذه الفترة',
    },
  }
}

function buildDayNov07Cube(): OdooPeriodCube {
  const base = buildDayNov14Cube()
  return {
    ...base,
    dateRange: { from: '2026-11-07', to: '2026-11-07' },
    totals: {
      ...base.totals,
      netSalesKwd: 3920.0,
      orders: 754,
      aovKwd: 5.199,
      mappedBranchesNetKwd: 3580.0,
      mappedBranchesOrders: 688,
      unattributedSalesKwd: 340.0,
      unattributedOrders: 66,
    },
  }
}

function buildMonthNovCube(): OdooPeriodCube {
  return {
    ...buildDayNov14Cube(),
    dateRange: { from: '2026-11-01', to: '2026-11-15' },
    days: 15,
    totals: {
      netSalesKwd: 61840.0,
      orders: 11680,
      aovKwd: 5.295,
      mappedBranchesNetKwd: 56420.0,
      mappedBranchesOrders: 10640,
      unattributedSalesKwd: 5420.0,
      unattributedOrders: 1040,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 910.4,
      avgDiscountPct: 1.5,
      discountedLinesCount: 520,
    },
    byBrand: {
      'china-garden': { netKwd: 16420.5, qty: 3820, linesCount: 3600, orders: 3100, avgDiscountPct: 1.2, discountKwd: 198.0 },
      franks: { netKwd: 12180.0, qty: 3150, linesCount: 2980, orders: 2420, avgDiscountPct: 1.1, discountKwd: 134.0 },
      'farm-brown': { netKwd: 11350.5, qty: 2590, linesCount: 2440, orders: 2080, avgDiscountPct: 1.5, discountKwd: 170.0 },
      tahina: { netKwd: 9410.0, qty: 2610, linesCount: 2410, orders: 1920, avgDiscountPct: 1.4, discountKwd: 131.0 },
      'noodle-bar': { netKwd: 7640.0, qty: 1910, linesCount: 1800, orders: 1380, avgDiscountPct: 1.3, discountKwd: 99.0 },
      'karak-cafeteria': { netKwd: 4839.0, qty: 3020, linesCount: 2790, orders: 780, avgDiscountPct: 1.0, discountKwd: 48.0 },
    },
    topProducts: [
      { productId: 201, name: 'وجبة تشاينا جاردن العائلية', brandId: 'china-garden', netKwd: 5840.5, qty: 1120, linesCount: 1050, avgDiscountPct: 0, discountKwd: 0 },
      { productId: 202, name: 'بوكس فرانكس ميني سلايدرز', brandId: 'franks', netKwd: 4620.0, qty: 980, linesCount: 920, avgDiscountPct: 0, discountKwd: 0 },
      { productId: 203, name: 'بروستد فارم براون حراق', brandId: 'farm-brown', netKwd: 3980.2, qty: 840, linesCount: 790, avgDiscountPct: 0, discountKwd: 0 },
      { productId: 204, name: 'شاورما طحينة عربي دبل', brandId: 'tahina', netKwd: 3410.8, qty: 910, linesCount: 860, avgDiscountPct: 0, discountKwd: 0 },
      { productId: 205, name: 'نودلز روبيان ترياكي', brandId: 'noodle-bar', netKwd: 2950.4, qty: 670, linesCount: 640, avgDiscountPct: 0, discountKwd: 0 },
    ],
    accounting: {
      available: true,
      from: '2026-11-01',
      to: '2026-11-15',
      sourceModel: 'account.move.line',
      lineCount: 640,
      income: 61840.0,
      otherIncome: 0,
      totalRevenue: 61840.0,
      cogs: 20810.5,
      expense: 24390.0,
      depreciation: 2800.0,
      operatingProfit: 13839.5,
      completeAccrualPosted: true,
      glIncomplete: false,
    },
  }
}

function buildPurchaseFixture(): OdooLivePurchaseSummary {
  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-15T08:55:00.000Z',
    isStale24h: false,
    dateRange: { from: '2026-11-01', to: '2026-11-15' },
    totals: {
      ordersCount: 14,
      linesCount: 39,
      vendorsCount: 2,
      productsCount: 9,
      totalUntaxedKwd: 6840.5,
      totalTaxKwd: 0,
      totalAmountKwd: 6840.5,
    },
    byVendor: [
      {
        partnerId: 501,
        vendorName: 'شركة مطاحن الدقيق والمخابز الكويتية',
        ordersCount: 9,
        linesCount: 24,
        totalUntaxedKwd: 4310.2,
        totalTaxKwd: 0,
        totalAmountKwd: 4310.2,
        latestOrderDate: '2026-11-14',
      },
      {
        partnerId: 502,
        vendorName: 'شركة التوريدات الغذائية المتحدة',
        ordersCount: 5,
        linesCount: 15,
        totalUntaxedKwd: 2530.3,
        totalTaxKwd: 0,
        totalAmountKwd: 2530.3,
        latestOrderDate: '2026-11-13',
      },
    ],
    byProduct: [],
  }
}

function buildWarehouseFixture(): OdooLiveWarehouseChainPayload {
  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-15T08:55:00.000Z',
    isStale24h: false,
    dateRange: { from: '2026-11-01', to: '2026-11-15' },
    quantHasValueField: true,
    totals: {
      currentOnHandQty: 1420,
      currentOnHandValueKwd: 9850.0,
      ckOnHandValueKwd: 6120.0,
      branchesOnHandValueKwd: 3730.0,
      inboundSupplierKwd: 6840.5,
      ckToBranchTransferKwd: 5120.4,
      posConsumptionKwd: 4890.0,
      scrapKwd: 92.6,
      scrapPctOfConsumption: 1.9,
      doneMovesCount: 184,
      scrapOrdersCount: 7,
      quantsCount: 64,
    },
    byBranchOnHand: {},
    dailyMoves: [],
    products: [],
    scraps: [],
  }
}

function buildHrFixture(accessGranted = true): OdooLiveHrSummary {
  if (!accessGranted) {
    return {
      connected: true,
      sourceMode: 'odoo17-live',
      accessGranted: false,
      noData: true,
      messageAr: 'لا تتوفر صلاحية قراءة hr.employee لحساب الربط الحالي في Odoo',
      odooCompanyId: 1,
      lastSyncAt: '2026-11-15T08:55:00.000Z',
      isStale24h: false,
      totals: {
        activeEmployeesCount: 0,
        departmentsCount: 0,
        workLocationsCount: 0,
      },
      byDepartment: [],
      byWorkLocation: [],
    }
  }

  return {
    connected: true,
    sourceMode: 'odoo17-live',
    accessGranted: true,
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-15T08:55:00.000Z',
    isStale24h: false,
    totals: {
      activeEmployeesCount: 48,
      departmentsCount: 4,
      workLocationsCount: 7,
    },
    byDepartment: [
      { departmentId: 10, departmentName: 'العمليات والفروع', employeesCount: 26 },
      { departmentId: 11, departmentName: 'المطبخ المركزي', employeesCount: 12 },
      { departmentId: 12, departmentName: 'المالية والمحاسبة', employeesCount: 6 },
      { departmentId: 13, departmentName: 'المشتريات والمخازن', employeesCount: 4 },
    ],
    byWorkLocation: [
      { locationId: 1, locationName: 'مول 360', employeesCount: 8 },
      { locationId: 2, locationName: 'العارضية', employeesCount: 12 },
    ],
  }
}

function create20QuestionDataSource(options?: { hrAccessGranted?: boolean }): FeryalOdooDataSource {
  const hrAccessGranted = options?.hrAccessGranted ?? true
  return {
    fetchPeriodCube: async (fromIso, toIso) => {
      if (fromIso === '2026-11-07' && toIso === '2026-11-07') {
        return buildDayNov07Cube()
      }
      if (fromIso === '2026-11-14' && toIso === '2026-11-14') {
        return buildDayNov14Cube()
      }
      return buildMonthNovCube()
    },
    fetchPurchaseOrders: async () => buildPurchaseFixture(),
    fetchWarehouseChain: async () => buildWarehouseFixture(),
    fetchReceivablesSummary: async () => ({
      readable: true,
      openReceivableKwd: 12450.8,
      openLinesCount: 19,
      sourceModel: 'account.move.line',
    }),
    fetchBranchTopProducts: async (fromIso, toIso, _branchId, limit) => {
      const cube =
        fromIso === '2026-11-14' && toIso === '2026-11-14'
          ? buildDayNov14Cube()
          : buildMonthNovCube()
      return cube.topProducts.slice(0, limit)
    },
    fetchHrEmployees: async () => buildHrFixture(hrAccessGranted),
  }
}

describe('Feryal 20-Question Comprehensive Odoo 17 Suite (feryal-20-questions)', () => {
  beforeEach(() => {
    resetFeryalAuditCache()
  })

  const TWENTY_QUESTIONS: readonly {
    num: number
    question: string
    expectedStatus: 'answered' | 'no_odoo_data' | 'competitor_refusal'
    expectedModel?: string
    mustContain: readonly string[]
  }[] = [
    {
      num: 1,
      question: 'كم مبيعات أمس 14/11 حسب الفرع؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order',
      mustContain: ['مول 360 785.8 د.ك', 'السالمية 582.1 د.ك', 'الكوت 549.3 د.ك', 'العارضية 526.1 د.ك', 'بروميناد 517.9 د.ك', 'الأفنيوز 495.5 د.ك', 'العاصمة 427.9 د.ك', '4,259.1 د.ك', '374.5 د.ك'],
    },
    {
      num: 2,
      question: 'كم مبيعات فرع مول 360 يوم 14/11؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order',
      mustContain: ['مول 360', '785.8 د.ك', '148 طلبات'],
    },
    {
      num: 3,
      question: 'كم مبيعات فرع السالمية يوم 14/11؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order',
      mustContain: ['السالمية', '582.1 د.ك', '118 طلبات'],
    },
    {
      num: 4,
      question: 'كم مبيعات فرع الكوت يوم 14/11؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order',
      mustContain: ['الكوت', '549.3 د.ك', '109 طلبات'],
    },
    {
      num: 5,
      question: 'كم مبيعات فرع العارضية يوم 14/11؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order',
      mustContain: ['العارضية', '526.1 د.ك', '96 طلبات'],
    },
    {
      num: 6,
      question: 'كم مبيعات فرع بروميناد يوم 14/11؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order',
      mustContain: ['بروميناد', '517.9 د.ك', '107 طلبات'],
    },
    {
      num: 7,
      question: 'كم مبيعات فرع الأفنيوز يوم 14/11؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order',
      mustContain: ['الأفنيوز', '495.5 د.ك', '86 طلبات'],
    },
    {
      num: 8,
      question: 'كم مبيعات فرع العاصمة يوم 14/11؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order',
      mustContain: ['العاصمة', '427.9 د.ك', '74 طلبات'],
    },
    {
      num: 9,
      question: 'قارن مبيعات يوم 14/11 مقابل يوم 07/11',
      expectedStatus: 'answered',
      expectedModel: 'pos.order',
      mustContain: ['4,259.1 د.ك', '3,920.0 د.ك', '339.1 د.ك', '8.7%'],
    },
    {
      num: 10,
      question: 'كم مبيعات هذا الشهر حسب العلامات الست؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order.line',
      mustContain: ['تشاينا جاردن 16,420.5 د.ك', 'فرانكس 12,180.0 د.ك', 'فارم براون 11,350.5 د.ك', 'طحينة 9,410.0 د.ك', 'ذا نودل بار 7,640.0 د.ك', 'كافيتيريا كرك 4,839.0 د.ك', '61,840.0 د.ك'],
    },
    {
      num: 11,
      question: 'ما أعلى 5 أصناف مبيعاً أمس؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order.line',
      mustContain: ['دجاج سويت آند ساور', '412.5 د.ك', 'كرك زعفران عائلي', '196.2 د.ك'],
    },
    {
      num: 12,
      question: 'ما أعلى 5 أصناف مبيعاً هذا الشهر؟',
      expectedStatus: 'answered',
      expectedModel: 'pos.order.line',
      mustContain: ['وجبة تشاينا جاردن العائلية', '5,840.5 د.ك', 'نودلز روبيان ترياكي', '2,950.4 د.ك'],
    },
    {
      num: 13,
      question: 'كم تكلفة المورد شركة مطاحن الدقيق والمخابز الكويتية هذا الشهر؟',
      expectedStatus: 'answered',
      expectedModel: 'purchase.order',
      mustContain: ['شركة مطاحن الدقيق والمخابز الكويتية', '4,310.2 د.ك', '9 أوامر شراء'],
    },
    {
      num: 14,
      question: 'كم إجمالي المشتريات وأعلى الموردين هذا الشهر؟',
      expectedStatus: 'answered',
      expectedModel: 'purchase.order',
      mustContain: ['6,840.5 د.ك', '14 أوامر شراء', 'شركة مطاحن الدقيق والمخابز الكويتية'],
    },
    {
      num: 15,
      question: 'كم صافي الربح والإيرادات والمصروفات في دفتر الأستاذ هذا الشهر؟',
      expectedStatus: 'answered',
      expectedModel: 'account.move.line',
      // Phase 5 · Item 7: November is an open GL month, so Net Profit is withheld (never estimated).
      mustContain: ['61,840.0 د.ك', '48,000.5 د.ك', 'صافي الربح: غير متاح'],
    },
    {
      num: 16,
      question: 'كم رصيد الذمم المدينة المفتوحة هذا الشهر؟',
      expectedStatus: 'answered',
      expectedModel: 'account.move.line',
      mustContain: ['12,450.8', '19 قيد'],
    },
    {
      num: 17,
      question: 'ما حركات المخزن والتالف هذا الشهر؟',
      expectedStatus: 'answered',
      expectedModel: 'stock.move',
      mustContain: ['184 حركة مخزنية', '5,120.4 د.ك', '6,840.5 د.ك', '92.6 د.ك', '7 أوامر إتلاف'],
    },
    {
      num: 18,
      question: 'كم عدد موظفي الشركة حسب الأقسام في الموارد البشرية؟',
      expectedStatus: 'answered',
      expectedModel: 'hr.employee',
      mustContain: ['48 موظف', '4 أقسام', 'العمليات والفروع (26 موظف)'],
    },
    {
      num: 19,
      question: 'ما متوسط زمن التحضير في شاشة المطبخ KDS اليوم؟',
      expectedStatus: 'answered',
      mustContain: ['زمن التحضير غير متاح في Odoo'],
    },
    {
      num: 20,
      question: 'كم مبيعات منافس مطعم نايف أمس؟',
      expectedStatus: 'competitor_refusal',
      mustContain: [FERYAL_COMPETITOR_REFUSAL],
    },
  ]

  it('has exactly 20 distinct acceptance questions and passes 100% numeric & structural verification on all 20', async () => {
    expect(TWENTY_QUESTIONS).toHaveLength(20)
    const uniqueQuestions = new Set(TWENTY_QUESTIONS.map((q) => q.question))
    expect(uniqueQuestions.size).toBe(20)

    const ds = create20QuestionDataSource({ hrAccessGranted: true })

    for (const item of TWENTY_QUESTIONS) {
      const res = await askFeryalOdooAgent({
        question: item.question,
        userSub: 'qa-20-suite',
        userRole: 'gm',
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: ds,
      })

      expect(res.status, `Q${item.num}: ${item.question}`).toBe(item.expectedStatus)
      expect(res.verifier.valid, `Q${item.num} verifier`).toBe(true)
      expect(res.verifier.unverifiedNumbers, `Q${item.num} unverifiedNumbers`).toEqual([])

      if (item.expectedModel) {
        expect(
          res.executedQueries.some((q) => q.model === item.expectedModel),
          `Q${item.num} expected Odoo model ${item.expectedModel}`,
        ).toBe(true)
      }

      for (const snippet of item.mustContain) {
        expect(res.reply, `Q${item.num} missing "${snippet}"`).toContain(snippet)
      }

      if (item.expectedStatus === 'answered') {
        expect(res.reply).toContain('• الرقم:')
        expect(res.reply).toContain('• السبب من البيانات:')
        expect(res.reply).toContain('• الإجراء المحدد:')
        expect(res.reply).toContain('تقدير')
      } else if (item.expectedStatus === 'no_odoo_data') {
        expect(res.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY)).toBe(true)
        expect(res.reply).toContain('يلزم')
        expect(res.verifier.extractedNumbers).toEqual([])
      } else if (item.expectedStatus === 'competitor_refusal') {
        expect(res.reply).toBe('لا أعرف')
        expect(res.executedQueries).toEqual([])
      }
    }
  })

  it('answers unlinked topics from the period cube instead of the blanket no-data refusal', async () => {
    const dsNoHrAccess = create20QuestionDataSource({ hrAccessGranted: false })

    const stillNoData = ['كم عدد الموظفين في الشركة؟', 'كم تكلفة المورد شركة الخليج للتغليف غير المسجلة؟']
    const answeredFromCube = [
      'أين تتبع السائقين الآن؟',
      'ما تقييمات السوشيال للعملاء؟',
      'ما خطة النمو غير المسجلة والموازنة التقديرية؟',
    ]

    for (const question of stillNoData) {
      const res = await askFeryalOdooAgent({
        question,
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: dsNoHrAccess,
      })
      expect(res.status, question).toBe('no_odoo_data')
      expect(res.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY), question).toBe(true)
    }

    const unlinkedCases = answeredFromCube

    for (const question of unlinkedCases) {
      const res = await askFeryalOdooAgent({
        question,
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: dsNoHrAccess,
      })
      expect(res.status, question).toBe('answered')
      expect(res.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY), question).toBe(false)
      expect(res.reply.length, question).toBeGreaterThan(20)
      expect(res.verifier.valid, question).toBe(true)
    }
  })

  it('strictly rejects any hallucinated or invented number across POS, Comparison, Brands, and HR tools', async () => {
    const ds = create20QuestionDataSource({ hrAccessGranted: true })

    // Direct verifier check
    const directCheck = verifyFeryalReplyNumbers(
      '• الرقم: بلغت مبيعات العلامات 61,840.0 د.ك بنمو مخترع 24.71%.',
      [61840.0],
    )
    expect(directCheck.valid).toBe(false)
    expect(directCheck.unverifiedNumbers).toEqual([24.71])

    const enforceCheck = enforceVerifiedFeryalReply(
      '• الرقم: عدد الموظفين 48 موظف ونسبة دوران 14.7%\n• السبب من البيانات: 4 أقسام\n• الإجراء المحدد: مراجعة\n• الأثر المتوقع (تقدير): تقدير',
      [48, 4],
      { requireFourPartStructure: true },
    )
    expect(enforceCheck.accepted).toBe(false)
    expect(enforceCheck.verifier.unverifiedNumbers).toEqual([14.7])

    // Candidate LLM phraser inventing a number is rejected and replaced by exact Odoo truth
    const guardedComparison = await askFeryalOdooAgent({
      question: 'قارن مبيعات يوم 14/11 مقابل يوم 07/11',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: ds,
      candidatePhraser: async () =>
        '• الرقم: مبيعات 14/11 بلغت 9,999.9 د.ك مقابل 3,920.0 د.ك\n• السبب من البيانات: زيادة\n• الإجراء المحدد: متابعة\n• الأثر المتوقع (تقدير): تقدير',
    })
    expect(guardedComparison.status).toBe('answered')
    expect(guardedComparison.auditEntry.llmCandidateRejected).toBe(true)
    expect(guardedComparison.reply).toContain('4,259.1 د.ك')
    expect(guardedComparison.reply).not.toContain('9,999.9')
  })
})
