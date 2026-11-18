/**
 * Sales drivers advisor — "why did sales move?".
 *
 * Splits the change in net sales between two equal completed windows into
 *   (1) an orders effect and a basket (AOV) effect — exact midpoint split, the parts add up to Δ;
 *   (2) the contribution of each branch, channel and brand — the contributions add up to Δ.
 * It then names the segment that explains most of the move and proposes the action that fits the
 * dominant effect (traffic actions for an orders effect, basket actions for an AOV effect).
 *
 * Source: the live period cubes (branch × channel × brand) when connected; otherwise the payload's
 * completed per-branch daily rows (branches only — channel and brand become data gaps).
 */
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import { splitOrdersAov } from '../analytics'
import { branchLabel, brandLabel, channelLabel, clamp01, estimate, evidence, fromFils, r1, toFils } from '../helpers'
import { completedDailyByBranch, lastTwoWindows, sumWindow } from '../series'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilEvidence, CouncilFinding, CouncilProposal } from '../types'

export interface DriversInput {
  summary: OdooLiveSummary | null
  cube?: OdooPeriodCube | null
  priorCube?: OdooPeriodCube | null
}

const POS = 'pos.order'
/** A segment must explain at least this share of the company move to be named as its driver. */
export const DRIVER_MIN_SHARE = 0.4
/** …and move at least this much against its own prior window. */
export const DRIVER_MIN_OWN_PCT = 3
/** The company move must be at least this large (%) to be worth explaining. */
export const COMPANY_MIN_PCT = 2

export interface Segment {
  kind: 'branch' | 'channel' | 'brand'
  id: string
  a: { netFils: number; orders: number | null }
  b: { netFils: number; orders: number | null }
}

export interface DriverWindows {
  a: { from: string; to: string }
  b: { from: string; to: string }
  days: number
  syncAt: string | null
  total: { a: { netFils: number; orders: number }; b: { netFils: number; orders: number } }
  segments: Segment[]
  source: 'cube' | 'daily'
}

function fromCubes(cube: OdooPeriodCube, prior: OdooPeriodCube): DriverWindows | null {
  if (!cube.connected || !prior.connected || cube.days !== prior.days || cube.days <= 0) return null
  const segments: Segment[] = []
  const branchIds = new Set([...Object.keys(cube.byBranch ?? {}), ...Object.keys(prior.byBranch ?? {})])
  for (const id of [...branchIds].sort()) {
    const ca = (cube.byBranch as Record<string, { netKwd: number; orders: number } | undefined>)[id]
    const cb = (prior.byBranch as Record<string, { netKwd: number; orders: number } | undefined>)[id]
    segments.push({ kind: 'branch', id, a: { netFils: toFils(ca?.netKwd ?? 0), orders: ca?.orders ?? 0 }, b: { netFils: toFils(cb?.netKwd ?? 0), orders: cb?.orders ?? 0 } })
  }
  if ((cube.unattributed?.netKwd ?? 0) !== 0 || (prior.unattributed?.netKwd ?? 0) !== 0) {
    segments.push({ kind: 'branch', id: 'unattributed', a: { netFils: toFils(cube.unattributed.netKwd), orders: cube.unattributed.orders }, b: { netFils: toFils(prior.unattributed.netKwd), orders: prior.unattributed.orders } })
  }
  const chA = Object.values(cube.byChannel ?? {}).reduce((s, c) => s + (c?.netKwd ?? 0), 0)
  const chB = Object.values(prior.byChannel ?? {}).reduce((s, c) => s + (c?.netKwd ?? 0), 0)
  if (chA > 0 && chB > 0) {
    for (const id of Object.keys(cube.byChannel).sort()) {
      const ca = cube.byChannel[id as keyof typeof cube.byChannel]
      const cb = prior.byChannel[id as keyof typeof prior.byChannel]
      segments.push({ kind: 'channel', id, a: { netFils: toFils(ca?.netKwd ?? 0), orders: ca?.orders ?? 0 }, b: { netFils: toFils(cb?.netKwd ?? 0), orders: cb?.orders ?? 0 } })
    }
  }
  const brA = Object.values(cube.byBrand ?? {}).reduce((s, c) => s + (c?.netKwd ?? 0), 0)
  const brB = Object.values(prior.byBrand ?? {}).reduce((s, c) => s + (c?.netKwd ?? 0), 0)
  if (brA > 0 && brB > 0) {
    for (const id of Object.keys(cube.byBrand).sort()) {
      const ca = cube.byBrand[id as keyof typeof cube.byBrand]
      const cb = prior.byBrand[id as keyof typeof prior.byBrand]
      segments.push({ kind: 'brand', id, a: { netFils: toFils(ca?.netKwd ?? 0), orders: ca?.orders ?? null }, b: { netFils: toFils(cb?.netKwd ?? 0), orders: cb?.orders ?? null } })
    }
  }
  return {
    a: cube.dateRange,
    b: prior.dateRange,
    days: cube.days,
    syncAt: cube.lastSyncAt ?? null,
    total: { a: { netFils: toFils(cube.totals.netSalesKwd), orders: cube.totals.orders }, b: { netFils: toFils(prior.totals.netSalesKwd), orders: prior.totals.orders } },
    segments,
    source: 'cube',
  }
}

