/**
 * Redo Phase 2 — Item 2.4 (`F6` — Feryal answer quality) & `C8` (`feryal-eval-readonly.mjs` + 22-question eval).
 *
 * HARD OWNER RULES:
 * - ZERO hand-typed KWD values in tests or fixtures. Every KWD expectation is derived
 *   mathematically from the real cached payload (`dashboard-booth-era-live.json` if present,
 *   else `dashboard-today-2026-11-17.json`) and `pos-registry.json` via integer-fils arithmetic.
 * - Auditor permissions stay strictly untouched (`allowAuditor: false` -> HTTP 403 on POST chat).
 */
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { POST as chatPost } from '@/app/api/erp/feryal/chat/route'
import {
  DEFAULT_GLOBAL_FILTERS,
  deriveCustomBucketFromDaily,
} from '@/lib/aether/global-filter-engine'
import {
  createExecSessionToken,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_AUDITOR_EMAIL,
  EXEC_SESSION_COOKIE,
} from '@/lib/auth/exec-session'
import type { AggregatorHourlyCell, AggregatorHourlyMatrix } from '@/lib/council/advisors/delivery'
import { SUGGESTED_SEASON_EVENTS } from '@/lib/council/advisors/seasons'
import { fmtKwd, fromFils, shiftIso, toFils } from '@/lib/council/helpers'
import { runCouncil } from '@/lib/council/runner'
import type { AdvisorReport, CouncilFinding, CouncilSnapshot } from '@/lib/council/types'
import {
  buildFeryalChatRequestPayload,
  detectOdooToolKind,
  detectTargetBranchFromQuestion,
  detectTargetBrandFromQuestion,
  parseFeryalChatHttpResponse,
  resolveFeryalComparisonPeriods,
  resolveFeryalQuestionPeriod,
} from '@/lib/feryal-intent'
import {
  askFeryalOdooAgent,
  resetFeryalAuditCache,
  verifyFeryalReplyNumbers,
  type AskFeryalOdooAgentResult,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'
import { buildAdvisoryBlock, detectAdvisoryTopics } from '@/lib/feryal/advisor-synthesis'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import posRegistry from '@/lib/odoo/pos-registry.json'
import { runFeryalCouncil } from '@/server/ai/council'
import { loadLiveTodaySummary, realHrInput, realInventoryInput } from '../council/support'

const FIXTURES_DIR = path.resolve(import.meta.dirname, '../fixtures')
const BOOTH_ERA_PAYLOAD_PATH = path.join(FIXTURES_DIR, 'dashboard-booth-era-live.json')

function loadRealEvalSummary(): OdooLiveSummary {
  if (fs.existsSync(BOOTH_ERA_PAYLOAD_PATH)) {
    const raw = JSON.parse(fs.readFileSync(BOOTH_ERA_PAYLOAD_PATH, 'utf8')) as {
      summary?: OdooLiveSummary
    } & OdooLiveSummary
    return raw.summary ?? raw
  }
  return loadLiveTodaySummary()
}

const CHANNEL_KEYS = [
  'dine-in',
  'takeaway-direct',
  'talabat-tgo',
  'talabat-tmp',
  'keeta',
  'deliveroo',
  'jahez',
  'snoonu',
] as const

function emptyChannelMap(): Record<string, { netKwd: number; orders: number }> {
  return Object.fromEntries(CHANNEL_KEYS.map((k) => [k, { netKwd: 0, orders: 0 }]))
}

/**
 * Builds an offline `OdooPeriodCube` strictly from the real cached `OdooLiveSummary`
 * using the shared `deriveCustomBucketFromDaily` bucket resolver (zero invented numbers).
 */
function buildRealSummaryCube(
  summary: OdooLiveSummary,
  fromIso: string,
  toIso: string,
): OdooPeriodCube | null {
  const bkt = deriveCustomBucketFromDaily(summary, fromIso, toIso)
  if (!bkt || bkt.totals.netSalesKwd === null || bkt.totals.orders === null) return null

  const todayFrom = summary.buckets?.today?.from ?? summary.dateRange?.from ?? null
  const isExactToday = fromIso === toIso && todayFrom === fromIso && Boolean(summary.buckets?.today)
  const todayBkt = isExactToday ? summary.buckets?.today : undefined

  const byBranch: Record<string, OdooPeriodCube['byBranch']['avenues']> = {}
  for (const [branchId, cell] of Object.entries(bkt.byLocation ?? {})) {
    const orders = Math.round(cell.orders)
    const netFils = toFils(cell.netKwd)
    byBranch[branchId] = {
      netKwd: fromFils(netFils),
      orders,
      aovKwd: orders > 0 ? fromFils(Math.round(netFils / orders)) : 0,
      channels: emptyChannelMap(),
    }
  }

  const byChannel = emptyChannelMap()
  let channelsAvailable = false
  if (todayBkt?.uiChannels) {
    channelsAvailable = true
    for (const key of CHANNEL_KEYS) {
      const ch = todayBkt.uiChannels[key]
      if (ch) {
        byChannel[key] = { netKwd: fromFils(toFils(ch.netKwd)), orders: Math.round(ch.orders) }
      }
    }
  }

  const byBrand: Record<string, OdooPeriodCube['byBrand']['china-garden']> = {}
  if (todayBkt?.byBrand) {
    for (const [brandId, b] of Object.entries(todayBkt.byBrand)) {
      const ordersCount = b.orders === null ? null : Math.round(b.orders)
      byBrand[brandId] = {
        netKwd: fromFils(toFils(b.netKwd)),
        qty: Math.round(b.qty ?? ordersCount ?? 0),
        linesCount: ordersCount ?? 0,
        orders: ordersCount,
        avgDiscountPct: 0,
        discountKwd: 0,
      }
    }
  }

  const unFils = toFils(bkt.unattributedSalesKwd ?? 0)
  const unOrders = Math.round(bkt.unattributedOrders ?? 0)
  const totalFils = toFils(bkt.totals.netSalesKwd)
  const totalOrders = Math.round(bkt.totals.orders)
  const mappedFils = totalFils - unFils
  const mappedOrders = Math.max(0, totalOrders - unOrders)

  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: totalFils === 0 && totalOrders === 0,
    odooCompanyId: summary.odooCompanyId ?? null,
    lastSyncAt: summary.lastSyncAt ?? summary.syncedAt ?? null,
    isStale24h: Boolean(summary.isStale24h),
    dateRange: { from: fromIso, to: toIso },
    days: bkt.days,
    totals: {
      netSalesKwd: fromFils(totalFils),
      orders: totalOrders,
      aovKwd: totalOrders > 0 ? fromFils(Math.round(totalFils / totalOrders)) : 0,
      mappedBranchesNetKwd: fromFils(mappedFils),
      mappedBranchesOrders: mappedOrders,
      unattributedSalesKwd: fromFils(unFils),
      unattributedOrders: unOrders,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 0,
      avgDiscountPct: 0,
      discountedLinesCount: 0,
    },
    byBranch,
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netKwd: fromFils(unFils),
      orders: unOrders,
      aovKwd: unOrders > 0 ? fromFils(Math.round(unFils / unOrders)) : 0,
      channels: emptyChannelMap(),
    },
    byBrand,
    brandByBranch: {},
    byChannel,
    channelsAvailable,
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [],
    hourlyByBranch: {},
    hourlyAvailable: false,
    hourlyByBranchAvailable: false,
    topProducts: [],
  } as unknown as OdooPeriodCube
}

