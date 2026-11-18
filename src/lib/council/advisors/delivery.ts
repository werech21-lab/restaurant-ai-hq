/**
 * Delivery-platforms advisor — Talabat (TGO / TMP) and Keeta health per branch.
 *
 * Pause / offline detection uses the 5-week branch × Kuwait hour × channel matrix read live from
 * Odoo (`pos.payment` grouped by register × payment hour × payment method). An hour is a suspected
 * pause when an aggregator (`talabat-tgo`, `talabat-tmp`, or `keeta`) has 0 payouts in that hour
 * while direct in-branch sales (`dine-in` / `takeaway-direct`) continue (`directOrders > 0`), and
 * the same weekday-hour across the prior weeks had payouts on that platform.
 * Lost sales are emitted strictly as a labelled `Estimate` with explicit formula and inputs,
 * split by TGO vs TMP vs Keeta.
 */
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import {
  WEEKDAY_AR,
  WEEKDAY_EN,
  branchLabel,
  channelLabel,
  clamp01,
  estimate,
  evidence,
  fromFils,
  median,
  pctChange,
  r1,
  r3,
  shiftIso,
  toFils,
  weekdayOf,
} from '../helpers'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilFinding } from '../types'

export const PLATFORM_CHANNELS = ['talabat-tgo', 'talabat-tmp', 'keeta'] as const
export type PlatformChannel = (typeof PLATFORM_CHANNELS)[number]

/** Direct in-branch / non-aggregator POS payment channels proving the branch was actively selling. */
export const DIRECT_CHANNELS: ReadonlySet<string> = new Set(['dine-in', 'takeaway-direct', 'direct'])

export interface AggregatorHourlyCell {
  day: string
  hour: number
  branchId: string
  channel: string
  orders: number
  netKwd: number
}

export interface AggregatorHourlyMatrix {
  rows: AggregatorHourlyCell[]
  period: { from: string; to: string }
  syncAt: string | null
}

export interface DeliveryInput {
  cube?: OdooPeriodCube | null
  priorCube?: OdooPeriodCube | null
  matrix?: AggregatorHourlyMatrix | null
  /** Weeks of same weekday-hour history required before an hour can be called a pause. */
  historyWeeks?: number
}

export interface Pause {
  branchId: string
  channel: PlatformChannel
  day: string
  hour: number
  directOrders: number
  directNetKwd: number
  historyNet: number[]
  historyOrders: number[]
  estimatedLostFils: number
}

export function detectPauses(matrix: AggregatorHourlyMatrix, historyWeeks = 4): Pause[] {
  const key = (day: string, hour: number, branch: string, ch: string) => `${day}|${hour}|${branch}|${ch}`
  const cells = new Map<string, { orders: number; netFils: number }>()
  const branchHourDirect = new Map<string, { orders: number; netFils: number }>()
  const days = new Set<string>()
  const branches = new Set<string>()

  for (const r of matrix.rows) {
    const k = key(r.day, r.hour, r.branchId, r.channel)
    const prev = cells.get(k) ?? { orders: 0, netFils: 0 }
    prev.orders += r.orders
    prev.netFils += toFils(r.netKwd)
    cells.set(k, prev)

    if (DIRECT_CHANNELS.has(r.channel) && r.orders > 0) {
      const bh = `${r.day}|${r.hour}|${r.branchId}`
      const d = branchHourDirect.get(bh) ?? { orders: 0, netFils: 0 }
      d.orders += r.orders
      d.netFils += toFils(r.netKwd)
      branchHourDirect.set(bh, d)
    }
    days.add(r.day)
    branches.add(r.branchId)
  }

  const sortedDays = [...days].sort()
  const out: Pause[] = []
  for (const day of sortedDays) {
    for (const branchId of [...branches].sort()) {
      for (let hour = 0; hour < 24; hour++) {
        const direct = branchHourDirect.get(`${day}|${hour}|${branchId}`)
        if (!direct || direct.orders <= 0) continue // no direct in-branch sales in this hour
        for (const channel of PLATFORM_CHANNELS) {
          const own = cells.get(key(day, hour, branchId, channel))?.orders ?? 0
          if (own > 0) continue
          const history = Array.from({ length: historyWeeks }, (_, i) => shiftIso(day, -7 * (i + 1)))
          if (history.some((d) => !days.has(d))) continue
          const hist = history.map((d) => cells.get(key(d, hour, branchId, channel)))
          const histOrders = hist.map((c) => c?.orders ?? 0)
          // Only a pause when the platform normally has payouts in this weekday-hour every prior week.
          if (histOrders.some((o) => o === 0)) continue
          const histNetFils = hist.map((c) => c?.netFils ?? 0)
          const medFils = Math.round(median(histNetFils))
          out.push({
            branchId,
            channel,
            day,
            hour,
            directOrders: direct.orders,
            directNetKwd: fromFils(direct.netFils),
            historyNet: histNetFils.map(fromFils),
            historyOrders: histOrders,
            estimatedLostFils: medFils,
          })
        }
      }
    }
  }
  return out
}

