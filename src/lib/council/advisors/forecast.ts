/**
 * Forecast & anomalies advisor — per-branch completed daily sales (pos.order) only.
 *
 * - Anomalies: a completed day in the last 7 whose net is far from the branch's own same-weekday
 *   normal (|robust z| ≥ 3 and ≥ 15% away from the median of the last 6 same weekdays).
 * - Forecast: next 7 days per branch and company (seasonal-naive × damped trend), published only
 *   when its own rolling backtest error (MAPE) is at most 35%; the error is always shown with it.
 */
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { FORECAST_WEEKS, backtestForecast, forecastDay, robustZ, sameWeekdayHistory, type BacktestResult } from '../analytics'
import { WEEKDAY_AR, WEEKDAY_EN, branchLabel, clamp01, estimate, evidence, fromFils, median, r1, shiftIso, weekdayOf } from '../helpers'
import { completedDailyByBranch, type CompletedDaily } from '../series'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilFinding } from '../types'

export interface ForecastInput {
  summary: OdooLiveSummary | null
}

const POS = 'pos.order'
export const ANOMALY_Z = 3
export const ANOMALY_MIN_GAP = 0.15
export const MAX_PUBLISHED_MAPE = 35
const MIN_HISTORY_DAYS = 42

export interface ForecastDayPoint {
  day: string
  forecastKwd: number
  /** ± band from the backtest's weighted error. */
  lowKwd: number
  highKwd: number
}

export interface BranchForecast {
  branchId: string | null
  next7: ForecastDayPoint[]
  totalKwd: number
  backtest: BacktestResult
  /** Same 7 weekdays one week earlier (actual), for comparison. */
  lastWeekActualKwd: number
}

/** Forecast for the 7 days after the last completed day; null when history or accuracy is insufficient. */
export function forecastNext7(d: CompletedDaily, branch: string | null): BranchForecast | null {
  if (d.days.length < MIN_HISTORY_DAYS) return null
  const bt = backtestForecast(d, branch)
  if (!bt || bt.mapePct > MAX_PUBLISHED_MAPE) return null
  const last = d.days[d.days.length - 1]
  const origin = shiftIso(last, 1)
  const band = bt.wapePct / 100
  const next7: ForecastDayPoint[] = []
  let lastWeekFils = 0
  for (let k = 0; k < 7; k++) {
    const day = shiftIso(origin, k)
    const f = forecastDay(d, branch, day, origin)
    if (f === null) return null
    next7.push({ day, forecastKwd: fromFils(f), lowKwd: fromFils(Math.round(f * (1 - band))), highKwd: fromFils(Math.round(f * (1 + band))) })
    const prior = shiftIso(day, -7)
    const row = d.byDay[prior]
    if (row) lastWeekFils += branch ? (row[branch]?.netFils ?? 0) : Object.values(row).reduce((s, c) => s + c.netFils, 0)
  }
  const totalFils = next7.reduce((s, p) => s + Math.round(p.forecastKwd * 1000), 0)
  return { branchId: branch, next7, totalKwd: fromFils(totalFils), backtest: bt, lastWeekActualKwd: fromFils(lastWeekFils) }
}

export interface DayAnomaly {
  branchId: string
  day: string
  actualKwd: number
  expectedKwd: number
  z: number
  gapPct: number
}

/** Unusual completed days in the last `lookback` days, by branch, strongest first. */
export function detectAnomalies(d: CompletedDaily, lookback = 7): DayAnomaly[] {
  const out: DayAnomaly[] = []
  const recent = d.days.slice(-lookback)
  for (const branch of d.branchIds) {
    for (const day of recent) {
      const hist = sameWeekdayHistory(d, branch, day, FORECAST_WEEKS)
      if (hist.length < FORECAST_WEEKS - 1) continue
      const expected = median(hist)
      if (expected <= 0) continue
      const actual = d.byDay[day]?.[branch]?.netFils ?? 0
      const z = robustZ(actual, hist)
      if (z === null) continue
      const gap = (actual - expected) / expected
      if (Math.abs(z) >= ANOMALY_Z && Math.abs(gap) >= ANOMALY_MIN_GAP) {
        out.push({ branchId: branch, day, actualKwd: fromFils(actual), expectedKwd: fromFils(expected), z: r1(z), gapPct: r1(gap * 100) })
      }
    }
  }
  return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z) || a.branchId.localeCompare(b.branchId) || a.day.localeCompare(b.day))
}

