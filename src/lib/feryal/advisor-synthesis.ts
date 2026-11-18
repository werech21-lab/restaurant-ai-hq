/**
 * Feryal's executive synthesis over the advisor council.
 *
 * After the Odoo number, Feryal adds: the why (root cause, linked across advisors when several of
 * them point at the same branch), 2–3 specific proposals (who / what / when, with a labelled
 * Estimate and its formula), and a follow-up question. When the data is not in Odoo she says so in
 * one calm line, then what can be done now and what to start recording.
 *
 * Number guard: every figure in the block must come from a report (evidence, Estimate value or
 * input, a number inside a shown Estimate formula, a rule threshold) or be a date / entity name.
 * A proposal that fails is dropped and the block rebuilt; if it still fails, no block is added.
 */
import { GLOBAL_BRANCH_OPTIONS } from '@/lib/aether/global-filter-engine'
import { branchLabel, fmtKwd } from '@/lib/council/helpers'
import { councilNumbers, findingImpactScore } from '@/lib/council/runner'
import { numbersIn } from '@/lib/council/trace'
import type { AdvisorId, AdvisorReport, CouncilDataGap, CouncilEvidence, CouncilFinding, CouncilSnapshot } from '@/lib/council/types'
import { COMPANY_CONTEXT } from './company-context'

export type AdvisoryTopic = 'sales' | 'delivery' | 'hr' | 'inventory' | 'seasons' | 'strategy'

const ADVISOR_NAME_AR: Record<AdvisorId, string> = {
  cfo: 'مستشار المالية',
  delivery: 'مستشار منصات التوصيل',
  hr: 'مستشار الموارد البشرية',
  inventory: 'مستشار المخزون',
  seasons: 'مستشار المواسم',
}

const TOPIC_ADVISORS: Record<AdvisoryTopic, AdvisorId[]> = {
  sales: ['cfo', 'delivery', 'seasons'],
  delivery: ['delivery', 'cfo'],
  hr: ['hr'],
  inventory: ['inventory'],
  seasons: ['seasons'],
  strategy: ['cfo', 'delivery', 'hr', 'inventory', 'seasons'],
}

/** Topic of a question (Kuwaiti / Gulf dialect, Arabic, English). «طلبات» alone means "orders". */
export function detectAdvisoryTopic(question: string): AdvisoryTopic {
  const q = question.toLowerCase()
  if (/talabat|keeta|كيتا|\btgo\b|\btmp\b|منص(?:ة|ات)|توقف|سكّ?ر(?:وا|ت)? المتجر|ترتيب.*طلبات|طلبات.*(?:ترتيب|توقف|سكر|مقفل)|ديليفرو|deliveroo|توصيل/.test(q)) return 'delivery'
  if (/مخزون|مستودع|هدر|إتلاف|اتلاف|جرد|بضاع|inventory|stock|warehouse|waste|scrap/.test(q)) return 'inventory'
  if (/اوفر ?تايم|أوفر ?تايم|عمل إضافي|ساعات إضافية|دوام|موظف|طاقم|ورديات|overtime|staff|shift|roster/.test(q)) return 'hr'
  if (/رمضان|عيد|موسم|مواسم|العيد الوطني|المدارس|دراسة|راتب|رواتب|الصيف|الشتا|season|ramadan|eid|salary|summer|winter/.test(q)) return 'seasons'
  if (/شنو أسوي|شسوي|شو أسوي|ويش أسوي|خطة|اقتراح|انصحيني|نصيحة|كيف (?:أرفع|ارفع|نرفع|أزيد|ازيد|نزيد)|ارفع المبيعات|أرفع المبيعات|زيادة المبيعات|what should|how (?:do|can) (?:i|we) (?:raise|grow|increase)|plan|advice/.test(q)) return 'strategy'
  return 'sales'
}

