/**
 * Seasons advisor — owner-editable calendar (Ramadan, both Eids, school start, school holidays,
 * summer, winter, National Day, salary days …).
 *
 * For each event starting within the horizon it finds the last occurrence (last year's window for
 * yearly events, the last completed windows for monthly ones), compares its per-day sales with
 * normal days of the same weekdays around it, and writes a prep plan N weeks ahead. A window that
 * is not in the synced daily rows becomes a data gap — never a guessed number.
 */
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { branchLabel, clamp01, estimate, evidence, fromFils, pctChange, r1, shiftIso, weekdayOf } from '../helpers'
import { completedDailyByBranch, type CompletedDaily } from '../series'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilFinding, CouncilProposal } from '../types'

export const SEASON_KINDS = [
  'ramadan',
  'eid-al-fitr',
  'eid-al-adha',
  'school-start',
  'school-holiday',
  'summer',
  'winter',
  'national-day',
  'salary-days',
  'custom',
] as const
export type SeasonKind = (typeof SEASON_KINDS)[number]

export interface SeasonEvent {
  id: string
  kind: SeasonKind
  nameAr: string
  nameEn: string
  /** Next occurrence, Kuwait calendar days (inclusive). */
  startsOn: string
  endsOn: string
  recurrence: 'yearly' | 'monthly' | 'none'
  /** Dates are approximate (Hijri / ministry announcement pending) — the owner should confirm. */
  approximate: boolean
  /** Actual dates of the previous occurrence when they differ from "one year earlier" (Hijri events). */
  previousStartsOn?: string | null
  previousEndsOn?: string | null
  notes?: string | null
}

/** Suggested calendar shown until the owner saves their own. Hijri dates are approximate. */
export const SUGGESTED_SEASON_EVENTS: readonly SeasonEvent[] = [
  { id: 'salary-days', kind: 'salary-days', nameAr: 'أيام الرواتب', nameEn: 'Salary days', startsOn: '2026-11-25', endsOn: '2026-12-01', recurrence: 'monthly', approximate: true },
  { id: 'winter-2026', kind: 'winter', nameAr: 'موسم الشتاء', nameEn: 'Winter season', startsOn: '2026-12-01', endsOn: '2027-02-28', recurrence: 'yearly', approximate: true },
  { id: 'school-holiday-mid', kind: 'school-holiday', nameAr: 'عطلة منتصف العام الدراسي', nameEn: 'Mid-year school holiday', startsOn: '2027-01-21', endsOn: '2027-02-06', recurrence: 'yearly', approximate: true },
  { id: 'ramadan-2027', kind: 'ramadan', nameAr: 'رمضان', nameEn: 'Ramadan', startsOn: '2027-02-08', endsOn: '2027-03-09', recurrence: 'yearly', approximate: true, previousStartsOn: '2026-02-18', previousEndsOn: '2026-03-19' },
  { id: 'national-day-2027', kind: 'national-day', nameAr: 'العيد الوطني وعيد التحرير', nameEn: 'National & Liberation Day', startsOn: '2027-02-25', endsOn: '2027-02-26', recurrence: 'yearly', approximate: false },
  { id: 'eid-al-fitr-2027', kind: 'eid-al-fitr', nameAr: 'عيد الفطر', nameEn: 'Eid al-Fitr', startsOn: '2027-03-10', endsOn: '2027-03-12', recurrence: 'yearly', approximate: true, previousStartsOn: '2026-03-20', previousEndsOn: '2026-03-22' },
  { id: 'eid-al-adha-2027', kind: 'eid-al-adha', nameAr: 'عيد الأضحى', nameEn: 'Eid al-Adha', startsOn: '2027-05-16', endsOn: '2027-05-19', recurrence: 'yearly', approximate: true, previousStartsOn: '2026-05-26', previousEndsOn: '2026-05-29' },
  { id: 'summer-2027', kind: 'summer', nameAr: 'الصيف', nameEn: 'Summer', startsOn: '2027-06-15', endsOn: '2027-09-10', recurrence: 'yearly', approximate: true },
  { id: 'school-start-2027', kind: 'school-start', nameAr: 'بداية الدراسة', nameEn: 'School start', startsOn: '2027-09-14', endsOn: '2027-09-15', recurrence: 'yearly', approximate: true, previousStartsOn: '2026-09-14', previousEndsOn: '2026-09-15' },
]

