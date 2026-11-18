/**
 * Branch benchmark advisor — every branch against its peers on the same completed days.
 *
 * - Basket gap: a branch whose average ticket is well below the peer median over the last 28
 *   completed days (cross-branch; the CFO advisor already covers a branch against its own past).
 * - Peak concentration: how much of the company's sales falls in its three busiest hours — the case
 *   for moving prep and crew to the peak and for shoulder-hour offers.
 *
 * The branch × weekday and branch KPI matrices are exported for the Decision Room heat map.
 */
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { hourShares, peerMedianProfile, weekdayShares } from '../analytics'
import { branchLabel, clamp01, estimate, evidence, median, r1, r3, shiftIso } from '../helpers'
import { completedDailyByBranch, type CompletedDaily } from '../series'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilFinding } from '../types'

export interface BenchmarkInput {
  summary: OdooLiveSummary | null
}

const POS = 'pos.order'
export const BASKET_GAP_PCT = 12
/** Beyond this gap the branch is a different format (kiosk / canteen), not an upsell problem. */
export const FORMAT_DIFFERENCE_PCT = 35
export const BASKET_CLOSE_SHARE = 0.3
export const PEAK_CONCENTRATION_PCT = 40
const WINDOW = 28

export interface BranchKpi {
  branchId: string
  netPerDayKwd: number
  ordersPerDay: number
  aovKwd: number | null
  /** vs the median of the other branches (percent), null when not comparable. */
  aovVsPeersPct: number | null
  netVsPeersPct: number | null
}

/** Last-28-completed-day KPIs per branch with the gap to the peer median. */
export function branchKpis(d: CompletedDaily, windowDays = WINDOW): { from: string; to: string; rows: BranchKpi[] } | null {
  if (d.days.length < windowDays) return null
  const to = d.days[d.days.length - 1]
  const from = shiftIso(to, -(windowDays - 1))
  const days = d.days.filter((x) => x >= from)
  const base = d.branchIds.map((id) => {
    let f = 0
    let o = 0
    for (const day of days) {
      f += d.byDay[day][id]?.netFils ?? 0
      o += d.byDay[day][id]?.orders ?? 0
    }
    return { id, f, o }
  }).filter((r) => r.f > 0)
  const rows = base.map((r) => {
    const peers = base.filter((p) => p.id !== r.id)
    const aov = r.o > 0 ? r.f / r.o / 1000 : null
    const peerAov = median(peers.filter((p) => p.o > 0).map((p) => p.f / p.o / 1000))
    const peerNet = median(peers.map((p) => p.f / days.length / 1000))
    return {
      branchId: r.id,
      netPerDayKwd: r3(r.f / days.length / 1000),
      ordersPerDay: r1(r.o / days.length),
      aovKwd: aov === null ? null : r3(aov),
      aovVsPeersPct: aov !== null && peerAov > 0 ? r1(((aov - peerAov) / peerAov) * 100) : null,
      netVsPeersPct: peerNet > 0 ? r1((r.f / days.length / 1000 / peerNet - 1) * 100) : null,
    }
  })
  return { from, to, rows }
}

export interface WeekdayMatrixRow {
  branchId: string
  /** Index 0 = Sunday. Branch share minus peer-median share, in points. */
  gapPts: number[]
  shares: number[]
}

/** Branch × weekday share of weekly sales vs the peer median (last 8 completed weeks). */
export function weekdayMatrix(d: CompletedDaily): { peer: number[]; rows: WeekdayMatrixRow[] } | null {
  if (d.days.length < 56) return null
  const days = d.days.slice(-56)
  const profiles = d.branchIds.map((id) => ({ id, s: weekdayShares(d, id, days) })).filter((p): p is { id: string; s: number[] } => p.s !== null)
  if (profiles.length < 3) return null
  const peer = peerMedianProfile(profiles.map((p) => p.s))
  return {
    peer: peer.map((v) => r1(v * 100)),
    rows: profiles.map((p) => ({ branchId: p.id, shares: p.s.map((v) => r1(v * 100)), gapPts: p.s.map((v, i) => r1((v - peer[i]) * 100)) })),
  }
}