const FOLLOW_UP: Record<string, (f: CouncilFinding) => string> = {
  'wow-divergence': (f) => `هل تغيّر شي في ${branchLabel(f.entities.branchId!).ar} الأسبوع الماضي — طاقم، منيو، أو توقف منصة؟ إذا تبين أقارن لك ساعة بساعة.`,
  'wow-outperformer': (f) => `تبين أعرف شنو اللي تغيّر في ${branchLabel(f.entities.branchId!).ar} عشان ننقله لبقية الفروع؟`,
  'basket-shrink': (f) => `تبين أطلع لك الأصناف اللي اختفت من سلة ${branchLabel(f.entities.branchId!).ar} مقارنة بالشهر اللي قبل؟`,
  'weekday-gap': (f) => `نجرب عرض اليوم الضعيف في ${branchLabel(f.entities.branchId!).ar} أسبوعين ونقيس؟`,
  'platform-pause': (f) => `تبين أرسل لمدير ${branchLabel(f.entities.branchId!).ar} قائمة ساعات التوقف عشان يراجعها مع المنصة؟`,
  'platform-decline': () => 'تبين أقارن ترتيب الفرع مع المنافسين في نفس المنطقة لو توفر تقرير المنصة؟',
  'season-prep': () => 'تبين أجهز لك خطة التحضير أسبوع بأسبوع لهذا الموسم؟',
  'negative-stock': () => 'تبين أطلع لك قائمة الأصناف السالبة بالاسم عشان يبدأ الجرد فيها؟',
  'missed-checkout': () => 'تبين نبدأ بقسم واحد ونقيس الفرق بعد أسبوعين من الانصراف التلقائي؟',
  overtime: () => 'تبين أقارن ساعات الدوام مع ساعات الذروة الفعلية لو سجلنا فرع كل موظف؟',
}

function unitText(e: CouncilEvidence): string {
  if (e.unit === 'KWD') return `${fmtKwd(e.value)} د.ك`
  if (e.unit === 'KWD/order') return `${fmtKwd(e.value)} د.ك للطلب`
  if (e.unit === 'pct') return `${e.value.toFixed(1)}%`
  if (e.unit === 'hours') return `${e.value} ساعة`
  return String(e.value)
}

function estimateText(est: NonNullable<CouncilFinding['weeklyImpact']>): string {
  const v = est.unit === 'KWD' ? `${fmtKwd(est.value)} د.ك أسبوعياً` : est.unit === 'hours' ? `${est.value.toFixed(1)} ساعة أسبوعياً` : `${est.value}`
  return `تقدير: ${v} = ${est.formula}`
}

/** Cross-advisor root cause when several advisors point at the same branch. */
function linkedCause(primary: CouncilFinding, linked: CouncilFinding[]): string | null {
  if (linked.length === 0) return null
  const kinds = new Set([primary.kind, ...linked.map((l) => l.kind)])
  const b = primary.entities.branchId ? branchLabel(primary.entities.branchId).ar : 'الفرع'
  const names = [...new Set([primary, ...linked].map((f) => ADVISOR_NAME_AR[f.advisorId]))].join(' + ')
  if ((kinds.has('wow-divergence') || kinds.has('weekday-gap') || kinds.has('hour-gap')) && (kinds.has('platform-pause') || kinds.has('platform-decline'))) {
    return `${names}: نفس الفرع (${b}) — تراجع المبيعات يتزامن مع ضعف المنصات، فالسبب المرجح توقف المتجر على التطبيقات في الذروة وليس ضعف الطلب.`
  }
  if (kinds.has('negative-stock') && (kinds.has('wow-divergence') || kinds.has('dying-sku'))) {
    return `${names}: نفس الفرع (${b}) — الرصيد السالب مع تراجع المبيعات يشير إلى نفاد أصناف فعلي على الرف بينما النظام لا يعكسه.`
  }
  if (kinds.has('season-prep') && (kinds.has('wow-outperformer') || kinds.has('basket-shrink'))) {
    return `${names}: نفس الفرع (${b}) يتأثر بالموسم أكثر من غيره — جهّز له طاقماً ومخزوناً قبل البقية.`
  }
  return `${names} يشيرون لنفس الفرع (${b}) — عالجهم كمشكلة واحدة.`
}

export interface AdvisoryBlock {
  text: string
  allowedNumbers: number[]
  allowedDateStrings: string[]
  allowedEntityNames: string[]
  findings: string[]
  advisors: AdvisorId[]
}

interface BuildInput {
  question: string
  branchId?: string | null
  topic?: AdvisoryTopic
  council: CouncilSnapshot | null | undefined
  /** Format a sync ISO time for display (Kuwait). */
  formatSync?: (iso: string) => string
  maxProposals?: number
}