function fromDaily(summary: OdooLiveSummary | null, n = 7): DriverWindows | null {
  const d = completedDailyByBranch(summary)
  if (!d) return null
  const w = lastTwoWindows(d, n)
  if (!w) return null
  const ta = sumWindow(d, w.a.from, w.a.to)
  const tb = sumWindow(d, w.b.from, w.b.to)
  return {
    a: w.a,
    b: w.b,
    days: n,
    syncAt: d.syncAt,
    total: { a: { netFils: ta.netFils, orders: ta.orders }, b: { netFils: tb.netFils, orders: tb.orders } },
    segments: d.branchIds.map((id) => {
      const sa = sumWindow(d, w.a.from, w.a.to, id)
      const sb = sumWindow(d, w.b.from, w.b.to, id)
      return { kind: 'branch' as const, id, a: { netFils: sa.netFils, orders: sa.orders }, b: { netFils: sb.netFils, orders: sb.orders } }
    }),
    source: 'daily',
  }
}

/** The two windows to compare: live cubes when available, else the payload's daily rows. */
export function driverWindows(input: DriversInput): DriverWindows | null {
  if (input.cube && input.priorCube) {
    const c = fromCubes(input.cube, input.priorCube)
    if (c) return c
  }
  return fromDaily(input.summary)
}

export interface ContributionRow {
  kind: Segment['kind']
  id: string
  deltaFils: number
  /** Share of the company Δ (signed; > 1 when other segments moved the other way). */
  shareOfDelta: number
  ownPct: number | null
  ordersEffectFils: number | null
  basketEffectFils: number | null
}

/** Per-segment contributions; within one kind they add up to the company Δ (to the fils). */
export function contributions(w: DriverWindows, kind: Segment['kind']): ContributionRow[] {
  const total = w.total.a.netFils - w.total.b.netFils
  return w.segments
    .filter((s) => s.kind === kind)
    .map((s) => {
      const delta = s.a.netFils - s.b.netFils
      const split = s.a.orders !== null && s.b.orders !== null ? splitOrdersAov({ netFils: s.a.netFils, orders: s.a.orders }, { netFils: s.b.netFils, orders: s.b.orders }) : null
      return {
        kind,
        id: s.id,
        deltaFils: delta,
        shareOfDelta: total !== 0 ? delta / total : 0,
        ownPct: s.b.netFils > 0 ? r1((delta / s.b.netFils) * 100) : null,
        ordersEffectFils: split?.ordersEffectFils ?? null,
        basketEffectFils: split?.basketEffectFils ?? null,
      }
    })
    .sort((x, y) => Math.abs(y.deltaFils) - Math.abs(x.deltaFils) || x.id.localeCompare(y.id))
}

const label = (kind: Segment['kind'], id: string) =>
  kind === 'branch' ? (id === 'unattributed' ? { ar: 'غير منسوب لفرع', en: 'Unattributed' } : branchLabel(id)) : kind === 'channel' ? channelLabel(id) : brandLabel(id)

const MODEL: Record<Segment['kind'], string> = { branch: POS, channel: 'pos.payment', brand: 'pos.order.line' }