export interface SeasonsInput {
  summary: OdooLiveSummary | null
  events: readonly SeasonEvent[]
  /** Weeks ahead to plan for. */
  horizonWeeks?: number
}

const addYears = (iso: string, n: number) => `${Number(iso.slice(0, 4)) + n}${iso.slice(4)}`

function monthlyPrevious(ev: SeasonEvent, d: CompletedDaily, count: number): { from: string; to: string }[] {
  const len = Math.round((Date.parse(`${ev.endsOn}T00:00:00Z`) - Date.parse(`${ev.startsOn}T00:00:00Z`)) / 86_400_000)
  const out: { from: string; to: string }[] = []
  for (let m = 1; m <= 24 && out.length < count; m++) {
    const dt = new Date(`${ev.startsOn}T00:00:00Z`)
    dt.setUTCMonth(dt.getUTCMonth() - m)
    const from = dt.toISOString().slice(0, 10)
    const to = shiftIso(from, len)
    if (from < d.days[0]) break
    if (to <= d.days[d.days.length - 1]) out.push({ from, to })
  }
  return out
}

interface WindowStats {
  window: { from: string; to: string }
  windowPerDayFils: number
  baselinePerDayFils: number
  upliftPct: number
  topBranch: { id: string; upliftPct: number } | null
  topBranches: { id: string; upliftPct: number }[]
}

/** Per-day sales in the window vs the same weekdays in the 4 weeks around it (window excluded). */
function compareWindow(d: CompletedDaily, w: { from: string; to: string }): WindowStats | null {
  const inData = d.days.filter((day) => day >= w.from && day <= w.to)
  const expected = Math.round((Date.parse(`${w.to}T00:00:00Z`) - Date.parse(`${w.from}T00:00:00Z`)) / 86_400_000) + 1
  if (inData.length < expected) return null
  const weekdays = new Set(inData.map(weekdayOf))
  const lo = shiftIso(w.from, -28)
  const hi = shiftIso(w.to, 28)
  const base = d.days.filter((day) => day >= lo && day <= hi && (day < w.from || day > w.to) && weekdays.has(weekdayOf(day)))
  if (base.length < inData.length) return null
  const perDay = (days: string[], branch?: string) =>
    days.reduce((s, day) => s + Object.entries(d.byDay[day]).reduce((t, [b, c]) => (branch && b !== branch ? t : t + c.netFils), 0), 0) / days.length
  const windowPerDayFils = perDay(inData)
  const baselinePerDayFils = perDay(base)
  const upliftPct = pctChange(windowPerDayFils, baselinePerDayFils)
  if (upliftPct === null) return null
  let topBranch: WindowStats['topBranch'] = null
  const ranked: { id: string; upliftPct: number }[] = []
  for (const id of d.branchIds) {
    const u = pctChange(perDay(inData, id), perDay(base, id))
    if (u !== null && perDay(base, id) > baselinePerDayFils * 0.05) {
      ranked.push({ id, upliftPct: u })
      if (!topBranch || Math.abs(u) > Math.abs(topBranch.upliftPct)) topBranch = { id, upliftPct: u }
    }
  }
  ranked.sort((a, b) => Math.abs(b.upliftPct) - Math.abs(a.upliftPct))
  return { window: w, windowPerDayFils, baselinePerDayFils, upliftPct, topBranch, topBranches: ranked.slice(0, 3) }
}

export interface SeasonOccurrenceLift {
  eventId: string
  window: { from: string; to: string }
  avgDailyKwd: number
  baselineDailyKwd: number
  liftPct: number
  topBranches: { id: string; nameAr: string; nameEn: string; liftPct: number }[]
}