function basketGapFinding(k: { from: string; to: string; rows: BranchKpi[] }, row: BranchKpi, d: CompletedDaily): CouncilFinding {
  const lbl = branchLabel(row.branchId)
  const peerAov = median(k.rows.filter((r) => r.branchId !== row.branchId && r.aovKwd !== null).map((r) => r.aovKwd as number))
  const gapKwd = peerAov - (row.aovKwd ?? 0)
  const weeklyOrders = row.ordersPerDay * 7
  const weekly = gapKwd * weeklyOrders * BASKET_CLOSE_SHARE
  const period = { from: k.from, to: k.to }
  return {
    fingerprint: `benchmark:basket-gap:${row.branchId}`,
    advisorId: 'benchmark',
    kind: 'basket-gap',
    entities: { branchId: row.branchId },
    titleAr: `متوسط فاتورة ${lbl.ar} أقل من الفروع الأخرى بـ${Math.abs(row.aovVsPeersPct ?? 0).toFixed(1)}%`,
    titleEn: `${lbl.en}'s average ticket is ${Math.abs(row.aovVsPeersPct ?? 0).toFixed(1)}% below the other branches`,
    evidence: [
      evidence({ odooModel: POS, domain: `branch=${row.branchId}, net ÷ orders`, period, value: row.aovKwd ?? 0, unit: 'KWD/order', syncAt: d.syncAt, labelAr: `متوسط فاتورة ${lbl.ar}`, labelEn: `${lbl.en} average ticket` }),
      evidence({ odooModel: POS, domain: 'other branches, median of net ÷ orders', period, value: r3(peerAov), unit: 'KWD/order', syncAt: d.syncAt, labelAr: 'وسيط متوسط الفاتورة لباقي الفروع', labelEn: 'Median average ticket of the other branches' }),
      evidence({ odooModel: POS, domain: `branch=${row.branchId}`, period, value: row.aovVsPeersPct ?? 0, unit: 'pct', syncAt: d.syncAt, labelAr: 'الفارق عن الفروع', labelEn: 'Gap to the branches' }),
      evidence({ odooModel: POS, domain: `branch=${row.branchId}`, period, value: row.ordersPerDay, unit: 'orders', syncAt: d.syncAt, labelAr: 'متوسط الطلبات اليومية', labelEn: 'Average daily orders' }),
    ],
    thresholds: { basketGapPct: BASKET_GAP_PCT, formatDifferencePct: FORMAT_DIFFERENCE_PCT, windowDays: WINDOW, closeSharePct: BASKET_CLOSE_SHARE * 100 },
    rootCause: {
      ar: `نفس العلامات تُباع بفاتورة أصغر في ${lbl.ar}: غالباً أقل بيعاً إضافياً (مشروب، حلى، حجم أكبر)، أو مزيج أصناف أرخص، أو خصومات أكثر. إن كان شكل الفرع مختلفاً (كشك/مقصف) فقارنه بمثيله فقط.`,
      en: `The same brands sell at a smaller ticket at ${lbl.en}: usually less upsell (drink, dessert, size), a cheaper item mix, or more discounts. If the branch format differs (kiosk / canteen), compare it with its own format only.`,
    },
    severity: Math.abs(row.aovVsPeersPct ?? 0) >= 25 ? 'medium' : 'low',
    novelty: clamp01(Math.abs(row.aovVsPeersPct ?? 0) / 40),
    weeklyImpact: estimate(weekly, 'KWD', `${BASKET_CLOSE_SHARE * 100}% × (peer median ticket − branch ticket) × weekly orders`, { peerMedianTicketKwd: r3(peerAov), branchTicketKwd: row.aovKwd ?? 0, weeklyOrders: r1(weeklyOrders), closeShare: BASKET_CLOSE_SHARE }),
    proposals: [
      {
        who: { ar: `مدير فرع ${lbl.ar}`, en: `${lbl.en} manager` },
        what: { ar: 'تدريب الكاشير على عرض واحد ثابت مع كل طلب (مشروب أو حلى أو حجم أكبر) لمدة أسبوعين، مع هدف يومي للفاتورة', en: 'train cashiers on one fixed add-on offer with every order (drink, dessert or larger size) for two weeks, with a daily ticket target' },
        when: { ar: 'بداية الأسبوع القادم', en: 'start of next week' },
        expectedImpact: estimate(weekly, 'KWD', `${BASKET_CLOSE_SHARE * 100}% × (peer median ticket − branch ticket) × weekly orders`, { peerMedianTicketKwd: r3(peerAov), branchTicketKwd: row.aovKwd ?? 0, weeklyOrders: r1(weeklyOrders), closeShare: BASKET_CLOSE_SHARE }),
      },
    ],
  }
}