function anomalyFinding(a: DayAnomaly, d: CompletedDaily): CouncilFinding {
  const lbl = branchLabel(a.branchId)
  const wd = weekdayOf(a.day)
  const drop = a.gapPct < 0
  const gapKwd = Math.abs(a.actualKwd - a.expectedKwd)
  const period = { from: a.day, to: a.day }
  const histPeriod = { from: shiftIso(a.day, -7 * FORECAST_WEEKS), to: shiftIso(a.day, -7) }
  return {
    fingerprint: `forecast:anomaly:${a.branchId}:${a.day}`,
    advisorId: 'forecast',
    kind: drop ? 'anomaly-drop' : 'anomaly-spike',
    entities: { branchId: a.branchId, weekday: wd },
    titleAr: drop
      ? `${lbl.ar}: ${WEEKDAY_AR[wd]} ${a.day} أقل من المعتاد بـ${Math.abs(a.gapPct).toFixed(1)}%`
      : `${lbl.ar}: ${WEEKDAY_AR[wd]} ${a.day} أعلى من المعتاد بـ${a.gapPct.toFixed(1)}%`,
    titleEn: drop
      ? `${lbl.en}: ${WEEKDAY_EN[wd]} ${a.day} was ${Math.abs(a.gapPct).toFixed(1)}% below its normal`
      : `${lbl.en}: ${WEEKDAY_EN[wd]} ${a.day} was ${a.gapPct.toFixed(1)}% above its normal`,
    evidence: [
      evidence({ odooModel: POS, domain: `branch=${a.branchId}, state∈{paid,done,invoiced}`, period, value: a.actualKwd, unit: 'KWD', syncAt: d.syncAt, labelAr: `صافي ${lbl.ar} في ذلك اليوم`, labelEn: `${lbl.en} net that day` }),
      evidence({ odooModel: POS, domain: `branch=${a.branchId}, same weekday, last ${FORECAST_WEEKS} weeks (median)`, period: histPeriod, value: a.expectedKwd, unit: 'KWD', syncAt: d.syncAt, labelAr: `المعتاد لنفس اليوم (وسيط ${FORECAST_WEEKS} أسابيع)`, labelEn: `Normal for that weekday (median of ${FORECAST_WEEKS} weeks)` }),
      evidence({ odooModel: POS, domain: `branch=${a.branchId}`, period, value: a.gapPct, unit: 'pct', syncAt: d.syncAt, labelAr: 'الفارق عن المعتاد', labelEn: 'Gap to normal' }),
    ],
    thresholds: { robustZ: ANOMALY_Z, minGapPct: ANOMALY_MIN_GAP * 100, baselineWeeks: FORECAST_WEEKS },
    rootCause: drop
      ? {
          ar: `انحراف قوي (${Math.abs(a.z).toFixed(1)} انحراف معياري متين) لا يفسّره نمط الأسبوع؛ الأسباب الشائعة: جلسة نقاط بيع لم تُغلق أو لم تُزامن، توقف متجر على منصة توصيل، أو إغلاق/نقص طاقم في ذلك اليوم.`,
          en: `A strong deviation (${Math.abs(a.z).toFixed(1)} robust standard deviations) that the weekly pattern does not explain; usual causes: a POS session not closed or synced, a store paused on a delivery platform, or a closure / crew shortage that day.`,
        }
      : {
          ar: `قفزة قوية (${a.z.toFixed(1)} انحراف معياري متين) فوق نمط الأسبوع؛ إن كان سببها عرضاً أو حدثاً أو طلب شركات فهي قابلة للتكرار.`,
          en: `A strong jump (${a.z.toFixed(1)} robust standard deviations) above the weekly pattern; if an offer, event or corporate order caused it, it can be repeated.`,
        },
    severity: Math.abs(a.z) >= 5 ? 'high' : 'medium',
    novelty: clamp01(Math.abs(a.z) / 8),
    weeklyImpact: drop ? estimate(gapKwd, 'KWD', 'normal − actual (one day)', { normalKwd: a.expectedKwd, actualKwd: a.actualKwd }) : null,
    proposals: drop
      ? [
          {
            who: { ar: `مدير فرع ${lbl.ar} + المحاسب`, en: `${lbl.en} manager + accountant` },
            what: { ar: 'مطابقة جلسات نقاط البيع لذلك اليوم مع إيداع النقد وتقارير المنصات، والتأكد من أن كل الطلبات مُزامنة في Odoo', en: "reconcile that day's POS sessions with the cash deposit and platform reports, and confirm every order is synced to Odoo" },
            when: { ar: 'خلال 24 ساعة', en: 'within 24 hours' },
            expectedImpact: null,
          },
          {
            who: { ar: 'مدير العمليات', en: 'Operations manager' },
            what: { ar: 'تسجيل السبب (إغلاق، توقف منصة، نقص صنف) في سجل الفرع حتى لا يُحتسب كاتجاه', en: 'record the cause (closure, platform pause, item out) in the branch log so it is not read as a trend' },
            when: { ar: 'قبل اجتماع الأسبوع', en: 'before the weekly meeting' },
            expectedImpact: null,
          },
        ]
      : [
          {
            who: { ar: `مدير فرع ${lbl.ar}`, en: `${lbl.en} manager` },
            what: { ar: 'تحديد سبب القفزة (عرض، حدث قريب، طلب جماعي) وتوثيقه؛ إن كان عرضاً، اختباره مرة أخرى في نفس اليوم من الأسبوع', en: 'identify the cause of the jump (offer, nearby event, bulk order) and write it down; if it was an offer, test it again on the same weekday' },
            when: { ar: 'هذا الأسبوع', en: 'this week' },
            expectedImpact: null,
          },
        ],
  }
}

