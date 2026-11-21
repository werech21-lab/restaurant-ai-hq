import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGlobalFilterState } = vi.hoisted(() => ({
  mockGlobalFilterState: {
    current: null as Record<string, unknown> | null,
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/feryal-ai',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('period=today&branch=al-kout'),
  redirect: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname?: string }
    children?: React.ReactNode
    className?: string
  }) =>
    React.createElement(
      'a',
      { href: typeof href === 'string' ? href : href?.pathname ?? '#', ...rest },
      children,
    ),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => mockGlobalFilterState.current,
}))

import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import {
  createExecSessionToken,
  DEFAULT_ADMIN_EMAIL,
  EXEC_SESSION_COOKIE,
} from '@/lib/auth/exec-session'
import {
  askFeryalOdooAgent,
  detectTargetBranchFromQuestion,
  FERYAL_NO_ODOO_DATA_REPLY,
  resetFeryalAuditCache,
  resolveFeryalQuestionPeriod,
  type AskFeryalOdooAgentInput,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { runFeryalCouncil } from '@/server/ai/council'
import { POST as chatPost } from '@/app/api/erp/feryal/chat/route'
import { FeryalGovernanceStudio } from '@/components/erp/feryal-governance-studio'

// 2026-11-17 12:00 Asia/Kuwait (09:00 UTC)
const KUWAIT_NOV_17_2026_MS = Date.parse('2026-11-17T09:00:00.000Z')

const LanguageProviderHost = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithLocale(locale: 'ar' | 'en', element: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(LanguageProviderHost, { initialLocale: locale }, element),
  )
}

function buildPeriodCubeFixture(from = '2026-11-17', to = '2026-11-17'): OdooPeriodCube {
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
    'china-garden': { netKwd: 1120.4, qty: 260, linesCount: 245, orders: 210, avgDiscountPct: 1.2, discountKwd: 14 },
    franks: { netKwd: 845.2, qty: 220, linesCount: 205, orders: 165, avgDiscountPct: 1.1, discountKwd: 10.2 },
    'farm-brown': { netKwd: 790.5, qty: 180, linesCount: 170, orders: 145, avgDiscountPct: 1.5, discountKwd: 12 },
    tahina: { netKwd: 640.0, qty: 175, linesCount: 160, orders: 130, avgDiscountPct: 1.4, discountKwd: 9 },
    'noodle-bar': { netKwd: 528.0, qty: 132, linesCount: 125, orders: 98, avgDiscountPct: 1.3, discountKwd: 7 },
    'karak-cafeteria': { netKwd: 335.0, qty: 210, linesCount: 190, orders: 64, avgDiscountPct: 1.0, discountKwd: 4 },
  })

  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-17T08:55:00.000Z',
    isStale24h: false,
    dateRange: { from, to },
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
      'al-kout': {
        netKwd: 549.3,
        orders: 109,
        aovKwd: 5.039,
        channels: {
          ...emptyChannels(),
          keeta: { netKwd: 58.1, orders: 16 },
        },
      },
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
    byBrand: emptyBrands(),
    brandByBranch: {
      'al-kout': emptyBrands(),
    },
    byChannel: {
      ...emptyChannels(),
      keeta: { netKwd: 215.4, orders: 49 },
    },
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
    ],
  }
}

function createStubDataSource(
  recordedPeriods?: Array<{ from: string; to: string }>,
): FeryalOdooDataSource {
  return {
    fetchPeriodCube: async (fromIso, toIso) => {
      recordedPeriods?.push({ from: fromIso, to: toIso })
      return buildPeriodCubeFixture(fromIso, toIso)
    },
    fetchPurchaseOrders: async () => null,
    fetchWarehouseChain: async () => null,
    fetchReceivablesSummary: async () => null,
    fetchBranchTopProducts: async () => buildPeriodCubeFixture().topProducts,
  }
}