function relevantFindings(reports: readonly AdvisorReport[], topic: AdvisoryTopic, branchId: string | null | undefined): CouncilFinding[] {
  const order = TOPIC_ADVISORS[topic]
  const all = reports.flatMap((r) => r.findings).filter((f) => order.includes(f.advisorId))
  const scoped = branchId ? all.filter((f) => f.entities.branchId === branchId) : all
  const pool = scoped.length > 0 ? scoped : branchId ? [] : all
  // Strategy ranks purely by impact × novelty; a topic question leads with its own advisor.
  return [...pool].sort((a, b) =>
    topic === 'strategy'
      ? findingImpactScore(b) - findingImpactScore(a) || order.indexOf(a.advisorId) - order.indexOf(b.advisorId)
      : order.indexOf(a.advisorId) - order.indexOf(b.advisorId) || findingImpactScore(b) - findingImpactScore(a),
  )
}

/** Gaps of the topic's own advisor (first in its list) — what is missing for exactly this question. */
function relevantGaps(reports: readonly AdvisorReport[], topic: AdvisoryTopic): CouncilDataGap[] {
  const own = TOPIC_ADVISORS[topic][0]
  return reports.filter((r) => r.advisorId === own).flatMap((r) => r.dataGaps)
}

function render(
  primary: CouncilFinding | null,
  linked: CouncilFinding[],
  extra: CouncilFinding[],
  gaps: CouncilDataGap[],
  maxProposals: number,
  dropProposals: ReadonlySet<string>,
  formatSync: (iso: string) => string,
  ownAdvisorHasFindings: boolean,
): { text: string; used: CouncilFinding[]; syncStrings: string[] } {
  const lines: string[] = []
  const used: CouncilFinding[] = []
  const syncStrings: string[] = []
  if (!ownAdvisorHasFindings && gaps.length > 0) {
    // One calm line on what Odoo does not hold, then what to record — before what can be done now.
    lines.push(`• غير متوفر في Odoo: ${gaps[0].missingAr}`)
    lines.push(`• ابدأ بتسجيل: ${gaps[0].recordAr}`)
    if (primary) lines.push('• الممكن الآن من البيانات المتوفرة:')
  }
  if (primary) {
    used.push(primary, ...linked, ...extra)
    lines.push(`• الملاحظة: ${primary.titleAr}`)
    const ev = primary.evidence.slice(0, 2).map((e) => `${e.labelAr}: ${unitText(e)}`).join('؛ ')
    lines.push(`• الدليل (${primary.evidence[0].odooModel}، ${primary.evidence[0].period.from} → ${primary.evidence[0].period.to}): ${ev}`)
    lines.push(`• لماذا: ${primary.rootCause.ar}`)
    const cross = linkedCause(primary, linked)
    if (cross) lines.push(`• الربط بين المستشارين: ${cross}`)
    const proposals = [...primary.proposals.map((p, i) => ({ p, key: `${primary.fingerprint}#${i}` })), ...extra.flatMap((f) => f.proposals.slice(0, 1).map((p, i) => ({ p, key: `${f.fingerprint}#${i}` })))]
      .filter(({ key }) => !dropProposals.has(key))
      .slice(0, maxProposals)
    if (proposals.length > 0) {
      lines.push('• مقترحات:')
      proposals.forEach(({ p }) => {
        lines.push(`  ◦ ${p.who.ar}: ${p.what.ar} — ${p.when.ar}.${p.expectedImpact ? ` ${estimateText(p.expectedImpact)}` : ''}`)
      })
    }
    const fu = FOLLOW_UP[primary.kind]?.(primary)
    if (fu) lines.push(`• سؤال: ${fu}`)
  }
  if (lines.length === 0) return { text: '', used, syncStrings }
  const srcParts = used
    .filter((f, i, arr) => arr.findIndex((x) => x.advisorId === f.advisorId) === i)
    .map((f) => {
      const e = f.evidence[0]
      const sync = e.syncAt ? formatSync(e.syncAt) : 'غير متاح'
      if (e.syncAt) syncStrings.push(sync)
      return `${ADVISOR_NAME_AR[f.advisorId]} (${e.odooModel}، ${e.period.from} → ${e.period.to}، آخر مزامنة: ${sync})`
    })
  if (srcParts.length > 0) lines.push(`• مصادر المستشارين: ${srcParts.join('؛ ')}`)
  return { text: lines.join('\n'), used, syncStrings }
}