function createOfflineRealDataSource(summary: OdooLiveSummary): FeryalOdooDataSource {
  return {
    fetchPeriodCube: async (fromIso, toIso) => buildRealSummaryCube(summary, fromIso, toIso),
    fetchPurchaseOrders: async () => null,
    fetchWarehouseChain: async () => null,
    fetchReceivablesSummary: async () => summary.aggregatorReceivables ?? null,
    fetchBranchTopProducts: async () => null,
    fetchHrEmployees: async () => null,
    getLastSyncAt: async () => summary.lastSyncAt ?? summary.syncedAt ?? null,
  }
}

export const EVAL_22_QUESTIONS: ReadonlyArray<{
  id: string
  group: 'council-12' | 'dialect-10'
  question: string
}> = [
  // 12 Council Executive Eval Questions
  { id: 'Q1', group: 'council-12', question: 'كم كانت مبيعات أمس؟' },
  { id: 'Q2', group: 'council-12', question: 'شلون كانت العاصمة امبارح؟' },
  { id: 'Q3', group: 'council-12', question: 'أي فرع الأعلى مبيعات أمس؟' },
  { id: 'Q4', group: 'council-12', question: 'شو صاير بالأفنيوز؟ كم بعنا امس' },
  { id: 'Q5', group: 'council-12', question: 'شنو أسوي عشان أرفع المبيعات هالأسبوع؟' },
  { id: 'Q6', group: 'council-12', question: 'ليش العاصمة نازلة؟ هل السبب الطاقم ولا المنصات؟' },
  { id: 'Q7', group: 'council-12', question: 'طلبات توقف عندنا وايد، شنو الحل؟' },
  { id: 'Q8', group: 'council-12', question: 'الأوفر تايم عند الموظفين واجد، شنو تقترحين؟' },
  { id: 'Q9', group: 'council-12', question: 'وين نخسر بالمخزون؟' },
  { id: 'Q10', group: 'council-12', question: 'أيام الرواتب قربت، شلون نتجهز؟' },
  { id: 'Q11', group: 'council-12', question: 'العارضية يوم الجمعة شلون مقارنة بالفروع الثانية؟' },
  { id: 'Q12', group: 'council-12', question: 'كم مبيعات القرين المطبخ المركزي هالشهر؟' },
  // 10 Ported Dialect Questions (Kuwaiti / Gulf / Levantine)
  { id: 'Q13', group: 'dialect-10', question: 'شو كانت مبيعات مبارح؟' },
  { id: 'Q14', group: 'dialect-10', question: 'كم مبيعات كيتا بالكوت امبارح؟' },
  { id: 'Q15', group: 'dialect-10', question: 'كم مبيعات طلبات بالكوت امس؟' },
  { id: 'Q16', group: 'dialect-10', question: 'كم مصاريف فرع الكوت هالشهر؟' },
  { id: 'Q17', group: 'dialect-10', question: 'كم المخزون بالفرع؟' },
  { id: 'Q18', group: 'dialect-10', question: 'كم مبيعات فرع الفحاحيل؟' },
  { id: 'Q19', group: 'dialect-10', question: 'شو أكثر صنف انباع امس؟' },
  { id: 'Q20', group: 'dialect-10', question: 'شو أضعف فرع هالشهر؟' },
  { id: 'Q21', group: 'dialect-10', question: 'قارن مبيعات اليوم مع امبارح' },
  { id: 'Q22', group: 'dialect-10', question: 'طلبات TGO و TMP امبارح' },
]