function setStudioFilterState(overrides?: Partial<GlobalFilters>) {
  const filters = {
    ...DEFAULT_GLOBAL_FILTERS,
    period: 'today' as const,
    branch: 'al-kout' as const,
    ...overrides,
  }
  const summary: OdooLiveSummary = {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    lastSyncAt: '2026-11-17T08:55:00.000Z',
    isStale24h: false,
    odooCompanyId: 1,
    dateRange: { from: '2026-11-17', to: '2026-11-17' },
    syncedAt: '2026-11-17T08:55:00.000Z',
    period: { from: '2026-11-17', to: '2026-11-17' },
    database: null,
    totals: { netSalesKwd: 4259.1, orders: 812, aovKwd: 5.245 },
    brands: [],
    branches: [],
    channels: [],
  }
  const workspace = computeGlobalWorkspace(filters, summary, '/erp/feryal-ai')
  mockGlobalFilterState.current = {
    filters,
    workspace,
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
    syncCooldownSec: 0,
    triggerOdooSyncNow: vi.fn(async () => undefined),
    setPeriod: vi.fn(),
    setCustomRange: vi.fn(),
    setKuwaitSlice: vi.fn(),
    setBrand: vi.fn(),
    setBranch: vi.fn(),
    setChannel: vi.fn(),
    setLens: vi.fn(),
    resetFilters: vi.fn(),
    buildShareDeepLinkText: () => '',
  }
}