function proposalsFor(kind: Segment['kind'], name: { ar: string; en: string }, effect: 'orders' | 'basket' | null, down: boolean, weeklyKwd: number): CouncilProposal[] {
  if (!down) {
    return [
      {
        who: { ar: kind === 'branch' ? `مدير فرع ${name.ar}` : 'مدير التسويق', en: kind === 'branch' ? `${name.en} manager` : 'Marketing manager' },
        what: {
          ar: `توثيق ما رفع ${effect === 'basket' ? 'متوسط الفاتورة' : 'عدد الطلبات'} في ${name.ar} وتطبيقه تجريبياً على أضعف وحدة مماثلة لمدة أسبوعين`,
          en: `document what lifted ${effect === 'basket' ? 'the basket' : 'order count'} at ${name.en} and pilot it at the weakest comparable unit for two weeks`,
        },
        when: { ar: 'الأسبوع القادم', en: 'next week' },
        expectedImpact: null,
      },
    ]
  }
  const recover = estimate(weeklyKwd * 0.5, 'KWD', '50% × weekly drop of the segment', { weeklyDropKwd: weeklyKwd, recoveryShare: 0.5 })
  if (effect === 'basket') {
    return [
      {
        who: { ar: kind === 'branch' ? `مدير فرع ${name.ar}` : 'مدير التسويق', en: kind === 'branch' ? `${name.en} manager` : 'Marketing manager' },
        what: {
          ar: `الطلبات ثابتة لكن الفاتورة أصغر في ${name.ar}: تفعيل البيع الإضافي (مشروب/حلى مع الطبق الرئيسي) ومراجعة الخصومات وحد أدنى للطلب على المنصات`,
          en: `orders held but baskets shrank at ${name.en}: switch on upsell (drink / dessert with mains), review discounts, and set a platform minimum basket`,
        },
        when: { ar: 'خلال 7 أيام', en: 'within 7 days' },
        expectedImpact: recover,
      },
    ]
  }
  return [
    {
      who: { ar: kind === 'branch' ? `مدير فرع ${name.ar}` : 'مدير منصات التوصيل', en: kind === 'branch' ? `${name.en} manager` : 'Delivery platforms manager' },
      what: {
        ar: `عدد الطلبات هو ما تراجع في ${name.ar}: مراجعة ساعات التوقف والترتيب على المنصات وزمن التحضير، وحملة استرجاع للعملاء في أيام التراجع`,
        en: `order count is what fell at ${name.en}: review platform pause hours, ranking and prep time, and run a win-back push on the weak days`,
      },
      when: { ar: 'خلال 48 ساعة', en: 'within 48 hours' },
      expectedImpact: recover,
    },
  ]
}