describe('Phase 2.4 (F6 & C8) — Feryal 22-Question Real-Payload Eval & Answer Quality', () => {
  let summary: OdooLiveSummary
  let syncNowMs: number
  let council: CouncilSnapshot
  const conversationAnswers = new Map<string, AskFeryalOdooAgentResult>()

  beforeAll(async () => {
    summary = loadRealEvalSummary()
    const syncIso = summary.lastSyncAt ?? summary.syncedAt ?? '2026-11-17T03:05:00.000Z'
    syncNowMs = Date.parse(syncIso) + 5 * 60_000
    council = runCouncil({
      cfo: { summary },
      hr: realHrInput(),
      inventory: realInventoryInput(),
      seasons: { summary, events: SUGGESTED_SEASON_EVENTS },
    })

    resetFeryalAuditCache()
    const seenFingerprints = new Set<string>()
    const dataSource = createOfflineRealDataSource(summary)

    for (const item of EVAL_22_QUESTIONS) {
      const res = await askFeryalOdooAgent({
        question: item.question,
        userSub: 'eval-22',
        userRole: 'gm',
        referenceNowMs: syncNowMs,
        dataSource,
        skipAuditLog: true,
        council,
        seenFingerprints,
      })
      conversationAnswers.set(item.id, res)
    }
  })

  beforeEach(() => {
    resetFeryalAuditCache()
  })

  it('eliminates 100% of legacy 4-part filler, 0.000 unattributed clutter, generic connection openers, and unlabelled estimates across all 22 answers', () => {
    expect(conversationAnswers.size).toBe(22)

    for (const item of EVAL_22_QUESTIONS) {
      const res = conversationAnswers.get(item.id)!
      expect(res.reply, `${item.id}: legacy الإجراء المحدد`).not.toContain('• الإجراء المحدد:')
      expect(res.reply, `${item.id}: legacy الأثر المتوقع`).not.toContain('• الأثر المتوقع')
      expect(res.reply, `${item.id}: generic connection opener`).not.toContain('يلزم التحقق من اتصال Odoo')
      expect(res.reply, `${item.id}: generic module opener`).not.toContain(
        'يلزم ربط المصدر التشغيلي المختص بموديولات Odoo المعتمدة',
      )
      expect(res.reply, `${item.id}: zero KWD fake amount`).not.toMatch(/(?:^|[^\d.,])0\.000(?!\d)/)
      expect(res.reply, `${item.id}: zero unattributed filler`).not.toMatch(
        /غير منسوب لفرع بقيمة 0\.0/,
      )

      // Every line mentioning تقدير must carry an explicit numeric value + formula (`تقدير: <val> = <formula>`)
      const estimateLines = res.reply.split('\n').filter((l) => l.includes('تقدير'))
      for (const line of estimateLines) {
        expect(line, `${item.id}: estimate without formula`).toMatch(/تقدير: .+ = .+/)
      }
    }
  })

  it('enforces conversation-wide diversity: every advisor finding appears at most once (<= 1) across all 22 turns', () => {
    const fingerprintCounts = new Map<string, string[]>()
    const observationLineCounts = new Map<string, string[]>()

    for (const item of EVAL_22_QUESTIONS) {
      const res = conversationAnswers.get(item.id)!
      const used = res.usedFingerprints ?? res.advisory?.findings ?? []
      for (const fp of used) {
        fingerprintCounts.set(fp, [...(fingerprintCounts.get(fp) ?? []), item.id])
      }
      for (const line of res.reply.split('\n')) {
        if (line.startsWith('• الملاحظة:')) {
          observationLineCounts.set(line, [...(observationLineCounts.get(line) ?? []), item.id])
        }
      }
    }

    expect(fingerprintCounts.size).toBeGreaterThanOrEqual(4)
    for (const [fp, questionIds] of fingerprintCounts) {
      expect(
        questionIds.length,
        `Finding "${fp}" repeated across turns: ${questionIds.join(', ')}`,
      ).toBeLessThanOrEqual(1)
    }
    for (const [obsLine, questionIds] of observationLineCounts) {
      expect(
        questionIds.length,
        `Observation "${obsLine}" repeated across turns: ${questionIds.join(', ')}`,
      ).toBeLessThanOrEqual(1)
    }
  })

  it('matches the real payload to the exact 3-decimal fils (0.001 KWD) and passes post-synthesis number guard + footer on all 22 answers', () => {
    const syncDay = resolveFeryalQuestionPeriod('اليوم', syncNowMs).from
    const yesterdayIso = shiftIso(syncDay, -1)
    const monthStartIso = `${syncDay.slice(0, 8)}01`

    const yesterdayBkt = deriveCustomBucketFromDaily(summary, yesterdayIso, yesterdayIso)!
    const monthBkt = deriveCustomBucketFromDaily(summary, monthStartIso, syncDay)!
    const todayBkt = deriveCustomBucketFromDaily(summary, syncDay, syncDay)!

    // Q1 & Q13 (yesterday company + branch breakdown, including Levantine «مبارح»)
    for (const qId of ['Q1', 'Q13']) {
      const res = conversationAnswers.get(qId)!
      expect(res.status).toBe('answered')
      expect(res.reply).toContain(`${fmtKwd(yesterdayBkt.totals.netSalesKwd!)} د.ك`)
      for (const [branchId, cell] of Object.entries(yesterdayBkt.byLocation ?? {})) {
        if (toFils(cell.netKwd) > 0) {
          expect(res.reply, `${qId} branch ${branchId}`).toContain(`${fmtKwd(cell.netKwd)} د.ك`)
        }
      }
    }

    // Q2: Assima yesterday to the exact fils
    const q2 = conversationAnswers.get('Q2')!
    const assimaYesterday = yesterdayBkt.byLocation?.assima
    expect(q2.status).toBe('answered')
    expect(q2.reply).toContain(`${fmtKwd(assimaYesterday!.netKwd)} د.ك`)

    // Q3: Top branch yesterday to the exact fils
    const q3 = conversationAnswers.get('Q3')!
    const topYesterday = Object.entries(yesterdayBkt.byLocation ?? {}).sort(
      (a, b) => toFils(b[1].netKwd) - toFils(a[1].netKwd),
    )[0]!
    expect(q3.status).toBe('answered')
    expect(q3.reply).toContain(`${fmtKwd(topYesterday[1].netKwd)} د.ك`)

    // Q4: Avenues yesterday to the exact fils
    const q4 = conversationAnswers.get('Q4')!
    const avenuesYesterday = yesterdayBkt.byLocation?.avenues
    expect(q4.status).toBe('answered')
    expect(q4.reply).toContain(`${fmtKwd(avenuesYesterday!.netKwd)} د.ك`)

    // Q20: Weakest restaurant branch month-to-date to the exact fils
    const q20 = conversationAnswers.get('Q20')!
    const lowestMonthRestaurant = Object.entries(monthBkt.byLocation ?? {})
      .filter(([id]) => id !== 'school-canteens' && id !== 'exhibitions' && id !== 'qurain')
      .sort((a, b) => toFils(a[1].netKwd) - toFils(b[1].netKwd))[0]!
    expect(q20.status).toBe('answered')
    expect(q20.reply).toContain(`${fmtKwd(lowestMonthRestaurant[1].netKwd)} د.ك`)

    // Q21: Today vs Yesterday comparison to the exact fils
    const q21 = conversationAnswers.get('Q21')!
    expect(q21.status).toBe('answered')
    expect(q21.reply).toContain(`${fmtKwd(todayBkt.totals.netSalesKwd!)} د.ك`)
    expect(q21.reply).toContain(`${fmtKwd(yesterdayBkt.totals.netSalesKwd!)} د.ك`)

    // Every single answer (answered AND no_odoo_data) passes verifier and ends with source+period+sync footer
    for (const item of EVAL_22_QUESTIONS) {
      const res = conversationAnswers.get(item.id)!
      expect(res.verifier.valid, `${item.id} verifier failed: ${res.verifier.reason}\n${res.reply}`).toBe(true)
      expect(res.verifier.unverifiedNumbers, `${item.id} unverified numbers`).toEqual([])
      const lastLine = res.reply.trim().split('\n').pop() ?? ''
      expect(lastLine, `${item.id} missing footer`).toMatch(
        /^• المصدر: Odoo 17 · .+ · الفترة: .+ · آخر مزامنة: .+$/,
      )
    }
  })

  it('gives concrete branch/hour/model answers or precise domain dataGaps on Q6, Q7, Q8, Q9, and routes Q10 away from GL', () => {
    const q6 = conversationAnswers.get('Q6')!
    expect(detectAdvisoryTopics(EVAL_22_QUESTIONS[5]!.question)).toEqual(
      expect.arrayContaining(['sales', 'delivery', 'hr']),
    )
    expect(q6.reply).toContain('العاصمة')
    expect(q6.reply).toMatch(/pos\.payment/)
    expect(q6.reply).toMatch(/work_location_id/)

    const q7 = conversationAnswers.get('Q7')!
    expect(q7.reply).toContain('pos.payment')
    // Must NEVER dump unrelated Assima -15.3% CFO finding onto Delivery pause question Q7
    expect(q7.reply).not.toContain('العاصمة تراجعت')

    const q8 = conversationAnswers.get('Q8')!
    expect(q8.reply).toMatch(/hr\.attendance|OOH Section/)
    expect(q8.reply).toMatch(/work_location_id/)
    expect(q8.reply).not.toContain('يلزم منح صلاحية قراءة موديول الموظفين')

    const q9 = conversationAnswers.get('Q9')!
    expect(q9.reply).toContain('مول 360')
    expect(q9.reply).toContain('stock.quant')
    expect(q9.reply).toMatch(/mrp\.bom/)

    const q10 = conversationAnswers.get('Q10')!
    expect(q10.reply).not.toContain('account.move.line')
    expect(q10.reply).not.toContain('قيود اليومية المحاسبية')
    expect(q10.reply).toMatch(/أيام الرواتب|المواسم/)
  })

  it('synthesizes ONE unified root cause and ONE plan citing BOTH advisors evidences when >= 2 advisors flag the same branch OR same hour', () => {
    // Build a 5-week hourly matrix strictly from real dailyByBranch Assima cells (zero hand-typed KWD)
    const daily = summary.dailyByBranch ?? {}
    const sortedDays = Object.keys(daily)
      .filter((d) => d < '2026-11-17')
      .sort()
    const targetDay = sortedDays[sortedDays.length - 1]!
    const historyDays = [1, 2, 3, 4].map((w) => shiftIso(targetDay, -7 * w))
    const pauseHour = 20

    const matrixRows: AggregatorHourlyCell[] = []
    for (const histDay of historyDays) {
      const realDayCell = daily[histDay]?.assima ?? daily[targetDay]!.assima!
      const hourNetFils = Math.max(1, Math.round(toFils(realDayCell.netKwd) / 8))
      const hourOrders = Math.max(1, Math.round(realDayCell.orders / 8))
      matrixRows.push(
        {
          day: histDay,
          hour: pauseHour,
          branchId: 'assima',
          channel: 'dine-in',
          orders: hourOrders,
          netKwd: fromFils(hourNetFils),
        },
        {
          day: histDay,
          hour: pauseHour,
          branchId: 'assima',
          channel: 'talabat-tgo',
          orders: hourOrders,
          netKwd: fromFils(hourNetFils),
        },
      )
    }
    const targetCell = daily[targetDay]!.assima!
    // On targetDay at hour 20: direct dine-in continues, talabat-tgo has 0 payouts (pause!)
    matrixRows.push({
      day: targetDay,
      hour: pauseHour,
      branchId: 'assima',
      channel: 'dine-in',
      orders: Math.max(1, Math.round(targetCell.orders / 8)),
      netKwd: fromFils(Math.max(1, Math.round(toFils(targetCell.netKwd) / 8))),
    })

    const matrix: AggregatorHourlyMatrix = {
      rows: matrixRows,
      period: { from: historyDays[historyDays.length - 1]!, to: targetDay },
      syncAt: summary.lastSyncAt ?? null,
    }

    const crossCouncil = runCouncil({
      cfo: { summary },
      delivery: { matrix, historyWeeks: 4 },
      hr: realHrInput(),
      inventory: realInventoryInput(),
      seasons: { summary, events: SUGGESTED_SEASON_EVENTS },
    })

    // 1. Same-branch cross-domain synthesis (Q6: cfo + delivery on Assima, plus HR work_location_id gap)
    const blockBranch = buildAdvisoryBlock(
      {
        question: 'ليش العاصمة نازلة؟ هل السبب الطاقم ولا المنصات؟',
        branchId: 'assima',
        council: crossCouncil,
      },
      (t, allowed, opts) => verifyFeryalReplyNumbers(t, allowed, opts),
    )
    expect(blockBranch).not.toBeNull()
    expect(blockBranch!.advisors).toEqual(expect.arrayContaining(['cfo', 'delivery']))
    // Cites BOTH pos.order (CFO) and pos.payment (Delivery) evidences
    expect(blockBranch!.text).toContain('pos.order')
    expect(blockBranch!.text).toContain('pos.payment')
    // Single unified root-cause bullet (no separate duplicate root cause)
    expect(blockBranch!.text.split('\n').filter((l) => l.startsWith('• لماذا:'))).toHaveLength(1)
    expect(blockBranch!.text.split('\n').filter((l) => l.startsWith('• مقترحات:'))).toHaveLength(1)
    // Notes HR dataGap on work_location_id
    expect(blockBranch!.text).toContain('work_location_id')

    // 2. Same-hour cross-domain synthesis (hour 20 flagged by two advisors even across company/branch)
    const cfoFindings = crossCouncil.reports.find((r) => r.advisorId === 'cfo')!.findings
    const delFinding = crossCouncil.reports.find((r) => r.advisorId === 'delivery')!.findings[0]!
    const syntheticSameHourCfo: CouncilFinding = {
      ...cfoFindings[0]!,
      fingerprint: 'cfo:hour-gap:avenues:20',
      kind: 'hour-gap',
      entities: { branchId: 'avenues', hour: pauseHour },
    }
    const hourCouncil: CouncilSnapshot = {
      generatedAt: crossCouncil.generatedAt,
      discoveries: [],
      reports: [
        {
          advisorId: 'cfo',
          domainAr: 'المالية',
          domainEn: 'CFO',
          period: { from: historyDays[3]!, to: targetDay },
          generatedAt: crossCouncil.generatedAt,
          status: 'ready',
          findings: [syntheticSameHourCfo],
          dataGaps: [],
        } satisfies AdvisorReport,
        {
          advisorId: 'delivery',
          domainAr: 'منصات التوصيل',
          domainEn: 'Delivery',
          period: matrix.period,
          generatedAt: crossCouncil.generatedAt,
          status: 'ready',
          findings: [delFinding],
          dataGaps: [],
        } satisfies AdvisorReport,
      ],
    }

    const blockHour = buildAdvisoryBlock(
      {
        question: 'ليش المبيعات والمنصات تضعف في المساء؟',
        council: hourCouncil,
      },
      (t, allowed, opts) => verifyFeryalReplyNumbers(t, allowed, opts),
    )
    expect(blockHour).not.toBeNull()
    expect(blockHour!.advisors).toEqual(expect.arrayContaining(['cfo', 'delivery']))
    expect(blockHour!.text).toContain('pos.order')
    expect(blockHour!.text).toContain('pos.payment')
    expect(blockHour!.text.split('\n').filter((l) => l.startsWith('• لماذا:'))).toHaveLength(1)
  })

  it('includes school-canteens, exhibitions, and qurain (once in payload) in branch lists with zero 0.000 unattributed', async () => {
    const reclassified = structuredClone(summary)
    expect(posRegistry.locations).toHaveProperty('exhibitions')
    expect(posRegistry.locations).toHaveProperty('school-canteens')

    const syncDay = resolveFeryalQuestionPeriod('اليوم', syncNowMs).from
    const yesterdayIso = shiftIso(syncDay, -1)
    const rawUnattr = reclassified.dailyUnattributed?.[yesterdayIso] ?? { netKwd: 0, orders: 0 }
    const halfFils = Math.floor(toFils(rawUnattr.netKwd) / 2)
    const restFils = toFils(rawUnattr.netKwd) - halfFils
    const halfOrd = Math.floor(rawUnattr.orders / 2)
    const restOrd = rawUnattr.orders - halfOrd

    reclassified.dailyByBranch ??= {}
    reclassified.dailyUnattributed ??= {}
    reclassified.dailyByBranch[yesterdayIso] = {
      ...(reclassified.dailyByBranch[yesterdayIso] ?? {}),
      exhibitions: { netKwd: fromFils(halfFils), orders: halfOrd },
      'school-canteens': { netKwd: fromFils(restFils), orders: restOrd },
    }
    reclassified.dailyUnattributed[yesterdayIso] = { netKwd: 0, orders: 0 }

    const res = await askFeryalOdooAgent({
      question: 'كم كانت مبيعات أمس حسب الفرع؟',
      referenceNowMs: syncNowMs,
      dataSource: createOfflineRealDataSource(reclassified),
      skipAuditLog: true,
    })

    expect(res.status).toBe('answered')
    expect(res.verifier.valid).toBe(true)
    expect(res.reply).toContain(`بوثات المعارض ${fmtKwd(fromFils(halfFils))} د.ك`)
    expect(res.reply).toContain(`مقاصف المدارس ${fmtKwd(fromFils(restFils))} د.ك`)
    expect(res.reply).not.toContain('غير منسوب لفرع')
    expect(res.reply).not.toMatch(/(?:^|[^\d.,])0\.000(?!\d)/)

    // Once Qurain is present in a cube's byBranch (after 1.4 Mac audit), Feryal includes it too
    const baseCube = buildRealSummaryCube(reclassified, yesterdayIso, yesterdayIso)!
    const ardiyaCell = baseCube.byBranch.ardiya!
    const qurainCube: OdooPeriodCube = {
      ...baseCube,
      byBranch: {
        ...baseCube.byBranch,
        qurain: { ...ardiyaCell },
      } as unknown as OdooPeriodCube['byBranch'],
      totals: {
        ...baseCube.totals,
        netSalesKwd: fromFils(toFils(baseCube.totals.netSalesKwd) + toFils(ardiyaCell.netKwd)),
        orders: baseCube.totals.orders + ardiyaCell.orders,
      },
    }
    const withQurainRes = await askFeryalOdooAgent({
      question: 'كم كانت مبيعات أمس حسب الفرع؟',
      referenceNowMs: syncNowMs,
      dataSource: {
        ...createOfflineRealDataSource(reclassified),
        fetchPeriodCube: async () => qurainCube,
      },
      skipAuditLog: true,
    })
    expect(withQurainRes.status).toBe('answered')
    expect(withQurainRes.verifier.valid).toBe(true)
    expect(withQurainRes.reply).toContain('القرين (المطبخ المركزي)')
  })

  it('resolves all 8 yesterday dialect forms (including Levantine «مبارح» without leading alef)', () => {
    const syncDay = resolveFeryalQuestionPeriod('اليوم', syncNowMs).from
    const expectedYesterday = shiftIso(syncDay, -1)
    const variants = ['امبارح', 'مبارح', 'إمبارح', 'البارح', 'البارحة', 'أمس', 'امس', 'الامس']

    for (const word of variants) {
      const p = resolveFeryalQuestionPeriod(`كم المبيعات ${word}؟`, syncNowMs)
      expect(p.from, word).toBe(expectedYesterday)
      expect(p.to, word).toBe(expectedYesterday)
      expect(p.hasExplicitPeriod, word).toBe(true)

      const comp = resolveFeryalComparisonPeriods(`قارن اليوم مع ${word}`, syncNowMs)
      expect(comp?.periodA.from, word).toBe(syncDay)
      expect(comp?.periodB.from, word).toBe(expectedYesterday)
    }

    // Q10 salary-window readiness must never route to account_move_lines
    const q10Branch = detectTargetBranchFromQuestion('أيام الرواتب قربت، شلون نتجهز؟')
    const q10Brand = detectTargetBrandFromQuestion('أيام الرواتب قربت، شلون نتجهز؟')
    expect(
      detectOdooToolKind(
        'أيام الرواتب قربت، شلون نتجهز؟',
        q10Branch.branchId,
        q10Brand,
        false,
        q10Branch.isBranchRanking,
      ),
    ).not.toBe('account_move_lines')
  })

  it('connects council + seenFingerprints across runFeryalCouncil, POST /api/erp/feryal/chat, and client payload helpers while keeping auditor 403', async () => {
    const dataSource = createOfflineRealDataSource(summary)

    // Turn 1 via runFeryalCouncil on main chat path
    const turn1 = await runFeryalCouncil(
      {
        question: 'شلون كانت العاصمة امبارح؟',
        userId: 'gm-chat',
        userRole: 'gm',
        referenceNowMs: syncNowMs,
      },
      {
        council,
        keys: { anthropic: '', google: '', xai: '' },
        persist: async () => undefined,
        askOdoo: (agentInput) =>
          askFeryalOdooAgent({
            ...agentInput,
            dataSource,
            skipAuditLog: true,
          }),
      },
    )
    expect(turn1.status).toBe('answered')
    expect(turn1.usedFingerprints?.length).toBeGreaterThan(0)
    expect(turn1.reply).toContain('• الملاحظة:')

    // Turn 2 passing Turn 1's usedFingerprints as seenFingerprints suppresses repeat
    const turn2 = await runFeryalCouncil(
      {
        question: 'ليش العاصمة نازلة؟ هل السبب الطاقم ولا المنصات؟',
        userId: 'gm-chat',
        userRole: 'gm',
        referenceNowMs: syncNowMs,
        seenFingerprints: turn1.usedFingerprints,
      },
      {
        council,
        keys: { anthropic: '', google: '', xai: '' },
        persist: async () => undefined,
        askOdoo: (agentInput) =>
          askFeryalOdooAgent({
            ...agentInput,
            dataSource,
            skipAuditLog: true,
          }),
      },
    )
    for (const fp of turn1.usedFingerprints ?? []) {
      expect(turn2.usedFingerprints ?? []).not.toContain(fp)
    }

    // Client payload + response helpers preserve seenFingerprints / usedFingerprints
    const reqPayload = buildFeryalChatRequestPayload(
      'شلون كانت العاصمة امبارح؟',
      DEFAULT_GLOBAL_FILTERS,
      undefined,
      ['cfo:wow-divergence:assima'],
    )
    expect(reqPayload.seenFingerprints).toEqual(['cfo:wow-divergence:assima'])

    const parsedRes = await parseFeryalChatHttpResponse(
      {
        ok: true,
        json: async () => ({
          ok: true,
          status: 'answered',
          reply: turn1.reply,
          usedFingerprints: turn1.usedFingerprints,
        }),
      },
      true,
    )
    expect(parsedRes.usedFingerprints).toEqual(turn1.usedFingerprints)

    // Auditor POST MUST remain HTTP 403 (allowAuditor: false strictly preserved!)
    const auditorToken = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor')
    const auditorRes = await chatPost(
      new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${EXEC_SESSION_COOKIE}=${auditorToken}`,
        },
        body: JSON.stringify({ question: 'كم كانت مبيعات أمس؟' }),
      }),
    )
    expect(auditorRes.status).toBe(403)

    // Admin POST accepts seenFingerprints and returns usedFingerprints array
    const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')
    const adminRes = await chatPost(
      new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
        },
        body: JSON.stringify({
          question: 'مبيعات منافس',
          seenFingerprints: ['cfo:wow-divergence:assima'],
        }),
      }),
    )
    expect(adminRes.status).toBe(200)
    const adminBody = (await adminRes.json()) as { usedFingerprints?: string[] }
    expect(Array.isArray(adminBody.usedFingerprints)).toBe(true)
  })

  it('provides C8 read-only CLI + docs/redo/feryal-eval.md with all 22 answers, preserves auditor RBAC, and contains zero hand-typed KWD literals', () => {
    const repoRoot = path.resolve(import.meta.dirname, '../../../..')
    const cliPath = path.join(repoRoot, 'scripts/feryal-eval-readonly.mjs')
    const docPath = path.join(repoRoot, 'docs/redo/feryal-eval.md')
    const chatRoutePath = path.join(repoRoot, 'src/app/api/erp/feryal/chat/route.ts')

    expect(fs.existsSync(cliPath)).toBe(true)
    expect(fs.existsSync(docPath)).toBe(true)

    const cliSource = fs.readFileSync(cliPath, 'utf8')
    expect(cliSource).toContain('skipAuditLog: true')

    const docText = fs.readFileSync(docPath, 'utf8')
    for (const q of EVAL_22_QUESTIONS) {
      expect(docText).toContain(`### ${q.id} (`)
      expect(docText).toContain(q.question)
    }
    expect(docText).not.toContain('• الإجراء المحدد:')
    expect(docText).not.toContain('• الأثر المتوقع (تقدير):')
    expect(docText).toContain('allowAuditor: false')

    const routeSource = fs.readFileSync(chatRoutePath, 'utf8')
    expect(routeSource).toContain('export async function POST(req: NextRequest)')
    expect(routeSource).toContain('requireExecApiSession(req, { allowAuditor: false })')

    // Self-audit: zero hand-typed non-zero KWD literals (`<digits>.<digits> د.ك`) in this test file
    const selfSource = fs.readFileSync(path.join(import.meta.dirname, 'feryal-22-eval.test.ts'), 'utf8')
    const nonZeroKwdLiterals = [...selfSource.matchAll(/\b[1-9][\d,]*\.\d+\s*د\.ك/g)].map((m) => m[0])
    expect(nonZeroKwdLiterals).toEqual([])
  })
})