/** Last occurrence that is fully inside the daily series, versus the normal-day baseline. */
export function seasonLiftsFromDaily(summary: OdooLiveSummary | null, events: readonly SeasonEvent[]): SeasonOccurrenceLift[] {
  const d = completedDailyByBranch(summary)
  if (!d) return []
  const lifts: SeasonOccurrenceLift[] = []
  for (const ev of events) {
    const previous =
      ev.recurrence === 'monthly'
        ? monthlyPrevious(ev, d, 1)
        : [
            { from: ev.startsOn, to: ev.endsOn },
            { from: ev.previousStartsOn ?? addYears(ev.startsOn, -1), to: ev.previousEndsOn ?? addYears(ev.endsOn, -1) },
          ]
    const stats = previous.map((w) => compareWindow(d, w)).find((s): s is WindowStats => s !== null)
    if (!stats) continue
    lifts.push({
      eventId: ev.id,
      window: stats.window,
      avgDailyKwd: fromFils(Math.round(stats.windowPerDayFils)),
      baselineDailyKwd: fromFils(Math.round(stats.baselinePerDayFils)),
      liftPct: r1(stats.upliftPct),
      topBranches: stats.topBranches.map((b) => ({ id: b.id, nameAr: branchLabel(b.id).ar, nameEn: branchLabel(b.id).en, liftPct: r1(b.upliftPct) })),
    })
  }
  return lifts
}

function prepPlan(ev: SeasonEvent, s: WindowStats, weeksAhead: number): CouncilProposal[] {
  const up = s.upliftPct >= 0
  const top = s.topBranch ? branchLabel(s.topBranch.id) : null
  const extraPerDay = fromFils(s.windowPerDayFils - s.baselinePerDayFils)
  const eventDays = Math.min(7, Math.round((Date.parse(`${ev.endsOn}T00:00:00Z`) - Date.parse(`${ev.startsOn}T00:00:00Z`)) / 86_400_000) + 1)
  const when = (w: number) => ({ ar: w <= 0 ? 'هذا الأسبوع' : `قبل ${w} أسبوع من البداية`, en: w <= 0 ? 'this week' : `${w} week(s) before the start` })
  const lead = Math.max(0, weeksAhead - 1)
  return [
    {
      who: { ar: 'المطبخ المركزي (القرين) والمشتريات', en: 'Central kitchen (Qurain) and purchasing' },
      what: up
        ? { ar: `رفع الإنتاج والطلبيات بنسبة الارتفاع السابقة لأيام «${ev.nameAr}»${top ? `، مع أولوية ${top.ar}` : ''}`, en: `raise production and orders by the previous uplift for “${ev.nameEn}”${top ? `, prioritising ${top.en}` : ''}` }
        : { ar: `خفض الإنتاج لأيام «${ev.nameAr}» لتقليل الهدر${top ? `، خاصة ${top.ar}` : ''}`, en: `cut production for “${ev.nameEn}” to reduce waste${top ? `, especially ${top.en}` : ''}` },
      when: when(lead),
      expectedImpact: estimate(Math.abs(extraPerDay) * eventDays, 'KWD', up ? '(window per-day net − baseline per-day net) × event days (max 7), previous occurrence' : '(baseline per-day net − window per-day net) × event days (max 7), previous occurrence', { windowPerDayKwd: fromFils(Math.round(s.windowPerDayFils)), baselinePerDayKwd: fromFils(Math.round(s.baselinePerDayFils)), eventDays }),
    },
    {
      who: { ar: 'الموارد البشرية ومدراء الفروع', en: 'HR and branch managers' },
      what: up ? { ar: `جدول ورديات خاص لأيام «${ev.nameAr}»: إضافة طاقم الذروة بدل تمديد الورديات`, en: `a dedicated roster for “${ev.nameEn}”: add peak crew instead of extending shifts` } : { ar: `تقليل ورديات الساعات الهادئة في «${ev.nameAr}» وجدولة الإجازات فيها`, en: `trim quiet-hour shifts during “${ev.nameEn}” and schedule leave there` },
      when: when(Math.max(0, weeksAhead - 2)),
      expectedImpact: null,
    },
    {
      who: { ar: 'التسويق ومسؤول المنصات', en: 'Marketing and platforms lead' },
      what: up ? { ar: `حجز مواقع الظهور على طلبات وكيتا لأيام «${ev.nameAr}» ومنيو مختصر للأصناف الأسرع`, en: `book Talabat / Keeta visibility slots for “${ev.nameEn}” and a short menu of the fastest items` } : { ar: `حملة مستهدفة لأيام «${ev.nameAr}» على القناة الأضعف${top ? ` في ${top.ar}` : ''}`, en: `a targeted campaign for “${ev.nameEn}” on the weakest channel${top ? ` at ${top.en}` : ''}` },
      when: when(lead),
      expectedImpact: null,
    },
  ]
}

