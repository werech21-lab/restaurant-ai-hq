/**
 * Delivery-platforms advisor — Talabat (TGO / TMP) and Keeta health per branch.
 *
 * Pause / offline detection needs a branch × hour × channel matrix read live from Odoo
 * (`pos.payment` grouped by register × payment hour × payment method). When it is present, an hour
 * is a suspected pause when the branch has zero orders on that platform while it keeps selling on
 * other channels, and the same weekday-hour of the previous weeks had orders on that platform.
 * Lost sales are an Estimate: the median net of that platform in the same weekday-hour.
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
  median,
  pctChange,
  r3,
  shiftIso,
  weekdayOf,
} from '../helpers'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilFinding } from '../types'

export const PLATFORM_CHANNELS = ['talabat-tgo', 'talabat-tmp', 'keeta'] as const
export type PlatformChannel = (typeof PLATFORM_CHANNELS)[number]

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

interface Pause {
  branchId: string
  channel: PlatformChannel
  day: string
  hour: number
  otherOrders: number
  historyNet: number[]
  historyOrders: number[]
}

export function detectPauses(matrix: AggregatorHourlyMatrix, historyWeeks = 4): Pause[] {
  const key = (day: string, hour: number, branch: string, ch: string) => `${day}|${hour}|${branch}|${ch}`
  const cells = new Map<string, AggregatorHourlyCell>()
  const branchHourOrders = new Map<string, number>()
  const days = new Set<string>()
  const branches = new Set<string>()
  for (const r of matrix.rows) {
    cells.set(key(r.day, r.hour, r.branchId, r.channel), r)
    const bh = `${r.day}|${r.hour}|${r.branchId}`
    branchHourOrders.set(bh, (branchHourOrders.get(bh) ?? 0) + r.orders)
    days.add(r.day)
    branches.add(r.branchId)
  }
  const sortedDays = [...days].sort()
  const out: Pause[] = []
  for (const day of sortedDays) {
    for (const branchId of branches) {
      for (let hour = 0; hour < 24; hour++) {
        const totalOrders = branchHourOrders.get(`${day}|${hour}|${branchId}`) ?? 0
        if (totalOrders === 0) continue // branch not trading this hour
        for (const channel of PLATFORM_CHANNELS) {
          const own = cells.get(key(day, hour, branchId, channel))?.orders ?? 0
          if (own > 0) continue
          const history = Array.from({ length: historyWeeks }, (_, i) => shiftIso(day, -7 * (i + 1)))
          if (history.some((d) => !days.has(d))) continue
          const hist = history.map((d) => cells.get(key(d, hour, branchId, channel)))
          const histOrders = hist.map((c) => c?.orders ?? 0)
          // Only a pause when the platform normally sells in this weekday-hour (every past week).
          if (histOrders.some((o) => o === 0)) continue
          out.push({ branchId, channel, day, hour, otherOrders: totalOrders, historyNet: hist.map((c) => c?.netKwd ?? 0), historyOrders: histOrders })
        }
      }
    }
  }
  return out
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
      const lostPerHour = list.map((p) => median(p.historyNet))
      const lost = lostPerHour.reduce((s, v) => s + v, 0)
      const weeks = Math.max(1, (Date.parse(`${matrix.period.to}T00:00:00Z`) - Date.parse(`${matrix.period.from}T00:00:00Z`)) / (7 * 86_400_000) + 1 / 7)
      const worstHour = median(list.map((p) => p.hour))
      const byWeekday = new Map<number, number>()
      for (const p of list) byWeekday.set(weekdayOf(p.day), (byWeekday.get(weekdayOf(p.day)) ?? 0) + 1)
      const topWd = [...byWeekday].sort((a, b) => b[1] - a[1])[0][0]
      const finding: CouncilFinding = {
        fingerprint: `delivery:pause:${branchId}:${channel}`,
        advisorId: 'delivery',
        kind: 'platform-pause',
        entities: { branchId, channel, hour: list[0].hour, weekday: topWd },
        titleAr: `توقف متكرر محتمل: ${ch.ar} في ${lbl.ar} — ${list.length} ساعة بلا طلبات بينما الفرع يبيع`,
        titleEn: `Probable repeated pause: ${ch.en} at ${lbl.en} — ${list.length} hours with no orders while the branch kept selling`,
        evidence: [
          evidence({ odooModel: 'pos.payment', domain: `branch=${branchId}, channel=${channel}, orders=0 while other channels > 0`, period: matrix.period, value: list.length, unit: 'count', syncAt: matrix.syncAt, labelAr: 'ساعات التوقف المحتمل', labelEn: 'Suspected pause hours' }),
          evidence({ odooModel: 'pos.payment', domain: `branch=${branchId}, other channels in those hours`, period: matrix.period, value: list.reduce((s, p) => s + p.otherOrders, 0), unit: 'orders', syncAt: matrix.syncAt, labelAr: 'طلبات القنوات الأخرى في نفس الساعات', labelEn: 'Other-channel orders in the same hours' }),
        ],
        rootCause: {
          ar: `الفرع كان يعمل (طلبات من قنوات أخرى) لكن ${ch.ar} صفر في ساعات كانت تبيع فيها كل أسبوع: المتجر متوقف أو مخفي على المنصة، غالباً يوم ${WEEKDAY_AR[topWd]}.`,
          en: `The branch was trading (other-channel orders) but ${ch.en} was zero in hours that sold every previous week: the store was paused or hidden on the platform, mostly on ${WEEKDAY_EN[topWd]}s.`,
        },
        severity: list.length >= 6 ? 'high' : 'medium',
        thresholds: { typicalPauseHour: worstHour },
        novelty: clamp01(list.length / 12),
        weeklyImpact: estimate(lost / weeks, 'KWD', 'Σ over pause hours of median(same weekday-hour net, last N weeks) ÷ weeks in window', { pauseHours: list.length, lostKwd: r3(lost), weeks: Math.round(weeks * 10) / 10, historyWeeks }),
        proposals: [
          {
            who: { ar: `مدير فرع ${lbl.ar}`, en: `${lbl.en} branch manager` },
            what: { ar: `تفعيل تنبيه فوري عند إيقاف ${ch.ar}، ومنع الإيقاف اليدوي إلا بموافقة مدير العمليات`, en: `set an instant alert when ${ch.en} is paused, and allow manual pauses only with the operations manager's approval` },
            when: { ar: 'اليوم', en: 'today' },
            expectedImpact: estimate((lost / weeks) * 0.7, 'KWD', '70% × weekly lost-sales estimate', { weeklyLostKwd: r3(lost / weeks), recoveryShare: 0.7 }),
          },
          {
            who: { ar: 'مسؤول المنصات', en: 'Platforms lead' },
            what: { ar: `مراجعة سبب الإيقاف حول الساعة ${String(worstHour).padStart(2, '0')}:00 (ضغط المطبخ، نفاد صنف، أو تغيير وردية) مع حساب ${ch.ar}`, en: `review why the store pauses around ${String(worstHour).padStart(2, '0')}:00 (kitchen load, item out, shift change) with the ${ch.en} account manager` },
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
        rootCause: { ar: `هبوط خاص بـ${ch.ar} وليس بالفرع: ترتيب أو ظهور أضعف، أو توقفات.`, en: `A drop specific to ${ch.en}, not the branch: weaker ranking or visibility, or pauses.` },
        severity: pct - branchPct <= -35 ? 'high' : 'medium',
        novelty: clamp01((branchPct - pct) / 60),
        weeklyImpact: estimate(((before - now) * 7) / Math.max(1, cube.days), 'KWD', '(prior net − current net) × 7 ÷ days', { priorNetKwd: before, currentNetKwd: now, days: cube.days }),
        proposals: [
          {
            who: { ar: 'مسؤول المنصات', en: 'Platforms lead' },
            what: { ar: `طلب تقرير ترتيب ${ch.ar} لفرع ${lbl.ar} ومقارنته بالمنافسين في نفس المنطقة، وتحسين الصور وزمن التحضير المعلن`, en: `request the ${ch.en} ranking report for ${lbl.en}, compare with nearby competitors, and fix photos and the advertised prep time` },
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