describe('Bug E — Ask Feryal Routing, Context Defaults, Council Degradation & Studio States', () => {
  beforeEach(() => {
    resetFeryalAuditCache()
    setStudioFilterState()
  })

  describe('1. Table-driven ranking & sales intents resolve to pos_orders with zero unknown_branch', () => {
    const RANKING_QUESTIONS = [
      'أي فرع حقق أعلى مبيعات اليوم؟',
      'مين الفرع اللي باع أكثر اليوم؟',
      'شو أعلى فرع مبيعاً اليوم',
      'أي فرع كان الأعلى مبيعاً مؤخراً؟',
      'أعلى فرع بالمبيعات',
      'which branch had the highest sales today',
      'أكثر فرع مبيعاً اليوم',
      'الفرع الأعلى مبيعاً أخيراً',
      'top branch today',
      'best branch recently',
    ] as const

    it.each(RANKING_QUESTIONS)(
      'routes "%s" to pos.order with answered status, valid verifier, and no unknown_branch',
      async (question) => {
        const detection = detectTargetBranchFromQuestion(question)
        expect(detection.unknownBranchRequested).toBe(false)
        expect(detection.branchId).toBeNull()

        const res = await askFeryalOdooAgent({
          question,
          referenceNowMs: KUWAIT_NOV_17_2026_MS,
          dataSource: createStubDataSource(),
          skipAuditLog: true,
        })

        expect(res.status).toBe('answered')
        expect(res.verifier.valid).toBe(true)
        expect(res.verifier.unverifiedNumbers).toEqual([])
        expect(res.executedQueries.some((q) => q.model === 'pos.order')).toBe(true)
        expect(res.reply).toContain('مول 360')
        expect(res.reply).toContain('785.8 د.ك')
        expect(res.reply).not.toContain('pos.config')
      },
    )

    it.each([
      {
        phrase: 'فرع السالمية',
        expectedBranchId: 'salmiya',
        expectedUnknown: false,
      },
      {
        phrase: 'فرع القرين',
        expectedBranchId: null,
        expectedUnknown: true,
      },
      {
        phrase: 'فرع المريخ',
        expectedBranchId: null,
        expectedUnknown: true,
      },
      {
        phrase: 'فرع حقق مبيعات اليوم',
        expectedBranchId: null,
        expectedUnknown: false,
      },
      {
        phrase: 'فرع بالمبيعات اليوم',
        expectedBranchId: null,
        expectedUnknown: false,
      },
      {
        phrase: 'فرع مبيعاً اليوم',
        expectedBranchId: null,
        expectedUnknown: false,
      },
      {
        phrase: 'فرع مؤخراً',
        expectedBranchId: null,
        expectedUnknown: false,
      },
      {
        phrase: 'فرع كان الأعلى',
        expectedBranchId: null,
        expectedUnknown: false,
      },
      {
        phrase: 'فرع باع أكثر',
        expectedBranchId: null,
        expectedUnknown: false,
      },
      {
        phrase: 'فرع عمل مبيعات',
        expectedBranchId: null,
        expectedUnknown: false,
      },
      {
        phrase: 'فرع بأعلى مبيعات',
        expectedBranchId: null,
        expectedUnknown: false,
      },
      {
        phrase: 'فرع الأقل مبيعاً',
        expectedBranchId: null,
        expectedUnknown: false,
      },
      {
        phrase: 'فرع أمس',
        expectedBranchId: null,
        expectedUnknown: false,
      },
      {
        phrase: 'branch Mars',
        expectedBranchId: null,
        expectedUnknown: true,
      },
    ])(
      'detectTargetBranchFromQuestion("$phrase") -> branchId=$expectedBranchId, unknown=$expectedUnknown',
      async ({ phrase, expectedBranchId, expectedUnknown }) => {
        const det = detectTargetBranchFromQuestion(phrase)
        expect(det.branchId).toBe(expectedBranchId)
        expect(det.unknownBranchRequested).toBe(expectedUnknown)
      },
    )

    it('answers «فرع القرين» as غير متاح (central kitchen, pending audit) and reports unknown_branch for «فرع المريخ»', async () => {
      const ds = createStubDataSource()
      const qurainPrompt = ['فرع', '\u0627\u0644\u0642\u0631\u064a\u0646'].join(' ')
      const qurainRes = await askFeryalOdooAgent({
        question: `كم مبيعات ${qurainPrompt} اليوم؟`,
        referenceNowMs: KUWAIT_NOV_17_2026_MS,
        dataSource: ds,
        skipAuditLog: true,
      })
      expect(qurainRes.reply).not.toContain('لم يُضَف بعد')
      expect(qurainRes.reply).not.toContain('القرين (المطبخ المركزي)')

      const marsRes = await askFeryalOdooAgent({
        question: 'كم مبيعات فرع المريخ اليوم؟',
        referenceNowMs: KUWAIT_NOV_17_2026_MS,
        dataSource: ds,
        skipAuditLog: true,
      })
      expect(marsRes.status).toBe('no_odoo_data')
      expect(marsRes.reply).toContain('pos.config')
      expect(marsRes.verifier.extractedNumbers).toEqual([])
    })
  })

  describe('2. Context defaults (period, branch, brand, channel) & "مؤخراً / recently" 7-completed-days window', () => {
    it('resolves "مؤخراً", "أخيراً", and "recently" to the last 7 completed days and states that window in the reply', async () => {
      for (const word of ['مؤخراً', 'أخيراً', 'recently']) {
        const resolved = resolveFeryalQuestionPeriod(
          `أي فرع كان الأعلى مبيعاً ${word}؟`,
          KUWAIT_NOV_17_2026_MS,
        )
        expect(resolved.from, word).toBe('2026-11-10')
        expect(resolved.to, word).toBe('2026-11-16')
        expect(resolved.hasExplicitPeriod, word).toBe(true)
      }

      const periods: Array<{ from: string; to: string }> = []
      const res = await askFeryalOdooAgent({
        question: 'أي فرع كان الأعلى مبيعاً مؤخراً؟',
        referenceNowMs: KUWAIT_NOV_17_2026_MS,
        dataSource: createStubDataSource(periods),
        skipAuditLog: true,
      })

      expect(periods).toEqual([{ from: '2026-11-10', to: '2026-11-16' }])
      expect(res.status).toBe('answered')
      expect(res.verifier.valid).toBe(true)
      expect(res.period).toEqual({ from: '2026-11-10', to: '2026-11-16' })
      expect(res.reply).toContain('2026-11-10')
      expect(res.reply).toContain('2026-11-16')
    })

    it('applies branch=al-kout and period=today defaults when the question names none, while explicit question entities win', async () => {
      const periods: Array<{ from: string; to: string }> = []
      const ds = createStubDataSource(periods)

      // No branch or period in question -> defaults branch=al-kout (549.3 KWD, 109 orders) & period=today (2026-11-17)
      const defaulted = await askFeryalOdooAgent({
        question: 'كم صافي المبيعات وعدد الطلبات؟',
        referenceNowMs: KUWAIT_NOV_17_2026_MS,
        dataSource: ds,
        skipAuditLog: true,
        context: { period: 'today', branch: 'al-kout', brand: 'all', channel: 'all' },
      } as AskFeryalOdooAgentInput)

      expect(defaulted.status).toBe('answered')
      expect(defaulted.period).toEqual({ from: '2026-11-17', to: '2026-11-17' })
      expect(defaulted.reply).toContain('الكوت')
      expect(defaulted.reply).toContain('549.3 د.ك')
      expect(defaulted.reply).toContain('109 طلبات')

      // Explicit branch (السالمية) & explicit period (أمس -> 2026-11-16) override defaults (branch=al-kout, period=today)
      const overridden = await askFeryalOdooAgent({
        question: 'كم مبيعات فرع السالمية أمس؟',
        referenceNowMs: KUWAIT_NOV_17_2026_MS,
        dataSource: ds,
        skipAuditLog: true,
        context: { period: 'today', branch: 'al-kout', brand: 'all', channel: 'all' },
      } as AskFeryalOdooAgentInput)

      expect(overridden.status).toBe('answered')
      expect(overridden.period).toEqual({ from: '2026-11-16', to: '2026-11-16' })
      expect(overridden.reply).toContain('السالمية')
      expect(overridden.reply).toContain('582.1 د.ك')

      // Ranking question ("أي فرع حقق أعلى مبيعات اليوم؟") ranks ALL branches even when branch=al-kout default is set
      const rankedWithDefault = await askFeryalOdooAgent({
        question: 'أي فرع حقق أعلى مبيعات اليوم؟',
        referenceNowMs: KUWAIT_NOV_17_2026_MS,
        dataSource: ds,
        skipAuditLog: true,
        context: { period: 'today', branch: 'al-kout', brand: 'all', channel: 'all' },
      } as AskFeryalOdooAgentInput)

      expect(rankedWithDefault.status).toBe('answered')
      expect(rankedWithDefault.reply).toContain('مول 360')
      expect(rankedWithDefault.reply).toContain('785.8 د.ك')
    })

    it('validates {period, branch, brand, channel} in POST /api/erp/feryal/chat and forwards approved defaults through runFeryalCouncil', async () => {
      let capturedInput: AskFeryalOdooAgentInput | null = null
      const councilRes = await runFeryalCouncil(
        {
          question: 'كم صافي المبيعات؟',
          userId: 'gm-1',
          userRole: 'gm',
          referenceNowMs: KUWAIT_NOV_17_2026_MS,
          context: { period: 'today', branch: 'al-kout', brand: 'all', channel: 'all' },
        } as Parameters<typeof runFeryalCouncil>[0],
        {
          keys: { anthropic: '', google: '', xai: '' },
          persist: async () => undefined,
          askOdoo: async (agentInput) => {
            capturedInput = agentInput
            return askFeryalOdooAgent({
              ...agentInput,
              dataSource: createStubDataSource(),
              skipAuditLog: true,
            })
          },
        },
      )

      expect(capturedInput).not.toBeNull()
      expect(councilRes.status).toBe('answered')
      expect(councilRes.period).toEqual({ from: '2026-11-17', to: '2026-11-17' })
      expect(councilRes.reply).toContain('الكوت')
      expect(councilRes.reply).toContain('549.3 د.ك')

      // Route-level validation rejects bogus IDs without crashing
      const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')
      const routeRes = await chatPost(
        new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
          },
          body: JSON.stringify({
            question: 'مبيعات منافس',
            period: 'today',
            branch: 'al-kout',
            brand: 'invalid-brand',
            channel: 'invalid-channel',
          }),
        }),
      )
      expect(routeRes.status).toBe(200)
      const payload = (await routeRes.json()) as { ok: boolean; status: string; reply: string }
      expect(payload.ok).toBe(true)
      expect(payload.status).toBe('competitor_refusal')
    })
  })

  describe('3. Council degradation with zero/insufficient provider keys vs Odoo failure', () => {
    it('returns status="answered" with deterministic verified facts + muted bilingual AI-unavailable note when zero provider keys are injected', async () => {
      let networkCalled = false
      const res = await runFeryalCouncil(
        {
          question: 'أي فرع حقق أعلى مبيعات اليوم؟',
          userId: 'owner-1',
          userRole: 'admin',
          referenceNowMs: KUWAIT_NOV_17_2026_MS,
        },
        {
          keys: { anthropic: '', google: '', xai: '' },
          persist: async () => undefined,
          fetchImpl: async () => {
            networkCalled = true
            throw new Error('must not call network when keys are empty')
          },
          askOdoo: (agentInput) =>
            askFeryalOdooAgent({
              ...agentInput,
              dataSource: createStubDataSource(),
              skipAuditLog: true,
            }),
        },
      )

      expect(networkCalled).toBe(false)
      expect(res.status).toBe('answered')
      expect(res.verifier.valid).toBe(true)
      expect(res.reply).toContain('مول 360')
      expect(res.reply).toContain('785.8 د.ك')
      expect(res.reply).toMatch(/غير متاح/)
      expect(res.reply).toMatch(/unavailable/i)

      // Single configured key + provider HTTP 503 also degrades cleanly to verified Odoo facts with status="answered"
      const oneKeyRes = await runFeryalCouncil(
        {
          question: 'أي فرع حقق أعلى مبيعات اليوم؟',
          userId: 'owner-1',
          userRole: 'admin',
          referenceNowMs: KUWAIT_NOV_17_2026_MS,
        },
        {
          keys: { anthropic: 'test-anthropic-key-0001', google: '', xai: '' },
          persist: async () => undefined,
          fetchImpl: async () => new Response('unavailable', { status: 503 }),
          askOdoo: (agentInput) =>
            askFeryalOdooAgent({
              ...agentInput,
              dataSource: createStubDataSource(),
              skipAuditLog: true,
            }),
        },
      )
      expect(oneKeyRes.status).toBe('answered')
      expect(oneKeyRes.reply).toContain('785.8 د.ك')
      expect(oneKeyRes.reply).toMatch(/unavailable/i)
    })

    it('uses status="council_failed" when Odoo itself throws', async () => {
      const res = await runFeryalCouncil(
        {
          question: 'أي فرع حقق أعلى مبيعات اليوم؟',
          userId: 'owner-1',
          userRole: 'admin',
        },
        {
          keys: { anthropic: '', google: '', xai: '' },
          persist: async () => undefined,
          askOdoo: async () => {
            throw new Error('odoo timeout')
          },
        },
      )

      expect(res.status).toBe('council_failed')
    })
  })

  describe('4. Studio context payload, real connection error states, and quick chips spinner', () => {
    it('renders quick chips enabled when idle and shows a visible in-flight spinner while sending', () => {
      const idleHtml = renderWithLocale(
        'ar',
        React.createElement(FeryalGovernanceStudio, {
          sessionRole: 'admin',
          initialMainTab: 'chat',
        }),
      )
      expect(idleHtml).toContain('مبيعات أمس حسب الفرع')
      expect(idleHtml).not.toContain('data-feryal-inflight-spinner="true"')

      const sendingHtml = renderWithLocale(
        'ar',
        React.createElement(FeryalGovernanceStudio, {
          sessionRole: 'admin',
          initialMainTab: 'chat',
          initialSending: true,
        } as React.ComponentProps<typeof FeryalGovernanceStudio>),
      )
      expect(sendingHtml).toContain('data-feryal-inflight-spinner="true"')
      expect(sendingHtml).toContain('animate-spin')
    })

    it('exposes pure payload & HTTP/network error helpers that never disguise connection errors as no Odoo data', async () => {
      const intentMod = await import('@/lib/feryal-intent')
      const payload = intentMod.buildFeryalChatRequestPayload('أي فرع حقق أعلى مبيعات اليوم؟', {
        ...DEFAULT_GLOBAL_FILTERS,
        period: 'today',
        branch: 'al-kout',
        brand: 'china-garden',
        channel: 'keeta',
      })
      expect(payload).toEqual({
        question: 'أي فرع حقق أعلى مبيعات اليوم؟',
        period: 'today',
        branch: 'al-kout',
        brand: 'china-garden',
        channel: 'keeta',
      })

      const netErrAr = intentMod.buildFeryalConnectionErrorOutcome(true)
      expect(netErrAr.replyText).toContain('تعذّر الاتصال — أعد المحاولة')
      expect(netErrAr.replyText).not.toContain('لا أملك بيانات من Odoo')
      expect(netErrAr.replyStatus).toBe('connection_error')

      const netErrEn = intentMod.buildFeryalConnectionErrorOutcome(false)
      expect(netErrEn.replyText).toBe('تعذّر الاتصال — أعد المحاولة')
      expect(netErrEn.modelBadge).toBe('تعذّر الاتصال')
      expect(netErrEn.replyText).not.toMatch(/[A-Za-z]/)
      expect(netErrEn.modelBadge).not.toMatch(/[A-Za-z]/)
      expect(netErrEn.replyText).not.toContain('لا أملك بيانات من Odoo')
      expect(netErrEn.replyStatus).toBe('connection_error')

      // URL query fallback when GlobalFilterProvider has not hydrated yet
      const urlFallbackPayload = intentMod.buildFeryalChatRequestPayload(
        'كم صافي المبيعات؟',
        DEFAULT_GLOBAL_FILTERS,
        '?period=today&branch=al-kout',
      )
      expect(urlFallbackPayload).toEqual({
        question: 'كم صافي المبيعات؟',
        period: 'today',
        branch: 'al-kout',
        brand: 'all',
        channel: 'all',
      })

      // Non-OK HTTP & malformed JSON never show fake "لا أملك بيانات من Odoo عن هذا"
      const http500 = await intentMod.parseFeryalChatHttpResponse(
        { ok: false, json: async () => ({ ok: false, error: 'COUNCIL_FAILED' }) },
        true,
      )
      expect(http500.replyText).toBe('تعذّر الاتصال — أعد المحاولة')
      expect(http500.replyStatus).toBe('connection_error')

      const badJson = await intentMod.parseFeryalChatHttpResponse(
        {
          ok: true,
          json: async () => {
            throw new SyntaxError('Unexpected token <')
          },
        },
        true,
      )
      expect(badJson.replyText).toBe('تعذّر الاتصال — أعد المحاولة')
      expect(badJson.replyStatus).toBe('connection_error')

      const okTurn = await intentMod.parseFeryalChatHttpResponse(
        {
          ok: true,
          json: async () => ({ ok: true, status: 'answered', reply: '• الرقم: 785.8 د.ك' }),
        },
        true,
      )
      expect(okTurn.replyStatus).toBe('answered')
      expect(okTurn.replyText).toBe('• الرقم: 785.8 د.ك')
    })
  })
})