export interface MarketWideDay {
  day: string
  direction: 'drop' | 'spike'
  anomalies: DayAnomaly[]
}

/** Days on which at least `minBranches` branches moved the same way: a market-wide cause, not a local one. */
export function marketWideDays(anoms: readonly DayAnomaly[], minBranches = 3): MarketWideDay[] {
  const byKey = new Map<string, DayAnomaly[]>()
  for (const a of anoms) {
    const key = `${a.day}:${a.gapPct < 0 ? 'drop' : 'spike'}`
    byKey.set(key, [...(byKey.get(key) ?? []), a])
  }
  return [...byKey.entries()]
    .filter(([, list]) => list.length >= minBranches)
    .map(([key, list]) => ({ day: key.split(':')[0], direction: key.endsWith('drop') ? ('drop' as const) : ('spike' as const), anomalies: list }))
    .sort((a, b) => b.anomalies.length - a.anomalies.length || a.day.localeCompare(b.day))
}

function marketWideFinding(m: MarketWideDay, d: CompletedDaily): CouncilFinding {
  const wd = weekdayOf(m.day)
  const actualFils = m.anomalies.reduce((s, a) => s + Math.round(a.actualKwd * 1000), 0)
  const expectedFils = m.anomalies.reduce((s, a) => s + Math.round(a.expectedKwd * 1000), 0)
  const gapPct = expectedFils > 0 ? r1(((actualFils - expectedFils) / expectedFils) * 100) : 0
  const names = m.anomalies.map((a) => branchLabel(a.branchId))
  const drop = m.direction === 'drop'
  const period = { from: m.day, to: m.day }
  return {
    fingerprint: `forecast:market-wide:${m.direction}:${m.day}`,
    advisorId: 'forecast',
    kind: drop ? 'market-wide-drop' : 'market-wide-spike',
    entities: { weekday: wd },
    titleAr: `${WEEKDAY_AR[wd]} ${m.day}: ${m.anomalies.length} فروع ${drop ? 'أقل' : 'أعلى'} من المعتاد معاً (${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}%) — سبب عام وليس محلياً`,
    titleEn: `${WEEKDAY_EN[wd]} ${m.day}: ${m.anomalies.length} branches ${drop ? 'below' : 'above'} normal together (${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}%) — a market-wide cause, not a local one`,
    evidence: [
      evidence({ odooModel: POS, domain: `branches=${m.anomalies.map((a) => a.branchId).join(',')}`, period, value: fromFils(actualFils), unit: 'KWD', syncAt: d.syncAt, labelAr: 'صافي هذه الفروع في ذلك اليوم', labelEn: 'Net of these branches that day' }),
      evidence({ odooModel: POS, domain: `same branches, same weekday, last ${FORECAST_WEEKS} weeks (median each)`, period: { from: shiftIso(m.day, -7 * FORECAST_WEEKS), to: shiftIso(m.day, -7) }, value: fromFils(expectedFils), unit: 'KWD', syncAt: d.syncAt, labelAr: 'المعتاد لهذه الفروع', labelEn: 'Normal for these branches' }),
      evidence({ odooModel: POS, domain: 'these branches', period, value: gapPct, unit: 'pct', syncAt: d.syncAt, labelAr: 'الفارق عن المعتاد', labelEn: 'Gap to normal' }),
      evidence({ odooModel: POS, domain: 'branches flagged the same day', period, value: m.anomalies.length, unit: 'count', syncAt: d.syncAt, labelAr: 'عدد الفروع', labelEn: 'Branches' }),
    ],
    thresholds: { robustZ: ANOMALY_Z, minGapPct: ANOMALY_MIN_GAP * 100, minBranches: 3 },
    rootCause: drop
      ? {
          ar: `${names.map((n) => n.ar).join('، ')} تراجعت في اليوم نفسه، فالسبب على الأرجح خارجي (طقس، عطلة، مناسبة، عطل منصة توصيل) وليس أداء فرع. لا تُحاسَب الفروع على هذا اليوم.`,
          en: `${names.map((n) => n.en).join(', ')} fell on the same day, so the cause is most likely external (weather, holiday, event, delivery-platform outage), not branch performance. Do not judge the branches on this day.`,
        }
      : {
          ar: `${names.map((n) => n.ar).join('، ')} ارتفعت في اليوم نفسه: محرّك عام (مناسبة، راتب، عرض شامل) يمكن الاستعداد له في المرة القادمة.`,
          en: `${names.map((n) => n.en).join(', ')} rose on the same day: a company-wide driver (event, payday, group offer) to prepare for next time.`,
        },
    severity: drop ? 'high' : 'medium',
    novelty: clamp01(m.anomalies.length / 5),
    weeklyImpact: drop ? estimate(fromFils(expectedFils - actualFils), 'KWD', 'Σ normal − Σ actual (one day, flagged branches)', { normalKwd: fromFils(expectedFils), actualKwd: fromFils(actualFils) }) : null,
    proposals: [
      {
        who: { ar: 'المدير العام', en: 'General manager' },
        what: drop
          ? { ar: 'تسمية السبب الخارجي لذلك اليوم وإضافته إلى تقويم المواسم، ووضع خطة طوارئ (عرض توصيل، تقليل التحضير) إن تكرر', en: "name that day's external cause, add it to the seasons calendar, and set a contingency plan (delivery offer, lighter prep) if it recurs" }
          : { ar: 'تسمية المحرّك وإضافته إلى تقويم المواسم مع خطة تحضير وطاقم مسبقة للمرة القادمة', en: 'name the driver and add it to the seasons calendar with a prep and staffing plan for next time' },
        when: { ar: 'هذا الأسبوع', en: 'this week' },
        expectedImpact: null,
      },
    ],
  }
}