function driverFinding(w: DriverWindows, row: ContributionRow, companyPct: number): CouncilFinding {
  const name = label(row.kind, row.id)
  const down = row.deltaFils < 0
  const dominant: 'orders' | 'basket' | null =
    row.ordersEffectFils === null || row.basketEffectFils === null ? null : Math.abs(row.ordersEffectFils) >= Math.abs(row.basketEffectFils) ? 'orders' : 'basket'
  const weeklyKwd = fromFils(Math.abs(row.deltaFils)) * (7 / w.days)
  const sharePct = r1(row.shareOfDelta * 100)
  const seg = w.segments.find((s) => s.kind === row.kind && s.id === row.id)!
  const domain = `${row.kind}=${row.id}`
  const ev: CouncilEvidence[] = [
    evidence({ odooModel: MODEL[row.kind], domain, period: w.a, value: fromFils(seg.a.netFils), unit: 'KWD', syncAt: w.syncAt, labelAr: `صافي ${name.ar} (الفترة الأخيرة)`, labelEn: `${name.en} net (latest window)` }),
    evidence({ odooModel: MODEL[row.kind], domain, period: w.b, value: fromFils(seg.b.netFils), unit: 'KWD', syncAt: w.syncAt, labelAr: `صافي ${name.ar} (الفترة السابقة)`, labelEn: `${name.en} net (prior window)` }),
    evidence({ odooModel: MODEL[row.kind], domain: `${domain} share of company Δ`, period: w.a, value: sharePct, unit: 'pct', syncAt: w.syncAt, labelAr: 'نصيبه من تغيّر الشركة', labelEn: 'Share of the company change' }),
    evidence({ odooModel: POS, domain: 'all company sales', period: w.a, value: companyPct, unit: 'pct', syncAt: w.syncAt, labelAr: 'تغيّر الشركة', labelEn: 'Company change' }),
  ]
  if (row.ordersEffectFils !== null && row.basketEffectFils !== null) {
    ev.push(
      evidence({ odooModel: MODEL[row.kind], domain: `${domain}, Δorders × average basket`, period: w.a, value: fromFils(row.ordersEffectFils), unit: 'KWD', syncAt: w.syncAt, labelAr: 'أثر عدد الطلبات', labelEn: 'Orders effect' }),
      evidence({ odooModel: MODEL[row.kind], domain: `${domain}, Δbasket × average orders`, period: w.a, value: fromFils(row.basketEffectFils), unit: 'KWD', syncAt: w.syncAt, labelAr: 'أثر متوسط الفاتورة', labelEn: 'Basket (AOV) effect' }),
    )
  }
  const effAr = dominant === 'orders' ? 'بسبب عدد الطلبات أساساً' : dominant === 'basket' ? 'بسبب حجم الفاتورة أساساً' : ''
  const effEn = dominant === 'orders' ? 'mainly through order count' : dominant === 'basket' ? 'mainly through basket size' : ''
  return {
    fingerprint: `drivers:${row.kind}:${row.id}:${down ? 'down' : 'up'}`,
    advisorId: 'drivers',
    kind: `${row.kind}-driver-${down ? 'down' : 'up'}`,
    entities: row.kind === 'branch' ? (row.id === 'unattributed' ? {} : { branchId: row.id }) : row.kind === 'channel' ? { channel: row.id } : { brandId: row.id },
    titleAr: `${name.ar} تفسّر ${Math.abs(sharePct).toFixed(1)}% من ${down ? 'تراجع' : 'نمو'} المبيعات${effAr ? ` — ${effAr}` : ''}`,
    titleEn: `${name.en} explains ${Math.abs(sharePct).toFixed(1)}% of the sales ${down ? 'drop' : 'rise'}${effEn ? ` — ${effEn}` : ''}`,
    evidence: ev,
    thresholds: { minShareOfChangePct: DRIVER_MIN_SHARE * 100, minOwnChangePct: DRIVER_MIN_OWN_PCT, windowDays: w.days },
    rootCause: {
      ar: `التغيّر مركّز في ${name.ar} وليس موزعاً على الشركة؛ ${dominant === 'basket' ? 'عدد الطلبات قريب من السابق والفاتورة هي التي تغيّرت (خصومات، مزيج أصناف، بيع إضافي).' : dominant === 'orders' ? 'متوسط الفاتورة قريب من السابق والطلبات هي التي تغيّرت (ظهور على المنصات، توقف، طاقة الذروة، طلب السوق).' : 'تفصيل الطلبات غير متوفر لهذا القسم.'}`,
      en: `The change is concentrated in ${name.en}, not spread across the company; ${dominant === 'basket' ? 'order count is close to before and the basket is what changed (discounts, item mix, upsell).' : dominant === 'orders' ? 'the basket is close to before and order count is what changed (platform visibility, pauses, peak capacity, demand).' : 'an order split is not available for this section.'}`,
    },
    severity: down && Math.abs(row.ownPct ?? 0) >= 15 ? 'high' : down ? 'medium' : 'low',
    novelty: clamp01(Math.abs(row.shareOfDelta) * (Math.abs(row.ownPct ?? 0) / 20)),
    weeklyImpact: down ? estimate(weeklyKwd, 'KWD', '|segment Δ| × 7 ÷ window days', { segmentDeltaKwd: fromFils(Math.abs(row.deltaFils)), windowDays: w.days }) : null,
    proposals: proposalsFor(row.kind, name, dominant, down, weeklyKwd),
  }
}