/**
 * The window the payload's hourly profile covers: the month bucket when the hourly total equals the
 * month total (how the snapshot builds it), else the payload's own date range.
 */
export function hourlyPeriod(summary: OdooLiveSummary, hourlyTotalKwd: number): { from: string; to: string } {
  const month = summary.buckets?.month as { from?: string; to?: string; totals?: { netSalesKwd?: number | null } } | undefined
  const monthNet = month?.totals?.netSalesKwd
  if (month?.from && month?.to && typeof monthNet === 'number' && Math.abs(monthNet - hourlyTotalKwd) < 0.01) {
    const last = summary.latestOperationalDate && summary.latestOperationalDate < month.to ? summary.latestOperationalDate : month.to
    return { from: month.from, to: last }
  }
  const r = summary.dateRange ?? summary.period
  return { from: r?.from ?? '', to: r?.to ?? '' }
}

function peakFinding(series: { hour: number; netKwd: number; orders: number }[], summary: OdooLiveSummary): CouncilFinding | null {
  const shares = hourShares(series)
  if (!shares) return null
  const ranked = shares.map((s, hour) => ({ hour, s })).sort((a, b) => b.s - a.s || a.hour - b.hour)
  const top3 = ranked.slice(0, 3)
  const top3Pct = r1(top3.reduce((s, h) => s + h.s, 0) * 100)
  if (top3Pct < PEAK_CONCENTRATION_PCT) return null
  const totalKwd = series.reduce((s, h) => s + Math.max(0, h.netKwd), 0)
  const hoursTxt = top3.map((h) => `${h.hour}:00`).sort().join('، ')
  const period = hourlyPeriod(summary, totalKwd)
  return {
    fingerprint: `benchmark:peak-concentration:${top3.map((h) => h.hour).sort((a, b) => a - b).join('-')}`,
    advisorId: 'benchmark',
    kind: 'peak-concentration',
    entities: { hour: top3[0].hour },
    titleAr: `${top3Pct.toFixed(1)}% من المبيعات في 3 ساعات فقط (${hoursTxt})`,
    titleEn: `${top3Pct.toFixed(1)}% of sales fall in just 3 hours (${top3.map((h) => `${h.hour}:00`).sort().join(', ')})`,
    evidence: [
      evidence({ odooModel: POS, domain: 'all branches, grouped by Kuwait hour', period, value: top3Pct, unit: 'pct', syncAt: summary.lastSyncAt ?? null, labelAr: 'نصيب أعلى 3 ساعات', labelEn: 'Share of the top 3 hours' }),
      evidence({ odooModel: POS, domain: 'all branches, all hours', period, value: r3(totalKwd), unit: 'KWD', syncAt: summary.lastSyncAt ?? null, labelAr: 'صافي كل الساعات', labelEn: 'Net, all hours' }),
    ],
    thresholds: { peakConcentrationPct: PEAK_CONCENTRATION_PCT },
    rootCause: {
      ar: 'الطلب مركّز جداً: أي بطء في هذه الساعات (طاقم، تحضير، توقف منصة) يخسر حصة كبيرة من اليوم، بينما بقية الساعات طاقة غير مستغلة.',
      en: 'Demand is highly concentrated: a slowdown in these hours (crew, prep, a platform pause) loses a big share of the day, while the other hours are unused capacity.',
    },
    severity: top3Pct >= 55 ? 'medium' : 'low',
    novelty: clamp01((top3Pct - PEAK_CONCENTRATION_PCT) / 30),
    weeklyImpact: null,
    proposals: [
      {
        who: { ar: 'مدير العمليات', en: 'Operations manager' },
        what: { ar: `جدولة أقوى طاقم وتحضير مسبق كامل قبل ${hoursTxt}، ومنع أي توقف للمنصات في هذه الساعات`, en: `schedule the strongest crew and full pre-prep before ${top3.map((h) => `${h.hour}:00`).sort().join(', ')}, and allow no platform pause in those hours` },
        when: { ar: 'من الأسبوع القادم', en: 'from next week' },
        expectedImpact: null,
      },
      {
        who: { ar: 'مدير التسويق', en: 'Marketing manager' },
        what: { ar: 'اختبار عرض للساعات الهادئة (قبل الذروة وبعدها) في فرعين لمدة أسبوعين، وقياس الأثر على مبيعات تلك الساعات', en: 'test a quiet-hour offer (before and after the peak) in two branches for two weeks and measure those hours' },
        when: { ar: 'هذا الشهر', en: 'this month' },
        expectedImpact: null,
      },
    ],
  }
}

