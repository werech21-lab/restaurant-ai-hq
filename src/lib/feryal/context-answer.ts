/**
 * Deterministic Feryal answer from an Odoo period cube.
 * Every number in the reply is copied from the cube. Advisor text is context, not a number source.
 */

import { calendarDaysInIsoMonth } from '@/lib/aether/global-filter-engine'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'

export interface FeryalAdvisorSnippet {
  domainAr: string
}

const SMALL_TALK =
  /^(?:مرحباً?|هلا|شلونك|السلام(?: عليكم)?|فهمتي(?: شو)?|محادثات قديمة)$/i
const PREP = /تحضير|prep|زمن التجهيز|كيتشن|kds/i
const FORECAST = /توقع|forecast|الشهر الجاي|الشهر القادم|المستهدف/i
const TALABAT = /طلبات|talabat/i
const BOOTH = /بوث|معارض/i
const DRIVERS = /سائق|drivers/i
const REVIEWS = /تقييم|مراجعات|سوشيال|ratings|reviews/i
const BUDGET = /موازنة|ميزانية|budget|crossovered/i
const FLEET = /أسطول|اسطول|fleet/i

const MISSING_PREP = 'زمن التحضير غير متاح في Odoo'
const MISSING_DRIVERS = 'بيانات السائقين غير متاحة في Odoo'
const MISSING_REVIEWS = 'تقييمات السوشيال غير متاحة في Odoo'
const MISSING_BUDGET = 'الموازنة غير متاحة في Odoo (crossovered.budget)'
const MISSING_FLEET = 'أسطول التوصيل غير متاح في Odoo'

function fmt(n: number): string {
  return n.toFixed(3)
}

export function isFeryalForecastQuestion(question: string): boolean {
  return FORECAST.test(question)
}

export function isFeryalSmallTalk(question: string): boolean {
  const cleaned = question
    .trim()
    .replace(/^[؟?!.،,؛:]+|[؟?!.،,؛:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const words = cleaned.split(' ').filter(Boolean)
  if (words.length === 0 || words.length > 4) return false
  return SMALL_TALK.test(cleaned)
}

export function answerFromFeryalContext(
  question: string,
  cube: OdooPeriodCube | null | undefined,
  advisors: readonly FeryalAdvisorSnippet[] = [],
): { reply: string; status: 'answered' | 'no_odoo_data'; missingMetrics: string[]; citedNumbers: number[] } {
  if (isFeryalSmallTalk(question)) {
    return {
      status: 'answered',
      missingMetrics: [],
      citedNumbers: [],
      reply:
        'هلا، أنا فريال. أقدر أحلل من أودو المبيعات، أفضل ساعة، القنوات، والبوثات. وش تبي نشوف الحين؟',
    }
  }

  if (!cube || cube.connected === false || cube.noData) {
    return { status: 'no_odoo_data', missingMetrics: [], citedNumbers: [], reply: '' }
  }

  const cited: number[] = []
  const missing: string[] = []
  if (PREP.test(question)) missing.push(MISSING_PREP)
  if (DRIVERS.test(question)) missing.push(MISSING_DRIVERS)
  if (REVIEWS.test(question)) missing.push(MISSING_REVIEWS)
  if (BUDGET.test(question)) missing.push(MISSING_BUDGET)
  if (FLEET.test(question)) missing.push(MISSING_FLEET)

  const hourly = cube.hourlySeries ?? []
  const peak = hourly.reduce<{ hour: number; netKwd: number } | null>((best, row) => {
    if (!best || row.netKwd > best.netKwd) return { hour: row.hour, netKwd: row.netKwd }
    return best
  }, null)

  const talabat = (cube.byChannel?.['talabat-tgo']?.netKwd ?? 0) + (cube.byChannel?.['talabat-tmp']?.netKwd ?? 0)
  const exhibitions = cube.byBranch?.exhibitions
  const lines: string[] = []

  if (missing.length) {
    lines.push(missing[0])
    lines.push('• الرقم: انظر المبيعات الساعية أدناه')
    lines.push('• السبب من البيانات: المؤشر نفسه غير موجود في أودو، والتحليل من المكعب المتاح.')
    lines.push('• الإجراء المحدد: راجع ساعة الذروة قبل أي قرار تشغيل.')
    lines.push('تقدير: ليس رقماً مغلقاً.')
  }

  if (FORECAST.test(question) && cube.days > 0 && typeof cube.totals?.netSalesKwd === 'number') {
    const net = cube.totals.netSalesKwd
    const elapsed = cube.days
    const monthLength = calendarDaysInIsoMonth(cube.dateRange?.to) ?? elapsed
    const projection = Math.round((net / elapsed) * monthLength * 1000) / 1000
    cited.push(net, elapsed, monthLength, projection)
    lines.push(
      `تقدير — ليس رقماً من Odoo: ${fmt(net)} ÷ ${elapsed} × ${monthLength} = ${fmt(projection)} د.ك.`,
    )
  }

  if (peak && (PREP.test(question) || /ساعة|hour/i.test(question) || lines.length === 0)) {
    cited.push(peak.hour, peak.netKwd)
    lines.push(`أعلى ساعة في الفترة هي الساعة ${peak.hour} بمبيعات ${fmt(peak.netKwd)} د.ك من pos.order.`)
  }

  if (TALABAT.test(question)) {
    cited.push(talabat)
    lines.push(`مبيعات طلبات (TGO + TMP) في الفترة ${fmt(talabat)} د.ك.`)
    lines.push('اقتراح: راجع فرق TGO و TMP على الفروع الأعلى في نفس الفترة قبل تغيير العمولة.')
  }

  if (BOOTH.test(question)) {
    if (exhibitions && typeof exhibitions.netKwd === 'number') {
      cited.push(exhibitions.netKwd)
      lines.push(`بوثات المعارض: ${fmt(exhibitions.netKwd)} د.ك.`)
    } else {
      lines.push('بوثات المعارض غير ظاهرة في مكعب هذه الفترة.')
    }
  }

  if (
    typeof cube.totals?.netSalesKwd === 'number' &&
    (lines.length === 0 || (missing.length > 0 && !cited.includes(cube.totals.netSalesKwd)))
  ) {
    cited.push(cube.totals.netSalesKwd)
    lines.push(`صافي مبيعات الفترة ${fmt(cube.totals.netSalesKwd)} د.ك.`)
  }

  const advisor = advisors.find((row) => row.domainAr.trim().length > 0 && !/\d/.test(row.domainAr))
  if (advisor) {
    lines.push(`تقرير المستشار: ${advisor.domainAr.trim()}`)
  }

  return { status: 'answered', missingMetrics: missing, citedNumbers: cited, reply: lines.join('\n') }
}

export function dropUnverifiedClaims(
  claims: readonly { text: string; numbers: readonly number[] }[],
  allowed: readonly number[],
): string {
  const ok = (value: number) =>
    allowed.some((candidate) => Math.abs(candidate - value) < 0.001)
  return claims
    .filter((claim) => claim.numbers.every(ok))
    .map((claim) => claim.text)
    .join('\n')
}