function selectTypicalPauseHour(list: readonly Pause[]): number {
  const byHour = new Map<number, { count: number; lostFils: number }>()
  for (const p of list) {
    const h = byHour.get(p.hour) ?? { count: 0, lostFils: 0 }
    h.count++
    h.lostFils += p.estimatedLostFils
    byHour.set(p.hour, h)
  }
  return [...byHour.entries()].sort((a, b) => b[1].count - a[1].count || b[1].lostFils - a[1].lostFils || a[0] - b[0])[0][0]
}

function pauseFindings(matrix: AggregatorHourlyMatrix, historyWeeks: number): CouncilFinding[] {
  const pauses = detectPauses(matrix, historyWeeks)
  const groups = new Map<string, Pause[]>()
  for (const p of pauses) {
    const k = `${p.branchId}|${p.channel}`
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  return [...groups.values()]
    .map((list) => {
      const { branchId, channel } = list[0]
      const lbl = branchLabel(branchId)
      const ch = channelLabel(channel)
      const lostFils = list.reduce((s, p) => s + p.estimatedLostFils, 0)
      const lost = fromFils(lostFils)
      const weeks = Math.max(
        1,
        (Date.parse(`${matrix.period.to}T00:00:00Z`) - Date.parse(`${matrix.period.from}T00:00:00Z`)) / (7 * 86_400_000) + 1 / 7,
      )
      const typicalHour = selectTypicalPauseHour(list)
      const hh = String(typicalHour).padStart(2, '0')
      const byWeekday = new Map<number, number>()
      for (const p of list) byWeekday.set(weekdayOf(p.day), (byWeekday.get(weekdayOf(p.day)) ?? 0) + 1)
      const topWd = [...byWeekday].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
      const directPayouts = list.reduce((s, p) => s + p.directOrders, 0)
      const weeklyLost = lost / weeks

      const finding: CouncilFinding = {
        fingerprint: `delivery:pause:${branchId}:${channel}`,
        advisorId: 'delivery',
        kind: 'platform-pause',
        entities: { branchId, channel, hour: typicalHour, weekday: topWd },
        titleAr: `توقف متكرر محتمل: ${ch.ar} في ${lbl.ar} — ${list.length} ساعة بصفر دفعات (أبرزها الساعة ${hh}:00) بينما المبيعات المباشرة مستمرة`,
        titleEn: `Probable repeated pause: ${ch.en} at ${lbl.en} — ${list.length} hours with 0 payouts (peaking at ${hh}:00) while direct in-branch sales continued`,
        evidence: [
          evidence({
            odooModel: 'pos.payment',
            domain: `branch=${branchId}, channel=${channel}, payouts=0 while direct in-branch payouts > 0`,
            period: matrix.period,
            value: list.length,
            unit: 'count',
            syncAt: matrix.syncAt,
            labelAr: 'ساعات التوقف المحتمل',
            labelEn: 'Suspected pause hours',
          }),
          evidence({
            odooModel: 'pos.payment',
            domain: `branch=${branchId}, direct in-branch channels in those hours`,
            period: matrix.period,
            value: directPayouts,
            unit: 'count',
            syncAt: matrix.syncAt,
            labelAr: 'الدفعات المباشرة في الفرع خلال نفس الساعات',
            labelEn: 'Direct in-branch payouts in the same hours',
          }),
          evidence({
            odooModel: 'pos.payment',
            domain: `branch=${branchId}, channel=${channel} in pause hours`,
            period: matrix.period,
            value: 0,
            unit: 'count',
            syncAt: matrix.syncAt,
            labelAr: `دفعات ${ch.ar} في ساعات التوقف`,
            labelEn: `${ch.en} payouts in pause hours`,
          }),
        ],
        rootCause: {
          ar: `الفرع كان مفتوحاً ويبيع مباشرة في الصالة/السفري، لكن دفعات ${ch.ar} كانت صفراً في ساعات اعتادت تسجيل دفعات كل أسبوع سابق — المتجر متوقف أو مخفي على المنصة، خصوصاً يوم ${WEEKDAY_AR[topWd]}.`,
          en: `The branch was open with active direct in-branch sales, yet ${ch.en} recorded zero payouts in hours that had payouts every prior week — the store was paused or hidden on the platform, mainly on ${WEEKDAY_EN[topWd]}s.`,
        },
        severity: list.length >= 6 ? 'high' : 'medium',
        thresholds: { typicalPauseHour: typicalHour, zeroPayouts: 0 },
        novelty: clamp01(list.length / 12),
        weeklyImpact: estimate(
          weeklyLost,
          'KWD',
          'Σ over pause hours of median(same weekday-hour platform net, last N weeks) ÷ weeks in window',
          { pauseHours: list.length, lostKwd: r3(lost), weeks: r1(weeks), historyWeeks },
        ),
        proposals: [
          {
            who: { ar: `مدير فرع ${lbl.ar}`, en: `${lbl.en} branch manager` },
            what: {
              ar: `تفعيل تنبيه فوري عند إيقاف ${ch.ar}، ومنع الإيقاف اليدوي إلا بموافقة مدير العمليات`,
              en: `set an instant alert when ${ch.en} is paused, and allow manual pauses only with the operations manager's approval`,
            },
            when: { ar: 'اليوم', en: 'today' },
            expectedImpact: estimate(weeklyLost * 0.7, 'KWD', '70% × weekly lost-sales estimate', {
              weeklyLostKwd: r3(weeklyLost),
              recoveryShare: 0.7,
            }),
          },
          {
            who: { ar: 'مسؤول المنصات', en: 'Platforms lead' },
            what: {
              ar: `مراجعة سبب الإيقاف حول الساعة ${hh}:00 (ضغط المطبخ، نفاد صنف، أو تغيير وردية) مع مدير حساب ${ch.ar}`,
              en: `review why the store pauses around ${hh}:00 (kitchen load, item out, shift change) with the ${ch.en} account manager`,
            },
            when: { ar: 'هذا الأسبوع', en: 'this week' },
            expectedImpact: null,
          },
        ],
      }
      return finding
    })
    .sort((a, b) => (b.weeklyImpact?.value ?? 0) - (a.weeklyImpact?.value ?? 0))
}

function trendFindings(cube: OdooPeriodCube, prior: OdooPeriodCube): CouncilFinding[] {
  const out: CouncilFinding[] = []
  for (const [branchId, cell] of Object.entries(cube.byBranch)) {
    const p = (prior.byBranch as Record<string, typeof cell>)[branchId]
    if (!cell || !p) continue
    for (const channel of PLATFORM_CHANNELS) {
      const now = cell.channels[channel]?.netKwd ?? 0
      const before = p.channels[channel]?.netKwd ?? 0
      const pct = pctChange(now, before)
      const branchPct = pctChange(cell.netKwd, p.netKwd)
      if (pct === null || branchPct === null || before < prior.totals.netSalesKwd * 0.01) continue
      if (pct - branchPct > -20) continue
      const lbl = branchLabel(branchId)
      const ch = channelLabel(channel)
      out.push({
        fingerprint: `delivery:trend:${branchId}:${channel}`,
        advisorId: 'delivery',
        kind: 'platform-decline',
        entities: { branchId, channel },
        titleAr: `${ch.ar} في ${lbl.ar} ${pct.toFixed(1)}% بينما الفرع ${branchPct >= 0 ? '+' : ''}${branchPct.toFixed(1)}%`,
        titleEn: `${ch.en} at ${lbl.en} ${pct.toFixed(1)}% while the branch is ${branchPct >= 0 ? '+' : ''}${branchPct.toFixed(1)}%`,
        evidence: [
          evidence({ odooModel: 'pos.payment', domain: `branch=${branchId}, channel=${channel}`, period: cube.dateRange, value: now, unit: 'KWD', syncAt: cube.lastSyncAt, labelAr: 'الفترة الحالية', labelEn: 'Current window' }),
          evidence({ odooModel: 'pos.payment', domain: `branch=${branchId}, channel=${channel}`, period: prior.dateRange, value: before, unit: 'KWD', syncAt: prior.lastSyncAt, labelAr: 'الفترة السابقة', labelEn: 'Prior window' }),
          evidence({ odooModel: 'pos.payment', domain: `branch=${branchId}, channel=${channel}`, period: cube.dateRange, value: pct, unit: 'pct', syncAt: cube.lastSyncAt, labelAr: 'تغيّر المنصة', labelEn: 'Platform change' }),
          evidence({ odooModel: 'pos.order', domain: `branch=${branchId}`, period: cube.dateRange, value: branchPct, unit: 'pct', syncAt: cube.lastSyncAt, labelAr: 'تغيّر الفرع', labelEn: 'Branch change' }),
        ],
        thresholds: { responseHours: 48 },
        rootCause: {
          ar: `هبوط خاص بـ${ch.ar} وليس بالفرع: ترتيب أو ظهور أضعف، أو توقفات.`,
          en: `A drop specific to ${ch.en}, not the branch: weaker ranking or visibility, or pauses.`,
        },
        severity: pct - branchPct <= -35 ? 'high' : 'medium',
        novelty: clamp01((branchPct - pct) / 60),
        weeklyImpact: estimate(((before - now) * 7) / Math.max(1, cube.days), 'KWD', '(prior net − current net) × 7 ÷ days', {
          priorNetKwd: before,
          currentNetKwd: now,
          days: cube.days,
        }),
        proposals: [
          {
            who: { ar: 'مسؤول المنصات', en: 'Platforms lead' },
            what: {
              ar: `طلب تقرير ترتيب ${ch.ar} لفرع ${lbl.ar} ومقارنته بالمنافسين في نفس المنطقة، وتحسين الصور وزمن التحضير المعلن`,
              en: `request the ${ch.en} ranking report for ${lbl.en}, compare with nearby competitors, and fix photos and the advertised prep time`,
            },
            when: { ar: 'خلال 48 ساعة', en: 'within 48 hours' },
            expectedImpact: null,
          },
        ],
      })
    }
  }
  return out
}

export const deliveryAdvisor: Advisor<DeliveryInput> = {
  id: 'delivery',
  domainAr: 'منصات التوصيل',
  domainEn: 'Delivery platforms',
  run(input: DeliveryInput): AdvisorReport {
    const gaps: CouncilDataGap[] = []
    const findings: CouncilFinding[] = []
    const weeks = input.historyWeeks ?? 4
    if (input.matrix && input.matrix.rows.length > 0) {
      findings.push(...pauseFindings(input.matrix, weeks))
    } else {
      gaps.push({
        odooModel: 'pos.payment',
        missingAr: 'مصفوفة الساعة × الفرع × المنصة غير متوفرة، فلا يمكن كشف توقفات طلبات (TGO/TMP) وكيتا.',
        missingEn: 'The hour × branch × platform matrix is not available, so Talabat (TGO/TMP) and Keeta pauses cannot be detected.',
        recordAr: `قراءة Odoo (للقراءة فقط) لـpos.payment مجمّعة حسب الصندوق × ساعة الدفع × طريقة الدفع لآخر ${weeks + 1} أسابيع.`,
        recordEn: `A read-only Odoo read of pos.payment grouped by register × payment hour × payment method for the last ${weeks + 1} weeks.`,
      })
    }
    if (input.cube?.connected && input.priorCube?.connected) {
      findings.push(...trendFindings(input.cube, input.priorCube))
    } else {
      gaps.push({
        odooModel: 'pos.payment',
        missingAr: 'لا توجد فترتان متساويتان من مكعّب الفترة لمقارنة اتجاه TGO وTMP وكيتا لكل فرع.',
        missingEn: 'Two equal period cubes are not available to compare the TGO / TMP / Keeta trend per branch.',
        recordAr: 'قراءة مكعّب الفترة الحالية والسابقة من Odoo (تلقائية عند الاتصال).',
        recordEn: 'A current and prior period-cube read from Odoo (automatic when connected).',
      })
    }
    return {
      advisorId: 'delivery',
      domainAr: this.domainAr,
      domainEn: this.domainEn,
      period: input.matrix?.period ?? input.cube?.dateRange ?? null,
      generatedAt: input.matrix?.syncAt ?? input.cube?.lastSyncAt ?? null,
      status: findings.length === 0 && gaps.length === 2 ? 'unavailable' : gaps.length > 0 ? 'partial' : 'ready',
      findings,
      dataGaps: gaps,
    }
  },
}