function allowedFor(findings: readonly CouncilFinding[]): number[] {
  const out = councilNumbers([{ advisorId: 'cfo', domainAr: '', domainEn: '', period: null, generatedAt: null, status: 'ready', findings: [...findings], dataGaps: [] }])
  for (const f of findings) {
    for (const est of [f.weeklyImpact, ...f.proposals.map((p) => p.expectedImpact)]) if (est) out.push(...numbersIn(est.formula))
  }
  // Text shows signed changes as words ("fell 15.3%"), so the magnitude is the traced figure.
  return [...out, ...out.map((n) => Math.abs(n))]
}

const ENTITY_NAMES = [...GLOBAL_BRANCH_OPTIONS.flatMap((o) => [o.ar, o.en]), ...COMPANY_CONTEXT.branches.flatMap((b) => [b.ar, b.en])]

export function buildAdvisoryBlock(input: BuildInput, verify: (text: string, allowed: number[], opts: { allowedDateStrings: string[]; allowedEntityNames: string[] }) => { valid: boolean; unverifiedNumbers: number[] }): AdvisoryBlock | null {
  const council = input.council
  if (!council || council.reports.length === 0) return null
  const topic = input.topic ?? detectAdvisoryTopic(input.question)
  const maxProposals = input.maxProposals ?? 3
  const formatSync = input.formatSync ?? ((iso: string) => iso.slice(0, 16).replace('T', ' '))
  const findings = relevantFindings(council.reports, topic, input.branchId)
  const primary = findings[0] ?? null
  const linked = primary?.entities.branchId
    ? council.reports.flatMap((r) => r.findings).filter((f) => f.advisorId !== primary.advisorId && f.entities.branchId === primary.entities.branchId).slice(0, 2)
    : []
  // Strategy questions draw one proposal from the next strongest advisors too.
  const extra = topic === 'strategy' ? findings.filter((f) => f !== primary && f.advisorId !== primary?.advisorId).filter((f, i, arr) => arr.findIndex((x) => x.advisorId === f.advisorId) === i).slice(0, 2) : []
  const gaps = relevantGaps(council.reports, topic)
  const own = TOPIC_ADVISORS[topic][0]
  const ownHas = topic === 'strategy' || topic === 'sales' || council.reports.some((r) => r.advisorId === own && r.findings.length > 0)
  const drop = new Set<string>()
  for (let attempt = 0; attempt < 4; attempt++) {
    const { text, used, syncStrings } = render(primary, linked, extra, gaps, maxProposals, drop, formatSync, ownHas)
    if (!text) return null
    // Gap lines quote report parameters (e.g. weeks of history) and dates — part of the report.
    const shownGaps = !ownHas && gaps.length > 0 ? [gaps[0]] : []
    const allowedNumbers = [...allowedFor(used), ...shownGaps.flatMap((g) => numbersIn(`${g.missingAr} ${g.recordAr}`))]
    const allowedDateStrings = [...new Set(used.flatMap((f) => f.evidence.flatMap((e) => [e.period.from, e.period.to])).concat(syncStrings))]
    const check = verify(text, allowedNumbers, { allowedDateStrings, allowedEntityNames: ENTITY_NAMES })
    const estimatesLabelled = text.split('\n').filter((l) => /تقدير/.test(l)).every((l) => /تقدير: .+ = .+/.test(l))
    if (check.valid && estimatesLabelled) {
      return { text, allowedNumbers, allowedDateStrings, allowedEntityNames: ENTITY_NAMES, findings: used.map((f) => f.fingerprint), advisors: [...new Set(used.map((f) => f.advisorId))] }
    }
    // Regenerate without the proposals that carry unverified figures.
    const bad = new Set(check.unverifiedNumbers)
    const all = [primary, ...extra].filter((f): f is CouncilFinding => Boolean(f))
    let dropped = false
    for (const f of all) {
      f.proposals.forEach((p, i) => {
        const nums = numbersIn(`${p.who.ar} ${p.what.ar} ${p.when.ar} ${p.expectedImpact ? estimateText(p.expectedImpact) : ''}`)
        if (nums.some((n) => bad.has(n)) && !drop.has(`${f.fingerprint}#${i}`)) {
          drop.add(`${f.fingerprint}#${i}`)
          dropped = true
        }
      })
    }
    if (!dropped) return null
  }
  return null
}
