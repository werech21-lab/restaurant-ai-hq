/**
 * Deterministic Feryal answer from an Odoo period cube.
 * Every number in the reply is copied from the cube. Advisor text is context, not a number source.
 */

import type { OdooPeriodCube } from '@/lib/odoo-live-connector'

export interface FeryalAdvisorSnippet {
  domainAr: string
}

const SMALL_TALK =
  /مرحبا|مرحباً|فهمتي|محادثات قديمة|شلونك|هلا|السلام/i
const PREP = /تحضير|prep|زمن التجهيز|كيتشن/i
const FORECAST = /توقع|forecast|الشهر الجاي|الشهر القادم|المستهدف/i
const TALABAT = /طلبات|talabat/i
const BOOTH = /بوث|معارض/i
const DRIVERS = /سائق|drivers/i

function fmt(n: number): string {
  return n.toFixed(3)
}

export function isFeryalSmallTalk(question: string): boolean {
  return SMALL_TALK.test(question)
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
  if (PREP.test(question)) missing.push('زمن التحضير غير متاح في Odoo')
  if (DRIVERS.test(question)) missing.push('بيانات السائقين غير متاحة في Odoo')

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
    const runRate = (cube.totals.netSalesKwd / cube.days) * cube.days
    cited.push(runRate, cube.totals.netSalesKwd, cube.days)
    lines.push(`تقدير — ليس رقماً من Odoo: وتيرة الفترة ${fmt(runRate)} د.ك (صافي الفترة ${fmt(cube.totals.netSalesKwd)} على ${cube.days} يوم).`)
  }

  if (peak && (PREP.test(question) || /ساعة|hour/i.test(question) || lines.length === 0)) {
    cited.push(peak.hour, peak.netKwd)
    lines.push(`أعلى ساعة في الفترة هي ${peak.hour}:00 بمبيعات ${fmt(peak.netKwd)} د.ك من pos.order.`)
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

  if (lines.length === 0 && typeof cube.totals?.netSalesKwd === 'number') {
    cited.push(cube.totals.netSalesKwd)
    lines.push(`صافي مبيعات الفترة ${fmt(cube.totals.netSalesKwd)} د.ك.`)
  }

  if (advisors[0]?.domainAr) {
    lines.push(`تقرير المستشار: ${advisors[0].domainAr}`)
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