function companyFinding(w: DriverWindows, companyPct: number): CouncilFinding | null {
  const split = splitOrdersAov(w.total.a, w.total.b)
  if (!split) return null
  const down = split.deltaFils < 0
  const domOrders = Math.abs(split.ordersEffectFils) >= Math.abs(split.basketEffectFils)
  return {
    fingerprint: `drivers:company:${w.a.from}`,
    advisorId: 'drivers',
    kind: 'company-split',
    entities: {},
    titleAr: `المبيعات ${companyPct >= 0 ? '+' : ''}${companyPct.toFixed(1)}%: أثر الطلبات ${fromFils(split.ordersEffectFils).toFixed(3)} د.ك وأثر الفاتورة ${fromFils(split.basketEffectFils).toFixed(3)} د.ك`,
    titleEn: `Sales ${companyPct >= 0 ? '+' : ''}${companyPct.toFixed(1)}%: orders effect ${fromFils(split.ordersEffectFils).toFixed(3)} KWD, basket effect ${fromFils(split.basketEffectFils).toFixed(3)} KWD`,
    evidence: [
      evidence({ odooModel: POS, domain: 'all company sales', period: w.a, value: fromFils(w.total.a.netFils), unit: 'KWD', syncAt: w.syncAt, labelAr: 'صافي الفترة الأخيرة', labelEn: 'Net, latest window' }),
      evidence({ odooModel: POS, domain: 'all company sales', period: w.b, value: fromFils(w.total.b.netFils), unit: 'KWD', syncAt: w.syncAt, labelAr: 'صافي الفترة السابقة', labelEn: 'Net, prior window' }),
      evidence({ odooModel: POS, domain: 'all company sales', period: w.a, value: companyPct, unit: 'pct', syncAt: w.syncAt, labelAr: 'تغيّر الشركة', labelEn: 'Company change' }),
      evidence({ odooModel: POS, domain: 'Δorders × average basket', period: w.a, value: fromFils(split.ordersEffectFils), unit: 'KWD', syncAt: w.syncAt, labelAr: 'أثر عدد الطلبات', labelEn: 'Orders effect' }),
      evidence({ odooModel: POS, domain: 'Δbasket × average orders', period: w.a, value: fromFils(split.basketEffectFils), unit: 'KWD', syncAt: w.syncAt, labelAr: 'أثر متوسط الفاتورة', labelEn: 'Basket (AOV) effect' }),
      evidence({ odooModel: POS, domain: 'all company orders', period: w.a, value: w.total.a.orders, unit: 'orders', syncAt: w.syncAt, labelAr: 'الطلبات (الفترة الأخيرة)', labelEn: 'Orders (latest window)' }),
      evidence({ odooModel: POS, domain: 'all company orders', period: w.b, value: w.total.b.orders, unit: 'orders', syncAt: w.syncAt, labelAr: 'الطلبات (الفترة السابقة)', labelEn: 'Orders (prior window)' }),
    ],
    thresholds: { windowDays: w.days },
    rootCause: {
      ar: domOrders ? 'معظم التغيّر جاء من عدد الطلبات (الحركة)، لا من حجم الفاتورة.' : 'معظم التغيّر جاء من حجم الفاتورة (المزيج والخصومات)، لا من عدد الطلبات.',
      en: domOrders ? 'Most of the change came from order count (traffic), not basket size.' : 'Most of the change came from basket size (mix and discounts), not order count.',
    },
    severity: down && companyPct <= -10 ? 'high' : down ? 'medium' : 'low',
    novelty: clamp01(Math.abs(companyPct) / 25),
    weeklyImpact: null,
    proposals: [],
  }
}

export const driversAdvisor: Advisor<DriversInput> = {
  id: 'drivers',
  domainAr: 'محرّكات تغيّر المبيعات',
  domainEn: 'Sales drivers',
  run(input: DriversInput): AdvisorReport {
    const gaps: CouncilDataGap[] = []
    const findings: CouncilFinding[] = []
    const w = driverWindows(input)
    if (!w) {
      gaps.push({ odooModel: 'pos.order', missingAr: 'لا توجد فترتان مكتملتان متساويتان للمقارنة.', missingEn: 'No two equal completed windows to compare.', recordAr: 'مزامنة Odoo (pos.order) لآخر أسبوعين على الأقل.', recordEn: 'An Odoo sync (pos.order) covering at least the last two weeks.' })
    } else {
      if (w.source === 'daily') {
        gaps.push({ odooModel: 'pos.payment / pos.order.line', missingAr: 'تفصيل القنوات والعلامات للفترتين غير متوفر في هذه البيانات؛ التحليل على مستوى الفروع فقط.', missingEn: 'The channel and brand split for both windows is not in this payload; the analysis is branch-level only.', recordAr: 'قراءة مكعّب الفترة من Odoo (تلقائية عند الاتصال).', recordEn: 'A period-cube read from Odoo (automatic when connected).' })
      }
      const total = w.total.a.netFils - w.total.b.netFils
      const companyPct = w.total.b.netFils > 0 ? r1((total / w.total.b.netFils) * 100) : null
      if (companyPct !== null && Math.abs(companyPct) >= COMPANY_MIN_PCT) {
        const c = companyFinding(w, companyPct)
        if (c) findings.push(c)
        for (const kind of ['branch', 'channel', 'brand'] as const) {
          const top = contributions(w, kind).find((r) => Math.sign(r.deltaFils) === Math.sign(total))
          if (top && top.shareOfDelta >= DRIVER_MIN_SHARE && Math.abs(top.ownPct ?? 0) >= DRIVER_MIN_OWN_PCT) findings.push(driverFinding(w, top, companyPct))
        }
      }
    }
    return {
      advisorId: 'drivers',
      domainAr: this.domainAr,
      domainEn: this.domainEn,
      period: w ? { from: w.b.from, to: w.a.to } : null,
      generatedAt: w?.syncAt ?? input.summary?.lastSyncAt ?? null,
      status: !w ? 'unavailable' : gaps.length > 0 ? 'partial' : 'ready',
      findings,
      dataGaps: gaps,
    }
  },
}