export const seasonsAdvisor: Advisor<SeasonsInput> = {
  id: 'seasons',
  domainAr: 'المواسم والمناسبات',
  domainEn: 'Seasons & occasions',
  run(input: SeasonsInput): AdvisorReport {
    const gaps: CouncilDataGap[] = []
    const findings: CouncilFinding[] = []
    const d = completedDailyByBranch(input.summary)
    const horizon = input.horizonWeeks ?? 12
    if (!d) {
      gaps.push({ odooModel: 'pos.order', missingAr: 'لا توجد مبيعات يومية مكتملة لمقارنة المواسم.', missingEn: 'No completed daily sales to compare seasons.', recordAr: 'مزامنة Odoo للمبيعات اليومية.', recordEn: 'An Odoo sync of daily sales.' })
      return { advisorId: 'seasons', domainAr: this.domainAr, domainEn: this.domainEn, period: null, generatedAt: null, status: 'unavailable', findings, dataGaps: gaps }
    }
    const today = shiftIso(d.days[d.days.length - 1], 1)
    const horizonEnd = shiftIso(today, horizon * 7)
    const upcoming = input.events.filter((e) => e.endsOn >= today && e.startsOn <= horizonEnd).sort((a, b) => a.startsOn.localeCompare(b.startsOn))
    for (const ev of upcoming) {
      const weeksAhead = Math.max(0, Math.floor((Date.parse(`${ev.startsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / (7 * 86_400_000)))
      const previous =
        ev.recurrence === 'monthly'
          ? monthlyPrevious(ev, d, 2)
          : [{ from: ev.previousStartsOn ?? addYears(ev.startsOn, -1), to: ev.previousEndsOn ?? addYears(ev.endsOn, -1) }]
      const stats = previous.map((w) => compareWindow(d, w)).filter((s): s is WindowStats => s !== null)
      if (stats.length === 0) {
        const w = previous[0]
        gaps.push({
          odooModel: 'pos.order',
          missingAr: `«${ev.nameAr}»: نافذة المرة السابقة (${w.from} → ${w.to}) غير موجودة في المبيعات اليومية المتزامنة (تبدأ ${d.days[0]}).`,
          missingEn: `“${ev.nameEn}”: the previous window (${w.from} → ${w.to}) is not in the synced daily sales (they start ${d.days[0]}).`,
          recordAr: `مزامنة Odoo اليومية لنافذة ${w.from} → ${w.to} مع أربعة أسابيع حولها.`,
          recordEn: `A daily Odoo sync for ${w.from} → ${w.to} plus four weeks around it.`,
        })
        continue
      }
      // Use the most recent comparable occurrence; report all of them as evidence.
      const s = stats[0]
      const uplift = r1(stats.reduce((t, x) => t + x.upliftPct, 0) / stats.length)
      findings.push({
        fingerprint: `seasons:${ev.id}:${ev.startsOn}`,
        advisorId: 'seasons',
        kind: 'season-prep',
        entities: s.topBranch ? { branchId: s.topBranch.id } : {},
        titleAr: `«${ev.nameAr}» بعد ${weeksAhead} أسبوع: آخر مرة كانت المبيعات اليومية ${uplift >= 0 ? '+' : ''}${uplift.toFixed(1)}% عن الأيام العادية${s.topBranch ? ` (الأكثر تأثراً: ${branchLabel(s.topBranch.id).ar} ${s.topBranch.upliftPct >= 0 ? '+' : ''}${s.topBranch.upliftPct.toFixed(1)}%)` : ''}`,
        titleEn: `“${ev.nameEn}” in ${weeksAhead} week(s): last time daily sales were ${uplift >= 0 ? '+' : ''}${uplift.toFixed(1)}% vs normal days${s.topBranch ? ` (most affected: ${branchLabel(s.topBranch.id).en} ${s.topBranch.upliftPct >= 0 ? '+' : ''}${s.topBranch.upliftPct.toFixed(1)}%)` : ''}`,
        evidence: stats.flatMap((x) => [
          evidence({ odooModel: 'pos.order', domain: 'company, per completed day', period: x.window, value: fromFils(Math.round(x.windowPerDayFils)), unit: 'KWD', syncAt: d.syncAt, labelAr: 'متوسط اليوم في النافذة', labelEn: 'Average day in the window' }),
          evidence({ odooModel: 'pos.order', domain: 'company, same weekdays ±4 weeks (window excluded)', period: { from: shiftIso(x.window.from, -28), to: shiftIso(x.window.to, 28) }, value: fromFils(Math.round(x.baselinePerDayFils)), unit: 'KWD', syncAt: d.syncAt, labelAr: 'متوسط اليوم العادي', labelEn: 'Average normal day' }),
          evidence({ odooModel: 'pos.order', domain: 'window vs normal days', period: x.window, value: x.upliftPct, unit: 'pct', syncAt: d.syncAt, labelAr: 'الفرق عن الأيام العادية', labelEn: 'Difference vs normal days' }),
          ...(x.topBranch ? [evidence({ odooModel: 'pos.order', domain: `branch=${x.topBranch.id}, window vs normal days`, period: x.window, value: x.topBranch.upliftPct, unit: 'pct' as const, syncAt: d.syncAt, labelAr: `الفرق في ${branchLabel(x.topBranch.id).ar}`, labelEn: `Difference at ${branchLabel(x.topBranch.id).en}` })] : []),
        ]),
        thresholds: { weeksAhead, baselineWeeks: 4, occurrences: stats.length, averageUpliftPct: uplift },
        rootCause: {
          ar: ev.approximate ? `نمط موسمي متكرر؛ التواريخ تقريبية ويؤكدها المالك في صفحة المواسم.` : 'نمط موسمي متكرر.',
          en: ev.approximate ? 'A recurring seasonal pattern; the dates are approximate and confirmed by the owner on the seasons page.' : 'A recurring seasonal pattern.',
        },
        severity: Math.abs(uplift) >= 15 ? 'high' : Math.abs(uplift) >= 5 ? 'medium' : 'low',
        novelty: clamp01(Math.abs(uplift) / 30),
        weeklyImpact: estimate((Math.abs(s.windowPerDayFils - s.baselinePerDayFils) / 1000) * Math.min(7, Math.round((Date.parse(`${ev.endsOn}T00:00:00Z`) - Date.parse(`${ev.startsOn}T00:00:00Z`)) / 86_400_000) + 1), 'KWD', '|window per-day − baseline per-day| × event days (max 7)', { windowPerDayKwd: fromFils(Math.round(s.windowPerDayFils)), baselinePerDayKwd: fromFils(Math.round(s.baselinePerDayFils)) }),
        proposals: prepPlan(ev, s, weeksAhead),
      })
    }
    return {
      advisorId: 'seasons',
      domainAr: this.domainAr,
      domainEn: this.domainEn,
      period: { from: today, to: horizonEnd },
      generatedAt: d.syncAt,
      status: gaps.length > 0 ? 'partial' : 'ready',
      findings,
      dataGaps: gaps,
    }
  },
}
