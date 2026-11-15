import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createExecSessionToken,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_AUDITOR_EMAIL,
  EXEC_SESSION_COOKIE,
} from '@/lib/auth/exec-session'
import {
  askFeryalOdooAgent,
  enforceVerifiedFeryalReply,
  FERYAL_COMPETITOR_REFUSAL,
  FERYAL_INCOMPLETE_GL_WARNING,
  FERYAL_NO_ODOO_DATA_REPLY,
  listFeryalAuditEntries,
  resetFeryalAuditCache,
  resolveFeryalQuestionPeriod,
  verifyFeryalReplyNumbers,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'
import { getFeryalMemorySync, getMacroStrategyCards } from '@/lib/feryal-learning-engine'
import type {
  OdooLivePurchaseSummary,
  OdooLiveWarehouseChainPayload,
  OdooPeriodCube,
} from '@/lib/odoo-live-connector'
import { GET as chatGet, POST as chatPost } from '@/app/api/erp/feryal/chat/route'

const KUWAIT_NOV_15_2026_MS = Date.parse('2026-11-15T09:00:00.000Z') // 12:00 Asia/Kuwait on 2026-11-15

function buildNov14PeriodCube(): OdooPeriodCube {
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
    byBrand: emptyBrands(),
    brandByBranch: {},
    byChannel: emptyChannels(),
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [],
    hourlyByBranch: {},
    topProducts: [
      {
        productId: 101,
        name: 'دجاج سويت آند ساور',
        brandId: 'china-garden',
        netKwd: 412.5,
        qty: 95,
        linesCount: 90,
        avgDiscountPct: 0,
        discountKwd: 0,
      },
      {
        productId: 102,
        name: 'نودلز دجاج سيشوان',
        brandId: 'noodle-bar',
        netKwd: 348.0,
        qty: 87,
        linesCount: 82,
        avgDiscountPct: 0,
        discountKwd: 0,
      },
      {
        productId: 103,
        name: 'ساندويتش فرانكس كلاسيك',
        brandId: 'franks',
        netKwd: 289.4,
        qty: 110,
        linesCount: 102,
        avgDiscountPct: 0,
        discountKwd: 0,
      },
      {
        productId: 104,
        name: 'بوكس شاورما طحينة',
        brandId: 'tahina',
        netKwd: 244.8,
        qty: 68,
        linesCount: 65,
        avgDiscountPct: 0,
        discountKwd: 0,
      },
      {
        productId: 105,
        name: 'كرك زعفران عائلي',
        brandId: 'karak-cafeteria',
        netKwd: 196.2,
        qty: 109,
        linesCount: 98,
        avgDiscountPct: 0,
        discountKwd: 0,
      },
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
      glWarningAr: 'قيود غير مكتملة لهذه الفترة',
    },
  }
}