function forecastFinding(fc: BranchForecast, d: CompletedDaily, unusualLastWeek = 0): CouncilFinding | null {
  const change = fc.lastWeekActualKwd > 0 ? r1(((fc.totalKwd - fc.lastWeekActualKwd) / fc.lastWeekActualKwd) * 100) : null
  if (change === null) return null
  const period = { from: fc.next7[0].day, to: fc.next7[6].day }
  return {
    fingerprint: `forecast:next7:company:${period.from}`,
    advisorId: 'forecast',
    kind: 'forecast-next7',
    entities: {},
    titleAr: `توقع الأيام السبعة القادمة: ${fc.totalKwd.toFixed(3)} د.ك (${change >= 0 ? '+' : ''}${change.toFixed(1)}% عن نفس الأيام الأسبوع الماضي) — خطأ النموذج ${fc.backtest.mapePct.toFixed(1)}%`,
    titleEn: `Next 7 days forecast: ${fc.totalKwd.toFixed(3)} KWD (${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs the same days last week) — model error ${fc.backtest.mapePct.toFixed(1)}%`,
    evidence: [
      evidence({ odooModel: POS, domain: 'all branches, same weekdays one week earlier', period: { from: shiftIso(period.from, -7), to: shiftIso(period.to, -7) }, value: fc.lastWeekActualKwd, unit: 'KWD', syncAt: d.syncAt, labelAr: 'الفعلي لنفس الأيام الأسبوع الماضي', labelEn: 'Actual, same days last week' }),
      evidence({ odooModel: POS, domain: 'forecast vs same days last week', period, value: change, unit: 'pct', syncAt: d.syncAt, labelAr: 'تغيّر المتوقع عن الأسبوع الماضي', labelEn: 'Forecast change vs last week' }),
      evidence({ odooModel: POS, domain: `rolling backtest, ${fc.backtest.scoredDays} held-out days`, period: { from: d.days[0], to: d.days[d.days.length - 1] }, value: fc.backtest.mapePct, unit: 'pct', syncAt: d.syncAt, labelAr: 'متوسط خطأ النموذج في الاختبار الرجعي (MAPE)', labelEn: 'Model error in the backtest (MAPE)' }),
    ],
    thresholds: { baselineWeeks: FORECAST_WEEKS, maxPublishedMapePct: MAX_PUBLISHED_MAPE, ...(unusualLastWeek > 0 ? { unusualBranchDaysLastWeek: unusualLastWeek } : {}) },
    rootCause: {
      ar: `التوقع = وسيط آخر 6 أيام مماثلة من الأسبوع × اتجاه آخر 28 يوماً (مُخمَّد ومحدود). لا يعرف النموذج العروض أو المناسبات القادمة؛ أضفها يدوياً.${unusualLastWeek > 0 ? ` الأسبوع الماضي فيه ${unusualLastWeek} أيام-فروع غير معتادة، لذا المقارنة به تضخّم التغيّر.` : ''}`,
      en: `Forecast = median of the last 6 same weekdays × the last-28-day trend (damped and capped). The model does not know upcoming offers or events; add those by hand.${unusualLastWeek > 0 ? ` Last week had ${unusualLastWeek} unusual branch-days, so the comparison with it overstates the change.` : ''}`,
    },
    severity: 'low',
    novelty: clamp01(Math.abs(change) / 30),
    weeklyImpact: null,
    proposals: [
      {
        who: { ar: 'المطبخ المركزي والمشتريات', en: 'Central kitchen and purchasing' },
        what: { ar: `بناء خطة التحضير والطلب على ${fc.totalKwd.toFixed(3)} د.ك مبيعات متوقعة مع هامش ±${fc.backtest.wapePct.toFixed(1)}%`, en: `plan prep and purchasing for ${fc.totalKwd.toFixed(3)} KWD expected sales with a ±${fc.backtest.wapePct.toFixed(1)}% margin` },
        when: { ar: 'قبل بداية الأسبوع', en: 'before the week starts' },
        expectedImpact: estimate(fc.totalKwd, 'KWD', 'Σ next-7-day forecast', { lastWeekActualKwd: fc.lastWeekActualKwd, mapePct: fc.backtest.mapePct, wapePct: fc.backtest.wapePct }),
      },
    ],
  }
}