export const benchmarkAdvisor: Advisor<BenchmarkInput> = {
  id: 'benchmark',
  domainAr: 'مقارنة الفروع والساعات',
  domainEn: 'Branch & hour benchmark',
  run(input: BenchmarkInput): AdvisorReport {
    const gaps: CouncilDataGap[] = []
    const findings: CouncilFinding[] = []
    const d = completedDailyByBranch(input.summary)
    const k = d ? branchKpis(d) : null
    if (!d || !k) {
      gaps.push({ odooModel: POS, missingAr: `يحتاج قياس الفروع إلى ${WINDOW} يوماً مكتملاً من المبيعات اليومية لكل فرع.`, missingEn: `Branch benchmarking needs ${WINDOW} completed days of per-branch daily sales.`, recordAr: 'مزامنة Odoo (pos.order) لآخر 4 أسابيع على الأقل.', recordEn: 'An Odoo sync (pos.order) covering at least the last 4 weeks.' })
    } else {
      const worst = [...k.rows].filter((r) => r.aovVsPeersPct !== null && r.aovVsPeersPct <= -BASKET_GAP_PCT && r.aovVsPeersPct > -FORMAT_DIFFERENCE_PCT).sort((a, b) => (a.aovVsPeersPct as number) - (b.aovVsPeersPct as number))[0]
      if (worst) findings.push(basketGapFinding(k, worst, d))
    }
    const hourly = input.summary?.hourlySeries ?? null
    const peak = hourly && input.summary ? peakFinding(hourly, input.summary) : null
    if (peak) findings.push(peak)
    if (!hourly) gaps.push({ odooModel: POS, missingAr: 'لا يوجد توزيع ساعي للمبيعات في هذه البيانات.', missingEn: 'No hourly sales profile in this payload.', recordAr: 'مزامنة Odoo تتضمن التجميع الساعي (تلقائية).', recordEn: 'An Odoo sync including the hourly grouping (automatic).' })
    return {
      advisorId: 'benchmark',
      domainAr: this.domainAr,
      domainEn: this.domainEn,
      period: k ? { from: k.from, to: k.to } : null,
      generatedAt: input.summary?.lastSyncAt ?? null,
      status: !d ? 'unavailable' : gaps.length > 0 ? 'partial' : 'ready',
      findings,
      dataGaps: gaps,
    }
  },
}

