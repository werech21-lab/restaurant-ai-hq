/**
 * CFO advisor — sales by branch × brand × hour × channel × product, AOV and basket, discounts,
 * aggregator exposure, dying / rising SKUs. Fair comparisons use completed periods only (the day in
 * progress at sync time is never compared). Profit is reported only for GL-locked months.
 */
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import {
  AGGREGATOR_CHANNELS,
  WEEKDAY_AR,
  WEEKDAY_EN,
  branchLabel,
  brandLabel,
  channelLabel,
  clamp01,
  estimate,
  evidence,
  fromFils,
  median,
  pctChange,
  r1,
  shiftIso,
  weekdayOf,
} from '../helpers'
import { completedDailyByBranch, lastTwoWindows, sumWindow, type CompletedDaily } from '../series'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilFinding } from '../types'

export interface CfoInput {
  summary: OdooLiveSummary | null
  /** Live period cube for the analysed window (brand / channel / hour / product sections). */
  cube?: OdooPeriodCube | null
  /** The same-length cube just before `cube`, for dying / rising SKUs. */
  priorCube?: OdooPeriodCube | null
  /** Latest GL lock date (period / fiscal year), or null when unknown. */
  glClosedThrough?: string | null
}

const POS = 'pos.order'

function weekOverWeek(d: CompletedDaily): CouncilFinding[] {
  const w = lastTwoWindows(d, 7)
  if (!w) return []
  const companyA = sumWindow(d, w.a.from, w.a.to)
  const companyB = sumWindow(d, w.b.from, w.b.to)
  const companyPct = pctChange(companyA.netFils, companyB.netFils)
  if (companyPct === null) return []
  const rows = d.branchIds
    .map((id) => {
      const a = sumWindow(d, w.a.from, w.a.to, id)
      const b = sumWindow(d, w.b.from, w.b.to, id)
      return { id, a, b, pct: pctChange(a.netFils, b.netFils) }
    })
    // A branch must carry at least 2% of the company week to be compared fairly.
    .filter((r) => r.pct !== null && r.b.netFils >= companyB.netFils * 0.02)
  if (rows.length < 2) return []
  const out: CouncilFinding[] = []
  const worst = [...rows].sort((x, y) => (x.pct! - companyPct) - (y.pct! - companyPct))[0]
  const gapPts = r1(worst.pct! - companyPct)
  if (gapPts <= -8) {
    const lbl = branchLabel(worst.id)
    const lostFils = Math.max(0, worst.b.netFils - worst.a.netFils)
    out.push({
      fingerprint: `cfo:wow-divergence:${worst.id}`,
      advisorId: 'cfo',
      kind: 'wow-divergence',
      entities: { branchId: worst.id },
      titleAr: `${lbl.ar} تراجعت ${Math.abs(worst.pct!).toFixed(1)}% أسبوعياً بينما الشركة ${companyPct >= 0 ? 'نمت' : 'تراجعت'} ${Math.abs(companyPct).toFixed(1)}%`,
      titleEn: `${lbl.en} fell ${Math.abs(worst.pct!).toFixed(1)}% week-on-week while the company ${companyPct >= 0 ? 'grew' : 'fell'} ${Math.abs(companyPct).toFixed(1)}%`,
      evidence: [
        evidence({ odooModel: POS, domain: `branch=${worst.id}, state∈{paid,done,invoiced}`, period: w.a, value: fromFils(worst.a.netFils), unit: 'KWD', syncAt: d.syncAt, labelAr: `صافي ${lbl.ar} آخر 7 أيام مكتملة`, labelEn: `${lbl.en} net, last 7 completed days` }),
        evidence({ odooModel: POS, domain: `branch=${worst.id}, state∈{paid,done,invoiced}`, period: w.b, value: fromFils(worst.b.netFils), unit: 'KWD', syncAt: d.syncAt, labelAr: `صافي ${lbl.ar} الأيام السبعة السابقة`, labelEn: `${lbl.en} net, the 7 days before` }),
        evidence({ odooModel: POS, domain: `branch=${worst.id}`, period: w.a, value: worst.pct!, unit: 'pct', syncAt: d.syncAt, labelAr: `تغيّر ${lbl.ar} أسبوعياً`, labelEn: `${lbl.en} week-on-week change` }),
        evidence({ odooModel: POS, domain: 'all company branches', period: w.a, value: companyPct, unit: 'pct', syncAt: d.syncAt, labelAr: 'تغيّر الشركة أسبوعياً', labelEn: 'Company week-on-week change' }),
        evidence({ odooModel: POS, domain: `branch=${worst.id} vs company`, period: w.a, value: gapPts, unit: 'pct', syncAt: d.syncAt, labelAr: 'الفارق عن الشركة (نقاط)', labelEn: 'Gap to the company (points)' }),
      ],
      thresholds: { windowDays: 7, responseHours: 48 },
      rootCause: {
        ar: `التراجع خاص بـ${lbl.ar} وليس بالسوق كله (فارق ${Math.abs(gapPts).toFixed(1)} نقطة عن الشركة): ابحث عن سبب محلي — توقف قناة توصيل، نقص طاقم في الذروة، أو صنف رئيسي غير متوفر.`,
        en: `The drop is specific to ${lbl.en}, not the market (${Math.abs(gapPts).toFixed(1)} points below the company): look for a local cause — a paused delivery channel, a peak-hour staffing gap, or a key item out of stock.`,
      },
      severity: gapPts <= -20 ? 'high' : 'medium',
      novelty: clamp01(Math.abs(gapPts) / 40),
      weeklyImpact: estimate(fromFils(lostFils), 'KWD', 'prior-week net − last-week net', { priorWeekNetKwd: fromFils(worst.b.netFils), lastWeekNetKwd: fromFils(worst.a.netFils) }),
      proposals: [
        {
          who: { ar: `مدير فرع ${lbl.ar}`, en: `${lbl.en} branch manager` },
          what: { ar: 'مطابقة ساعات توقف طلبات وكيتا في لوحات المنصات مع أيام التراجع، وإعادة تفعيل أي متجر متوقف فوراً', en: 'match Talabat / Keeta store-pause logs against the down days and re-open any paused store immediately' },
          when: { ar: 'اليوم قبل وردية الغداء', en: 'today, before the lunch shift' },
          expectedImpact: estimate(fromFils(lostFils) * 0.5, 'KWD', '50% × (prior-week net − last-week net)', { priorWeekNetKwd: fromFils(worst.b.netFils), lastWeekNetKwd: fromFils(worst.a.netFils), recoveryShare: 0.5 }),
        },
        {
          who: { ar: 'مدير العمليات', en: 'Operations manager' },
          what: { ar: `زيارة ${lbl.ar} في ساعة الذروة ومراجعة الأصناف غير المتوفرة وزمن التحضير مقارنة بأفضل فرع هذا الأسبوع`, en: `visit ${lbl.en} at peak and review out-of-stock items and prep time against this week's best branch` },
          when: { ar: 'خلال 48 ساعة', en: 'within 48 hours' },
          expectedImpact: null,
        },
      ],
    })
  }
  const best = [...rows].sort((x, y) => (y.pct! - companyPct) - (x.pct! - companyPct))[0]
  const upPts = r1(best.pct! - companyPct)
  if (best.id !== worst.id && upPts >= 8) {
    const lbl = branchLabel(best.id)
    out.push({
      fingerprint: `cfo:wow-outperformer:${best.id}`,
      advisorId: 'cfo',
      kind: 'wow-outperformer',
      entities: { branchId: best.id },
      titleAr: `${lbl.ar} تتفوّق: ${best.pct! >= 0 ? '+' : ''}${best.pct!.toFixed(1)}% أسبوعياً مقابل ${companyPct >= 0 ? '+' : ''}${companyPct.toFixed(1)}% للشركة`,
      titleEn: `${lbl.en} is outperforming: ${best.pct! >= 0 ? '+' : ''}${best.pct!.toFixed(1)}% week-on-week vs ${companyPct >= 0 ? '+' : ''}${companyPct.toFixed(1)}% for the company`,
      evidence: [
        evidence({ odooModel: POS, domain: `branch=${best.id}`, period: w.a, value: fromFils(best.a.netFils), unit: 'KWD', syncAt: d.syncAt, labelAr: `صافي ${lbl.ar} آخر 7 أيام مكتملة`, labelEn: `${lbl.en} net, last 7 completed days` }),
        evidence({ odooModel: POS, domain: `branch=${best.id}`, period: w.b, value: fromFils(best.b.netFils), unit: 'KWD', syncAt: d.syncAt, labelAr: `صافي ${lbl.ar} الأيام السبعة السابقة`, labelEn: `${lbl.en} net, the 7 days before` }),
        evidence({ odooModel: POS, domain: `branch=${best.id}`, period: w.a, value: best.pct!, unit: 'pct', syncAt: d.syncAt, labelAr: `تغيّر ${lbl.ar} أسبوعياً`, labelEn: `${lbl.en} week-on-week change` }),
        evidence({ odooModel: POS, domain: 'all company branches', period: w.a, value: companyPct, unit: 'pct', syncAt: d.syncAt, labelAr: 'تغيّر الشركة أسبوعياً', labelEn: 'Company week-on-week change' }),
      ],
      thresholds: { windowDays: 7 },
      rootCause: {
        ar: `شيء ما يعمل في ${lbl.ar} أفضل من بقية الفروع هذا الأسبوع؛ إن لم يُعرف سببه فلن يُكرَّر.`,
        en: `Something is working at ${lbl.en} better than the other branches this week; unless the cause is known it will not be repeated.`,
      },
      severity: 'low',
      novelty: clamp01(upPts / 40),
      weeklyImpact: null,
      proposals: [
        {
          who: { ar: `مدير فرع ${lbl.ar}`, en: `${lbl.en} branch manager` },
          what: { ar: 'توثيق ما تغيّر هذا الأسبوع (عرض، منيو، طاقم، ترتيب على المنصات) في مذكرة قصيرة لمدير العمليات', en: 'write down what changed this week (offer, menu, crew, platform ranking) in a short note to the operations manager' },
          when: { ar: 'قبل اجتماع الأحد', en: 'before the Sunday meeting' },
          expectedImpact: null,
        },
      ],
    })
  }
  return out
}