export const forecastAdvisor: Advisor<ForecastInput> = {
  id: 'forecast',
  domainAr: 'التوقع والحالات غير المعتادة',
  domainEn: 'Forecast & anomalies',
  run(input: ForecastInput): AdvisorReport {
    const gaps: CouncilDataGap[] = []
    const findings: CouncilFinding[] = []
    const d = completedDailyByBranch(input.summary)
    if (!d || d.days.length < MIN_HISTORY_DAYS) {
      gaps.push({
        odooModel: 'pos.order',
        missingAr: `يحتاج التوقع وكشف الحالات غير المعتادة إلى ${MIN_HISTORY_DAYS} يوماً مكتملاً على الأقل من المبيعات اليومية لكل فرع.`,
        missingEn: `Forecasting and anomaly detection need at least ${MIN_HISTORY_DAYS} completed days of per-branch daily sales.`,
        recordAr: 'مزامنة Odoo (pos.order) لآخر 8 أسابيع على الأقل.',
        recordEn: 'An Odoo sync (pos.order) covering at least the last 8 weeks.',
      })
    } else {
      const anomalies = detectAnomalies(d)
      const market = marketWideDays(anomalies)
      const covered = new Set(market.flatMap((m) => m.anomalies.map((a) => `${a.branchId}:${a.day}`)))
      findings.push(...market.slice(0, 2).map((m) => marketWideFinding(m, d)))
      findings.push(...anomalies.filter((a) => !covered.has(`${a.branchId}:${a.day}`)).slice(0, 3).map((a) => anomalyFinding(a, d)))
      const company = forecastNext7(d, null)
      const f = company ? forecastFinding(company, d, anomalies.length) : null
      if (f) findings.push(f)
      else gaps.push({ odooModel: 'pos.order', missingAr: `خطأ التوقع في الاختبار الرجعي أعلى من ${MAX_PUBLISHED_MAPE}% أو التاريخ غير كافٍ، لذلك لا يُنشر رقم متوقع.`, missingEn: `The forecast's backtest error is above ${MAX_PUBLISHED_MAPE}% or history is short, so no forecast figure is published.`, recordAr: 'تاريخ مبيعات أطول وأكثر انتظاماً.', recordEn: 'A longer, steadier sales history.' })
    }
    return {
      advisorId: 'forecast',
      domainAr: this.domainAr,
      domainEn: this.domainEn,
      period: d ? { from: d.days[0], to: d.days[d.days.length - 1] } : null,
      generatedAt: input.summary?.lastSyncAt ?? null,
      status: !d ? 'unavailable' : gaps.length > 0 ? 'partial' : 'ready',
      findings,
      dataGaps: gaps,
    }
  },
}