function buildPurchaseSummaryFixture(): OdooLivePurchaseSummary {
  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-15T08:55:00.000Z',
    isStale24h: false,
    dateRange: { from: '2026-10-17', to: '2026-11-15' },
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

function buildWarehouseSummaryFixture(): OdooLiveWarehouseChainPayload {
  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-15T08:55:00.000Z',
    isStale24h: false,
    dateRange: { from: '2026-10-17', to: '2026-11-15' },
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

function createLiveFixtureDataSource(): FeryalOdooDataSource {
  return {
    fetchPeriodCube: async () => buildNov14PeriodCube(),
    fetchPurchaseOrders: async () => buildPurchaseSummaryFixture(),
    fetchWarehouseChain: async () => buildWarehouseSummaryFixture(),
    fetchReceivablesSummary: async () => ({
      readable: true,
      openReceivableKwd: 12450.8,
      openLinesCount: 19,
      sourceModel: 'account.move.line',
    }),
    fetchBranchTopProducts: async () => buildNov14PeriodCube().topProducts.slice(0, 5),
  }
}

function createDisconnectedDataSource(): FeryalOdooDataSource {
  const cube = buildNov14PeriodCube()
  return {
    fetchPeriodCube: async () => ({ ...cube, connected: false, noData: true }),
    fetchPurchaseOrders: async () => ({
      ...buildPurchaseSummaryFixture(),
      connected: false,
      noData: true,
      byVendor: [],
    }),
    fetchWarehouseChain: async () => ({
      ...buildWarehouseSummaryFixture(),
      connected: false,
      noData: true,
    }),
    fetchReceivablesSummary: async () => null,
    fetchBranchTopProducts: async () => null,
  }
}

describe('Feryal Live Odoo 17 Engine & Numeric Verifier', () => {
  beforeEach(() => {
    resetFeryalAuditCache()
  })

  it('Acceptance #1: answers «مبيعات أمس 14/11 حسب الفرع» with exact 7 branches + غير منسوب لفرع + 4,259.1 total', async () => {
    const res = await askFeryalOdooAgent({
      question: 'مبيعات أمس 14/11 حسب الفرع',
      userSub: 'cfo-test',
      userRole: 'cfo',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createLiveFixtureDataSource(),
    })

    expect(res.status).toBe('answered')
    expect(res.verifier.valid).toBe(true)
    expect(res.verifier.unverifiedNumbers).toEqual([])
    expect(res.executedQueries.some((q) => q.model === 'pos.order')).toBe(true)
    expect(res.period).toEqual({ from: '2026-11-14', to: '2026-11-14' })

    // Exact branch figures + unattributed + total
    expect(res.reply).toContain('مول 360 785.8 د.ك')
    expect(res.reply).toContain('السالمية 582.1 د.ك')
    expect(res.reply).toContain('الكوت 549.3 د.ك')
    expect(res.reply).toContain('العارضية 526.1 د.ك')
    expect(res.reply).toContain('بروميناد 517.9 د.ك')
    expect(res.reply).toContain('الأفنيوز 495.5 د.ك')
    expect(res.reply).toContain('العاصمة 427.9 د.ك')
    expect(res.reply).toContain('4,259.1 د.ك')
    expect(res.reply).toContain('374.5 د.ك')
    expect(res.reply).toContain('غير منسوب لفرع')

    // Mandatory 4-part structure + estimate tag
    expect(res.reply).toContain('• الرقم:')
    expect(res.reply).toContain('• السبب من البيانات:')
    expect(res.reply).toContain('• الإجراء المحدد:')
    expect(res.reply).toContain('تقدير')
  })

  it('Acceptance #2: answers «مبيعات بروميناد يوم 14/11» with 517.9 KWD and 107 orders (never 822)', async () => {
    const res = await askFeryalOdooAgent({
      question: 'مبيعات بروميناد يوم 14/11',
      userSub: 'gm-test',
      userRole: 'gm',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createLiveFixtureDataSource(),
    })

    expect(res.status).toBe('answered')
    expect(res.verifier.valid).toBe(true)
    expect(res.reply).toContain('517.9 د.ك')
    expect(res.reply).toContain('107 طلبات')
    expect(res.reply).not.toContain('822')
  })

  it('Acceptance #3: answers «أعلى 5 أصناف أمس» from pos.order.line or returns no-data when disconnected', async () => {
    const liveRes = await askFeryalOdooAgent({
      question: 'أعلى 5 أصناف أمس',
      userSub: 'ops-test',
      userRole: 'ops',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createLiveFixtureDataSource(),
    })

    expect(liveRes.status).toBe('answered')
    expect(liveRes.executedQueries[0]?.model).toBe('pos.order.line')
    expect(liveRes.verifier.valid).toBe(true)
    expect(liveRes.reply).toContain('دجاج سويت آند ساور')
    expect(liveRes.reply).toContain('412.5 د.ك')
    expect(liveRes.reply).toContain('كرك زعفران عائلي')

    const discRes = await askFeryalOdooAgent({
      question: 'أعلى 5 أصناف أمس',
      userSub: 'ops-test',
      userRole: 'ops',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createDisconnectedDataSource(),
    })
    expect(discRes.status).toBe('no_odoo_data')
    expect(discRes.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY)).toBe(true)
    expect(discRes.reply).toContain('يلزم')
    expect(discRes.verifier.valid).toBe(true)
  })

  it('Acceptance #4: queries purchase.order for «تكلفة مورد معين» and named suppliers', async () => {
    // Literal placeholder «تكلفة مورد معين» queries purchase.order and refuses to invent
    const placeholderRes = await askFeryalOdooAgent({
      question: 'تكلفة مورد معين',
      userSub: 'cfo-test',
      userRole: 'cfo',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createLiveFixtureDataSource(),
    })
    expect(placeholderRes.executedQueries.some((q) => q.model === 'purchase.order')).toBe(true)
    expect(placeholderRes.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY)).toBe(true)
    expect(placeholderRes.reply).toContain('purchase.order')
    expect(placeholderRes.verifier.valid).toBe(true)

    // Unknown vendor not in purchase.order -> explicit refusal + linking suggestion
    const unknownVendorRes = await askFeryalOdooAgent({
      question: 'تكلفة مورد شركة غير مسجلة في النظام',
      userSub: 'cfo-test',
      userRole: 'cfo',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createLiveFixtureDataSource(),
    })
    expect(unknownVendorRes.executedQueries.some((q) => q.model === 'purchase.order')).toBe(true)
    expect(unknownVendorRes.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY)).toBe(true)
    expect(unknownVendorRes.reply).toContain('purchase.order')
    expect(unknownVendorRes.verifier.valid).toBe(true)

    // Existing vendor in purchase.order -> exact 4-part verified cost
    const existingVendorRes = await askFeryalOdooAgent({
      question: 'تكلفة مورد شركة مطاحن الدقيق والمخابز الكويتية',
      userSub: 'cfo-test',
      userRole: 'cfo',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createLiveFixtureDataSource(),
    })
    expect(existingVendorRes.status).toBe('answered')
    expect(existingVendorRes.verifier.valid).toBe(true)
    expect(existingVendorRes.reply).toContain('4,310.2 د.ك')
    expect(existingVendorRes.reply).toContain('9 أوامر شراء')
  })

  it('Acceptance #5: answers «مبيعات منافس» with the sole literal string «لا أعرف»', async () => {
    const res = await askFeryalOdooAgent({
      question: 'مبيعات منافس',
      userSub: 'gm-test',
      userRole: 'gm',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createLiveFixtureDataSource(),
    })

    expect(res.status).toBe('competitor_refusal')
    expect(res.reply).toBe(FERYAL_COMPETITOR_REFUSAL)
    expect(res.reply).toBe('لا أعرف')
    expect(res.executedQueries).toEqual([])
  })

  it('queries account.move.line with incomplete GL warning and stock.move / stock.scrap', async () => {
    const glRes = await askFeryalOdooAgent({
      question: 'صافي الربح والمصروفات في دفتر الأستاذ يوم 14/11',
      userSub: 'cfo-test',
      userRole: 'cfo',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createLiveFixtureDataSource(),
    })
    expect(glRes.status).toBe('answered')
    expect(glRes.executedQueries[0]?.model).toBe('account.move.line')
    expect(glRes.reply).toContain(FERYAL_INCOMPLETE_GL_WARNING)
    expect(glRes.verifier.valid).toBe(true)

    const stockRes = await askFeryalOdooAgent({
      question: 'حركات التحويل المخزني والهدر هذا الشهر',
      userSub: 'ops-test',
      userRole: 'ops',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createLiveFixtureDataSource(),
    })
    expect(stockRes.status).toBe('answered')
    expect(stockRes.executedQueries.some((q) => q.model === 'stock.move')).toBe(true)
    expect(stockRes.executedQueries.some((q) => q.model === 'stock.scrap')).toBe(true)
    expect(stockRes.reply).toContain('5,120.4 د.ك')
    expect(stockRes.reply).toContain('92.6 د.ك')
    expect(stockRes.verifier.valid).toBe(true)
  })

  it('refuses unlinked operational topics (kitchen prep tickets, drivers, reviews) with «لا أملك بيانات من Odoo عن هذا» + clear Odoo linking suggestion', async () => {
    for (const q of [
      'زمن تذاكر تحضير المطبخ اليوم',
      'أداء سائقي التوصيل اليوم',
      'تقييمات العملاء على جوجل',
    ]) {
      const res = await askFeryalOdooAgent({
        question: q,
        referenceNowMs: KUWAIT_NOV_15_2026_MS,
        dataSource: createLiveFixtureDataSource(),
      })
      expect(res.status, q).toBe('no_odoo_data')
      expect(res.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY), q).toBe(true)
      expect(res.reply.length, q).toBeGreaterThan(FERYAL_NO_ODOO_DATA_REPLY.length + 10)
      expect(res.reply, q).toContain('يلزم')
      expect(res.verifier.valid, q).toBe(true)
      expect(res.verifier.extractedNumbers, q).toEqual([])
    }
  })

  it('verifyFeryalReplyNumbers strictly rejects any single unverified number and accepts 100% grounded replies', async () => {
    const okCheck = verifyFeryalReplyNumbers(
      'سجل فرع بروميناد 517.9 د.ك و107 طلبات من إجمالي 4,259.1 د.ك للفترة 2026-11-14.',
      [517.9, 107, 4259.1],
      { allowedDateStrings: ['2026-11-14'] },
    )
    expect(okCheck.valid).toBe(true)
    expect(okCheck.unverifiedNumbers).toEqual([])

    const badHallucination = verifyFeryalReplyNumbers(
      'سجل فرع بروميناد 822 د.ك و107 طلبات.',
      [517.9, 107],
    )
    expect(badHallucination.valid).toBe(false)
    expect(badHallucination.unverifiedNumbers).toEqual([822])

    const badInventedPercent = enforceVerifiedFeryalReply(
      '• الرقم: 517.9 د.ك\n• السبب من البيانات: 107 طلبات\n• الإجراء المحدد: رفع المبيعات 15%\n• الأثر المتوقع (تقدير): تقدير',
      [517.9, 107],
      { requireFourPartStructure: true },
    )
    expect(badInventedPercent.accepted).toBe(false)
    expect(badInventedPercent.verifier.unverifiedNumbers).toEqual([15])

    // Candidate LLM phraser inventing 822 is immediately rejected by askFeryalOdooAgent
    const guardedRes = await askFeryalOdooAgent({
      question: 'مبيعات بروميناد يوم 14/11',
      referenceNowMs: KUWAIT_NOV_15_2026_MS,
      dataSource: createLiveFixtureDataSource(),
      candidatePhraser: async () =>
        '• الرقم: بروميناد 822 د.ك\n• السبب من البيانات: 107 طلبات\n• الإجراء المحدد: متابعة اليوم\n• الأثر المتوقع (تقدير): تقدير',
    })
    expect(guardedRes.auditEntry.llmCandidateRejected).toBe(true)
    expect(guardedRes.reply).toContain('517.9 د.ك')
    expect(guardedRes.reply).not.toContain('822')
  })

  it('persists Audit Log entries and enforces RBAC on /api/erp/feryal/chat', async () => {
    const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')
    const auditorToken = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor')

    // Unauthenticated POST -> 401
    const unauthRes = await chatPost(
      new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'مبيعات منافس' }),
      }),
    )
    expect(unauthRes.status).toBe(401)

    // Auditor POST -> 403
    const auditorPostRes = await chatPost(
      new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${EXEC_SESSION_COOKIE}=${auditorToken}`,
        },
        body: JSON.stringify({ question: 'مبيعات منافس' }),
      }),
    )
    expect(auditorPostRes.status).toBe(403)

    // Admin POST -> 200 and recorded in Audit Log
    const adminPostRes = await chatPost(
      new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
        },
        body: JSON.stringify({ question: 'مبيعات منافس' }),
      }),
    )
    expect(adminPostRes.status).toBe(200)
    const postPayload = (await adminPostRes.json()) as { reply: string }
    expect(postPayload.reply).toBe('لا أعرف')

    const logs = await listFeryalAuditEntries(10)
    expect(logs.length).toBeGreaterThanOrEqual(1)
    expect(logs[0].question).toBe('مبيعات منافس')
    expect(logs[0].finalReply).toBe('لا أعرف')

    // Auditor GET -> 200 with personal email redacted
    const auditorGetRes = await chatGet(
      new NextRequest('https://aetherbi.com/api/erp/feryal/chat?limit=10', {
        method: 'GET',
        headers: {
          cookie: `${EXEC_SESSION_COOKIE}=${auditorToken}`,
        },
      }),
    )
    expect(auditorGetRes.status).toBe(200)
    const getText = await auditorGetRes.text()
    expect(getText).not.toContain('@venturefoodskw.com')
  })

  it('starts Feryal memory completely empty with zero static rules, outcomes, snapshots, or strategy cards', () => {
    const mem = getFeryalMemorySync()
    expect(mem.rules).toEqual([])
    expect(mem.outcomes).toEqual([])
    expect(mem.snapshots).toEqual([])
    expect(getMacroStrategyCards()).toEqual([])

    const p = resolveFeryalQuestionPeriod('مبيعات أمس', KUWAIT_NOV_15_2026_MS)
    expect(p.from).toBe('2026-11-14')
    expect(p.to).toBe('2026-11-14')
  })
})