function basketShrink(d: CompletedDaily): CouncilFinding[] {
  const w = lastTwoWindows(d, 28)
  if (!w) return []
  const rows = d.branchIds
    .map((id) => {
      const a = sumWindow(d, w.a.from, w.a.to, id)
      const b = sumWindow(d, w.b.from, w.b.to, id)
      if (a.orders < 100 || b.orders < 100) return null
      const aovA = a.netFils / a.orders / 1000
      const aovB = b.netFils / b.orders / 1000
      return { id, a, b, aovA, aovB, aovPct: pctChange(aovA, aovB)!, ordersPct: pctChange(a.orders, b.orders)! }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.aovPct <= -5 && r.ordersPct > 0)
    .sort((x, y) => x.aovPct - y.aovPct)
  const top = rows[0]
  if (!top) return []
  const lbl = branchLabel(top.id)
  const lostPerOrderFils = Math.round((top.aovB - top.aovA) * 1000)
  const weekly = (top.a.orders / 4) * (top.aovB - top.aovA)
  return [
    {
      fingerprint: `cfo:basket-shrink:${top.id}`,
      advisorId: 'cfo',
      kind: 'basket-shrink',
      entities: { branchId: top.id },
      titleAr: `${lbl.ar}: الطلبات زادت ${top.ordersPct.toFixed(1)}% لكن متوسط الفاتورة نزل ${Math.abs(top.aovPct).toFixed(1)}%`,
      titleEn: `${lbl.en}: orders up ${top.ordersPct.toFixed(1)}% but the average ticket down ${Math.abs(top.aovPct).toFixed(1)}%`,
      evidence: [
        evidence({ odooModel: POS, domain: `branch=${top.id}`, period: w.a, value: top.aovA, unit: 'KWD/order', syncAt: d.syncAt, labelAr: 'متوسط الفاتورة آخر 28 يوماً مكتملة', labelEn: 'Average ticket, last 28 completed days' }),
        evidence({ odooModel: POS, domain: `branch=${top.id}`, period: w.b, value: top.aovB, unit: 'KWD/order', syncAt: d.syncAt, labelAr: 'متوسط الفاتورة الـ28 يوماً السابقة', labelEn: 'Average ticket, the 28 days before' }),
        evidence({ odooModel: POS, domain: `branch=${top.id}`, period: w.a, value: top.a.orders, unit: 'orders', syncAt: d.syncAt, labelAr: 'الطلبات آخر 28 يوماً', labelEn: 'Orders, last 28 days' }),
        evidence({ odooModel: POS, domain: `branch=${top.id}`, period: w.b, value: top.b.orders, unit: 'orders', syncAt: d.syncAt, labelAr: 'الطلبات الـ28 يوماً السابقة', labelEn: 'Orders, the 28 days before' }),
        evidence({ odooModel: POS, domain: `branch=${top.id}`, period: w.a, value: top.ordersPct, unit: 'pct', syncAt: d.syncAt, labelAr: 'تغيّر الطلبات', labelEn: 'Change in orders' }),
        evidence({ odooModel: POS, domain: `branch=${top.id}`, period: w.a, value: top.aovPct, unit: 'pct', syncAt: d.syncAt, labelAr: 'تغيّر متوسط الفاتورة', labelEn: 'Change in average ticket' }),
      ],
      thresholds: { windowDays: 28 },
      rootCause: {
        ar: 'زبائن أكثر لكن سلة أصغر: غالباً خصومات المنصات أو اختفاء الإضافات (مشروبات، حلويات، أحجام كبيرة) من الطلب.',
        en: 'More customers but smaller baskets: usually platform discounts, or add-ons (drinks, desserts, large sizes) dropping out of the order.',
      },
      severity: top.aovPct <= -10 ? 'high' : 'medium',
      novelty: clamp01(Math.abs(top.aovPct) / 20),
      weeklyImpact: estimate(weekly, 'KWD', '(orders last 28 days ÷ 4) × (prior average ticket − current average ticket)', { ordersLast28: top.a.orders, priorAovKwd: Math.round(top.aovB * 1000) / 1000, currentAovKwd: Math.round(top.aovA * 1000) / 1000 }),
      proposals: [
        {
          who: { ar: `مشرف كاشير ${lbl.ar}`, en: `${lbl.en} cashier lead` },
          what: { ar: 'سكربت بيع إضافي واحد عند كل طلب (مشروب أو حلى مع الوجبة) ومتابعة نسبته يومياً من نقاط البيع', en: 'one upsell line on every order (drink or dessert with the meal), tracked daily from the POS' },
          when: { ar: 'من الغد ولمدة أسبوعين', en: 'from tomorrow, for two weeks' },
          expectedImpact: estimate((top.a.orders / 4) * (lostPerOrderFils / 1000) * 0.5, 'KWD', '50% × (orders last 28 days ÷ 4) × ticket drop per order', { ordersLast28: top.a.orders, ticketDropKwd: lostPerOrderFils / 1000, recoveryShare: 0.5 }),
        },
        {
          who: { ar: 'مدير التسويق', en: 'Marketing manager' },
          what: { ar: `مراجعة خصومات طلبات وكيتا الممولة على ${lbl.ar} واستبدال الخصم المفتوح بحد أدنى للطلب`, en: `review funded Talabat / Keeta discounts at ${lbl.en} and replace open discounts with a minimum-basket threshold` },
          when: { ar: 'هذا الأسبوع', en: 'this week' },
          expectedImpact: null,
        },
      ],
    },
  ]
}

function weekdayGap(d: CompletedDaily): CouncilFinding[] {
  const last = d.days[d.days.length - 1]
  const from = shiftIso(last, -55)
  const days = d.days.filter((day) => day >= from)
  if (days.length < 56) return []
  const index = new Map<string, number[]>()
  const avgDay = new Map<string, number>()
  for (const id of d.branchIds) {
    const perWd = Array.from({ length: 7 }, () => 0)
    let total = 0
    for (const day of days) {
      const f = d.byDay[day][id]?.netFils ?? 0
      perWd[weekdayOf(day)] += f
      total += f
    }
    if (total === 0) continue
    const avg = total / days.length
    avgDay.set(id, avg)
    index.set(id, perWd.map((v) => v / 8 / avg))
  }
  let best: { id: string; wd: number; gap: number; own: number; sib: number } | null = null
  for (const [id, idx] of index) {
    for (let wd = 0; wd < 7; wd++) {
      const sib = median([...index].filter(([o]) => o !== id).map(([, v]) => v[wd]))
      const gap = idx[wd] - sib
      if (!best || gap < best.gap) best = { id, wd, gap, own: idx[wd], sib }
    }
  }
  if (!best || best.gap > -0.15) return []
  const lbl = branchLabel(best.id)
  const avg = avgDay.get(best.id)! / 1000
  const ownPct = r1(best.own * 100)
  const sibPct = r1(best.sib * 100)
  const weekly = (best.sib - best.own) * avg
  const period = { from, to: last }
  return [
    {
      fingerprint: `cfo:weekday-gap:${best.id}:${best.wd}`,
      advisorId: 'cfo',
      kind: 'weekday-gap',
      entities: { branchId: best.id, weekday: best.wd },
      titleAr: `${lbl.ar} تبيع يوم ${WEEKDAY_AR[best.wd]} ${ownPct.toFixed(1)}% من يومها المعتاد، بينما بقية الفروع ${sibPct.toFixed(1)}%`,
      titleEn: `${lbl.en} sells ${ownPct.toFixed(1)}% of its normal day on ${WEEKDAY_EN[best.wd]}s, while the other branches sell ${sibPct.toFixed(1)}%`,
      evidence: [
        evidence({ odooModel: POS, domain: `branch=${best.id}, weekday=${WEEKDAY_EN[best.wd]}`, period, value: ownPct, unit: 'pct', syncAt: d.syncAt, labelAr: `مؤشر ${WEEKDAY_AR[best.wd]} لـ${lbl.ar} (متوسط اليوم = 100)`, labelEn: `${lbl.en} ${WEEKDAY_EN[best.wd]} index (average day = 100)` }),
        evidence({ odooModel: POS, domain: `other branches, weekday=${WEEKDAY_EN[best.wd]}`, period, value: sibPct, unit: 'pct', syncAt: d.syncAt, labelAr: `الوسيط لبقية الفروع يوم ${WEEKDAY_AR[best.wd]}`, labelEn: `Median of the other branches on ${WEEKDAY_EN[best.wd]}` }),
        evidence({ odooModel: POS, domain: `branch=${best.id}`, period, value: avg, unit: 'KWD', syncAt: d.syncAt, labelAr: `متوسط اليوم في ${lbl.ar}`, labelEn: `${lbl.en} average day` }),
      ],
      thresholds: { averageDayIndex: 100, weeks: 8 },
      rootCause: {
        ar: `نمط أسبوعي خاص بـ${lbl.ar}: حركة المول أو المنطقة يوم ${WEEKDAY_AR[best.wd]} لا تُترجم إلى مبيعات كما في الفروع الأخرى (ساعات العمل، الطاقم، أو ظهور الفرع على المنصات في ذلك اليوم).`,
        en: `A weekly pattern specific to ${lbl.en}: ${WEEKDAY_EN[best.wd]} footfall does not turn into sales as at the other branches (opening hours, crew, or platform visibility that day).`,
      },
      severity: best.gap <= -0.3 ? 'high' : 'medium',
      novelty: clamp01(Math.abs(best.gap) / 0.5),
      weeklyImpact: estimate(weekly, 'KWD', '(siblings weekday index − branch weekday index) × branch average day', { siblingIndexPct: sibPct, branchIndexPct: ownPct, branchAverageDayKwd: Math.round(avg * 1000) / 1000 }),
      proposals: [
        {
          who: { ar: `مدير فرع ${lbl.ar}`, en: `${lbl.en} branch manager` },
          what: { ar: `تجربة عرض خاص بيوم ${WEEKDAY_AR[best.wd]} على كيتا وطلبات لهذا الفرع فقط، وقياسه مقابل أيام ${WEEKDAY_AR[best.wd]} الثمانية الماضية`, en: `trial a ${WEEKDAY_EN[best.wd]}-only Keeta / Talabat offer for this branch alone, measured against the last eight ${WEEKDAY_EN[best.wd]}s` },
          when: { ar: `يوم ${WEEKDAY_AR[best.wd]} القادم`, en: `next ${WEEKDAY_EN[best.wd]}` },
          expectedImpact: estimate(weekly * 0.5, 'KWD', '50% × (siblings index − branch index) × branch average day', { siblingIndexPct: sibPct, branchIndexPct: ownPct, branchAverageDayKwd: Math.round(avg * 1000) / 1000, recoveryShare: 0.5 }),
        },
        {
          who: { ar: 'الموارد البشرية', en: 'HR' },
          what: { ar: `مراجعة جدول طاقم ${lbl.ar} يوم ${WEEKDAY_AR[best.wd]}: هل يقل العدد في الذروة؟`, en: `check the ${lbl.en} ${WEEKDAY_EN[best.wd]} roster: is the crew thinner at peak?` },
          when: { ar: 'قبل إعداد جدول الأسبوع القادم', en: 'before next week’s roster is set' },
          expectedImpact: null,
        },
      ],
    },
  ]
}

/** Cube sections: channel mix, brand × branch, branch × hour, products. */
function cubeFindings(cube: OdooPeriodCube, priorCube: OdooPeriodCube | null | undefined): CouncilFinding[] {
  const out: CouncilFinding[] = []
  const period = cube.dateRange
  const syncAt = cube.lastSyncAt
  const branches = Object.entries(cube.byBranch).filter(([, c]) => c && c.netKwd > 0) as [string, OdooPeriodCube['byBranch']['avenues']][]
  // Keeta vs Talabat share by branch, against the company mix.
  const talabat = (ch: Record<string, { netKwd: number }>) => (ch['talabat-tgo']?.netKwd ?? 0) + (ch['talabat-tmp']?.netKwd ?? 0)
  const companyTal = talabat(cube.byChannel)
  const companyKeeta = cube.byChannel.keeta?.netKwd ?? 0
  if (companyTal > 0 && companyKeeta > 0) {
    const companyRatio = companyKeeta / companyTal
    const rows = branches
      .map(([id, c]) => ({ id, tal: talabat(c.channels), keeta: c.channels.keeta?.netKwd ?? 0 }))
      .filter((r) => r.tal > 0 && r.keeta > 0)
      .map((r) => ({ ...r, ratio: r.keeta / r.tal }))
      .sort((a, b) => Math.abs(Math.log(b.ratio / companyRatio)) - Math.abs(Math.log(a.ratio / companyRatio)))
    const top = rows[0]
    if (top && Math.abs(Math.log(top.ratio / companyRatio)) >= Math.log(1.8)) {
      const lbl = branchLabel(top.id)
      const keetaHeavy = top.ratio > companyRatio
      out.push({
        fingerprint: `cfo:channel-mix:${top.id}`,
        advisorId: 'cfo',
        kind: 'channel-mix',
        entities: { branchId: top.id, channel: keetaHeavy ? 'keeta' : 'talabat' },
        titleAr: `${lbl.ar}: كيتا ${keetaHeavy ? 'أقوى' : 'أضعف'} بكثير من طلبات مقارنة ببقية الشركة`,
        titleEn: `${lbl.en}: Keeta is far ${keetaHeavy ? 'stronger' : 'weaker'} than Talabat compared with the rest of the company`,
        evidence: [
          evidence({ odooModel: 'pos.payment', domain: `branch=${top.id}, channel=keeta`, period, value: top.keeta, unit: 'KWD', syncAt, labelAr: `كيتا في ${lbl.ar}`, labelEn: `Keeta at ${lbl.en}` }),
          evidence({ odooModel: 'pos.payment', domain: `branch=${top.id}, channel=talabat (TGO+TMP)`, period, value: top.tal, unit: 'KWD', syncAt, labelAr: `طلبات في ${lbl.ar}`, labelEn: `Talabat at ${lbl.en}` }),
          evidence({ odooModel: 'pos.payment', domain: 'company, keeta ÷ talabat', period, value: r1(companyRatio * 100), unit: 'pct', syncAt, labelAr: 'كيتا كنسبة من طلبات على مستوى الشركة', labelEn: 'Keeta as a share of Talabat, company-wide' }),
        ],
        rootCause: {
          ar: keetaHeavy
            ? `طلبات ضعيفة في ${lbl.ar} تحديداً: ترتيب منخفض، توقفات متكررة، أو منطقة توصيل ضيقة على طلبات.`
            : `كيتا ضعيفة في ${lbl.ar} تحديداً: الفرع غير ظاهر أو متوقف على كيتا في أوقات الذروة.`,
          en: keetaHeavy
            ? `Talabat is weak at ${lbl.en} specifically: low ranking, frequent pauses, or a narrow Talabat delivery zone.`
            : `Keeta is weak at ${lbl.en} specifically: the branch is hidden or paused on Keeta at peak.`,
        },
        severity: 'medium',
        thresholds: { responseHours: 48 },
        novelty: clamp01(Math.abs(Math.log(top.ratio / companyRatio)) / Math.log(4)),
        weeklyImpact: null,
        proposals: [
          {
            who: { ar: 'مسؤول المنصات', en: 'Platforms lead' },
            what: { ar: `فحص إعدادات ${keetaHeavy ? 'طلبات' : 'كيتا'} لفرع ${lbl.ar}: منطقة التوصيل، ساعات الفتح، وسجل التوقفات هذا الشهر`, en: `audit ${keetaHeavy ? 'Talabat' : 'Keeta'} settings for ${lbl.en}: delivery zone, opening hours, and this month's pause log` },
            when: { ar: 'خلال 48 ساعة', en: 'within 48 hours' },
            expectedImpact: null,
          },
        ],
      })
    }
  }
  // Branch × hour: an hour where one branch underperforms its own daily share.
  if (cube.hourlyByBranchAvailable !== false && Object.keys(cube.hourlyByBranch ?? {}).length > 0) {
    const companyHour = new Map(cube.hourlySeries.map((h) => [h.hour, h.netKwd]))
    const companyTotal = cube.totals.netSalesKwd
    let worst: { id: string; hour: number; share: number; dayShare: number; branchHour: number; companyHour: number } | null = null
    for (const [id, hours] of Object.entries(cube.hourlyByBranch)) {
      const dayShare = (cube.byBranch as Record<string, { netKwd: number }>)[id]?.netKwd / companyTotal
      if (!dayShare || dayShare < 0.05) continue
      for (const h of hours) {
        const ch = companyHour.get(h.hour) ?? 0
        if (ch < companyTotal * 0.05) continue // only real trading hours
        const share = h.netKwd / ch
        if (!worst || share / dayShare < worst.share / worst.dayShare) worst = { id, hour: h.hour, share, dayShare, branchHour: h.netKwd, companyHour: ch }
      }
    }
    if (worst && worst.share / worst.dayShare <= 0.6) {
      const lbl = branchLabel(worst.id)
      const missing = worst.dayShare * worst.companyHour - worst.branchHour
      out.push({
        fingerprint: `cfo:hour-gap:${worst.id}:${worst.hour}`,
        advisorId: 'cfo',
        kind: 'hour-gap',
        entities: { branchId: worst.id, hour: worst.hour },
        titleAr: `${lbl.ar} تختفي الساعة ${String(worst.hour).padStart(2, '0')}:00: حصتها ${r1(worst.share * 100).toFixed(1)}% مقابل ${r1(worst.dayShare * 100).toFixed(1)}% في بقية اليوم`,
        titleEn: `${lbl.en} disappears at ${String(worst.hour).padStart(2, '0')}:00: ${r1(worst.share * 100).toFixed(1)}% share vs ${r1(worst.dayShare * 100).toFixed(1)}% across the day`,
        evidence: [
          evidence({ odooModel: POS, domain: `branch=${worst.id}, hour=${worst.hour}`, period, value: worst.branchHour, unit: 'KWD', syncAt, labelAr: `${lbl.ar} في هذه الساعة`, labelEn: `${lbl.en} in this hour` }),
          evidence({ odooModel: POS, domain: `company, hour=${worst.hour}`, period, value: worst.companyHour, unit: 'KWD', syncAt, labelAr: 'الشركة في هذه الساعة', labelEn: 'Company in this hour' }),
          evidence({ odooModel: POS, domain: `branch=${worst.id}, hour=${worst.hour}`, period, value: r1(worst.share * 100), unit: 'pct', syncAt, labelAr: 'حصة الفرع في هذه الساعة', labelEn: 'Branch share in this hour' }),
          evidence({ odooModel: POS, domain: `branch=${worst.id}`, period, value: r1(worst.dayShare * 100), unit: 'pct', syncAt, labelAr: 'حصة الفرع من اليوم', labelEn: 'Branch share of the day' }),
        ],
        rootCause: { ar: 'فجوة ساعة واحدة تعني غالباً تغيير وردية أو توقف منصة في تلك الساعة.', en: 'A one-hour gap usually means a shift change or a platform pause in that hour.' },
        severity: 'medium',
        novelty: clamp01(1 - worst.share / worst.dayShare),
        weeklyImpact: estimate((missing * 7) / Math.max(1, cube.days), 'KWD', '(branch day share × company hour net − branch hour net) × 7 ÷ days', { branchDaySharePct: r1(worst.dayShare * 100), companyHourKwd: worst.companyHour, branchHourKwd: worst.branchHour, days: cube.days }),
        proposals: [
          {
            who: { ar: `مدير فرع ${lbl.ar}`, en: `${lbl.en} branch manager` },
            what: { ar: `تثبيت تسليم الوردية بعيداً عن الساعة ${String(worst.hour).padStart(2, '0')}:00 والتأكد أن المنصات مفتوحة طوال الساعة`, en: `move the shift handover away from ${String(worst.hour).padStart(2, '0')}:00 and keep the platforms open through that hour` },
            when: { ar: 'من الأسبوع القادم', en: 'from next week' },
            expectedImpact: null,
          },
        ],
      })
    }
  }
  // Dying SKUs: products that lost most of their sales vs the prior equal window.
  if (priorCube && priorCube.topProducts?.length && cube.topProducts?.length) {
    const now = new Map(cube.topProducts.map((p) => [p.productId, p]))
    const dying = priorCube.topProducts
      .filter((p) => p.netKwd >= priorCube.totals.netSalesKwd * 0.005)
      .map((p) => ({ p, nowKwd: now.get(p.productId)?.netKwd ?? 0 }))
      .filter((r) => r.nowKwd <= r.p.netKwd * 0.5)
      .sort((a, b) => (b.p.netKwd - b.nowKwd) - (a.p.netKwd - a.nowKwd))[0]
    if (dying) {
      out.push({
        fingerprint: `cfo:dying-sku:${dying.p.productId}`,
        advisorId: 'cfo',
        kind: 'dying-sku',
        entities: { brandId: dying.p.brandId ?? undefined },
        titleAr: `صنف يتلاشى: «${dying.p.name}» فقد ${r1((1 - dying.nowKwd / dying.p.netKwd) * 100).toFixed(1)}% من مبيعاته`,
        titleEn: `Dying item: “${dying.p.name}” lost ${r1((1 - dying.nowKwd / dying.p.netKwd) * 100).toFixed(1)}% of its sales`,
        evidence: [
          evidence({ odooModel: 'pos.order.line', domain: `product=${dying.p.productId}`, period: priorCube.dateRange, value: dying.p.netKwd, unit: 'KWD', syncAt: priorCube.lastSyncAt, labelAr: 'الفترة السابقة', labelEn: 'Prior window' }),
          evidence({ odooModel: 'pos.order.line', domain: `product=${dying.p.productId}`, period, value: dying.nowKwd, unit: 'KWD', syncAt, labelAr: 'الفترة الحالية', labelEn: 'Current window' }),
          evidence({ odooModel: 'pos.order.line', domain: `product=${dying.p.productId}`, period, value: r1((1 - dying.nowKwd / dying.p.netKwd) * 100), unit: 'pct', syncAt, labelAr: 'نسبة الفقد', labelEn: 'Share lost' }),
        ],
        rootCause: { ar: 'صنف كان مطلوباً ثم اختفى: توفر، تغيّر في الوصفة أو السعر، أو أُخفي من المنيو على المنصات.', en: 'An item that sold well then vanished: availability, a recipe or price change, or it was hidden from the platform menus.' },
        severity: 'medium',
        novelty: clamp01(1 - dying.nowKwd / dying.p.netKwd),
        weeklyImpact: estimate(((dying.p.netKwd - dying.nowKwd) * 7) / Math.max(1, cube.days), 'KWD', '(prior net − current net) × 7 ÷ days', { priorNetKwd: dying.p.netKwd, currentNetKwd: dying.nowKwd, days: cube.days }),
        proposals: [
          {
            who: { ar: `الشيف التنفيذي لـ${dying.p.brandId ? brandLabel(dying.p.brandId).ar : 'العلامة'}`, en: `${dying.p.brandId ? brandLabel(dying.p.brandId).en : 'Brand'} executive chef` },
            what: { ar: 'التحقق من توفر الصنف وظهوره على طلبات وكيتا، ثم قرار واضح: إعادة إطلاق أو حذف لتقليل الهدر', en: 'check the item is in stock and visible on Talabat / Keeta, then decide: relaunch or remove to cut waste' },
            when: { ar: 'هذا الأسبوع', en: 'this week' },
            expectedImpact: null,
          },
        ],
      })
    }
  }
  // Aggregator exposure (commission rates are not in Odoo).
  const aggNet = AGGREGATOR_CHANNELS.reduce((s, ch) => s + (cube.byChannel[ch]?.netKwd ?? 0), 0)
  if (aggNet > 0 && cube.totals.netSalesKwd > 0) {
    const share = r1((aggNet / cube.totals.netSalesKwd) * 100)
    const topCh = [...AGGREGATOR_CHANNELS].sort((a, b) => (cube.byChannel[b]?.netKwd ?? 0) - (cube.byChannel[a]?.netKwd ?? 0))[0]
    out.push({
      fingerprint: 'cfo:aggregator-exposure',
      advisorId: 'cfo',
      kind: 'aggregator-exposure',
      entities: { channel: topCh },
      titleAr: `${share.toFixed(1)}% من المبيعات تمر عبر منصات التوصيل (أكبرها ${channelLabel(topCh).ar})`,
      titleEn: `${share.toFixed(1)}% of sales go through delivery platforms (largest: ${channelLabel(topCh).en})`,
      evidence: [
        evidence({ odooModel: 'pos.payment', domain: 'aggregator channels', period, value: aggNet, unit: 'KWD', syncAt, labelAr: 'صافي مبيعات المنصات', labelEn: 'Aggregator net sales' }),
        evidence({ odooModel: POS, domain: 'company', period, value: cube.totals.netSalesKwd, unit: 'KWD', syncAt, labelAr: 'صافي مبيعات الشركة', labelEn: 'Company net sales' }),
        evidence({ odooModel: 'pos.payment', domain: 'aggregator share of company', period, value: share, unit: 'pct', syncAt, labelAr: 'حصة المنصات', labelEn: 'Aggregator share' }),
      ],
      rootCause: { ar: 'كل دينار عبر المنصات يدفع عمولة؛ نسب العمولة غير مسجلة في Odoo.', en: 'Every dinar through the platforms pays commission; commission rates are not recorded in Odoo.' },
      severity: share >= 60 ? 'medium' : 'low',
      novelty: 0.2,
      weeklyImpact: null,
      proposals: [
        {
          who: { ar: 'المدير المالي', en: 'Finance manager' },
          what: { ar: 'تسجيل نسبة عمولة كل منصة في ملف سياق الشركة لحساب كلفة العمولة الحقيقية لكل فرع', en: 'record each platform’s commission rate in the company context file so the real commission cost per branch can be computed' },
          when: { ar: 'هذا الأسبوع', en: 'this week' },
          expectedImpact: null,
        },
      ],
    })
  }
  return out
}

export const cfoAdvisor: Advisor<CfoInput> = {
  id: 'cfo',
  domainAr: 'المالية والمبيعات',
  domainEn: 'Finance & sales',
  run(input: CfoInput): AdvisorReport {
    const gaps: CouncilDataGap[] = []
    const daily = completedDailyByBranch(input.summary)
    const findings: CouncilFinding[] = []
    if (daily) {
      findings.push(...weekOverWeek(daily), ...basketShrink(daily), ...weekdayGap(daily))
    } else {
      gaps.push({ odooModel: 'pos.order', missingAr: 'لا توجد صفوف مبيعات يومية مكتملة لكل فرع في البيانات الحالية.', missingEn: 'No completed per-branch daily sales rows in the current payload.', recordAr: 'مزامنة Odoo (pos.order) لآخر 8 أسابيع على الأقل.', recordEn: 'An Odoo sync (pos.order) covering at least the last 8 weeks.' })
    }
    if (input.cube && input.cube.connected) {
      findings.push(...cubeFindings(input.cube, input.priorCube))
    } else {
      gaps.push({ odooModel: 'pos.order.line / pos.payment', missingAr: 'مكعّب الفترة (العلامة × الفرع × الساعة × القناة × الصنف) غير متوفر في هذه البيانات.', missingEn: 'The period cube (brand × branch × hour × channel × product) is not in this payload.', recordAr: 'قراءة مكعّب الفترة من Odoo (تتم تلقائياً عند الاتصال).', recordEn: 'A period-cube read from Odoo (automatic when connected).' })
    }
    if (!input.glClosedThrough) {
      gaps.push({ odooModel: 'res.company (period_lock_date)', missingAr: 'لا يوجد شهر مقفل محاسبياً معروف، لذلك لا يُعرض صافي الربح.', missingEn: 'No known GL-locked month, so net profit is not reported.', recordAr: 'إقفال الشهر في المحاسبة (تاريخ قفل الفترة) بعد اعتماد القيود.', recordEn: 'Lock the month in accounting (period lock date) once entries are approved.' })
    }
    const period = daily ? { from: daily.days[0], to: daily.days[daily.days.length - 1] } : input.cube?.dateRange ?? null
    return {
      advisorId: 'cfo',
      domainAr: this.domainAr,
      domainEn: this.domainEn,
      period,
      generatedAt: input.summary?.lastSyncAt ?? input.cube?.lastSyncAt ?? null,
      status: findings.length === 0 && gaps.length > 0 && !daily ? 'unavailable' : gaps.length > 0 ? 'partial' : 'ready',
      findings,
      dataGaps: gaps,
    }
  },
}
