/**
 * Feryal's executive synthesis over the advisor council.
 *
 * After the Odoo number, Feryal adds: the why (unified root cause when >= 2 advisors flag the
 * same branch or hour, citing both evidences), 2–3 specific proposals (who / what / when, with a
 * labelled Estimate and its formula), relevant domain dataGaps, and a follow-up question.
 *
 * Strict diversity & relevance:
 * - Each finding fingerprint appears at most once per conversation (`seenFingerprints`).
 * - Never falls back to dumping unrelated CFO branch findings onto delivery, HR, inventory,
 *   seasons, or company-wide factual lookup questions.
 *
 * Number guard: every figure in the block must come from a report (evidence, Estimate value or
 * input, a number inside a shown Estimate formula, a rule threshold, or a reported dataGap
 * parameter) or be a date / entity name.
 */
import { GLOBAL_BRANCH_OPTIONS } from '@/lib/aether/global-filter-engine'
import { branchLabel, channelLabel, fmtKwd } from '@/lib/council/helpers'
import { councilNumbers, findingImpactScore } from '@/lib/council/runner'
import { numbersIn } from '@/lib/council/trace'
import type {
  AdvisorId,
  AdvisorReport,
  CouncilDataGap,
  CouncilEvidence,
  CouncilFinding,
  CouncilSnapshot,
} from '@/lib/council/types'
import { isLowestBranchQuestion } from '@/lib/feryal-intent'
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
  sales: ['cfo'],
  delivery: ['delivery'],
  hr: ['hr'],
  inventory: ['inventory'],
  seasons: ['seasons'],
  strategy: ['cfo', 'delivery', 'seasons', 'hr', 'inventory'],
}

const DELIVERY_CUE_RE =
  /talabat|keeta|كيتا|كييتا|\btgo\b|\btmp\b|منص(?:ة|ات|ه)|توقف|سكّ?ر(?:وا|ت)? المتجر|ترتيب.*طلبات|طلبات.*(?:ترتيب|توقف|سكر|مقفل)|ديليفرو|deliveroo|توصيل/i
const INVENTORY_CUE_RE =
  /مخزون|مستودع|هدر|إتلاف|اتلاف|جرد|بضاع|وصفات|\bbom\b|inventory|stock|warehouse|waste|scrap/i
const HR_CUE_RE =
  /اوفر ?تايم|أوفر ?تايم|عمل إضافي|عمل اضافي|ساعات إضافية|ساعات اضافيه|دوام|موظف|طاقم|الطاقم|ورديات|شفت|overtime|staff|crew|shift|roster/i
const SEASONS_CUE_RE =
  /رمضان|عيد|موسم|مواسم|العيد الوطني|المدارس|دراسة|(?:أيام|ايام|فترة|فتره|موسم|نزول)\s+(?:الرواتب|الراتب|المعاشات)|(?:الرواتب|المعاشات).*(?:قربت|نتجهز|تجهيز|استعداد)|الصيف|الشتا|season|ramadan|eid|salary\s+days?|payday/i
const STRATEGY_CUE_RE =
  /شنو أسوي|شنو اسوي|شسوي|شو أسوي|شو اسوي|ويش أسوي|خطة|اقتراح|انصحيني|نصيحة|كيف (?:أرفع|ارفع|نرفع|أزيد|ازيد|نزيد)|ارفع المبيعات|أرفع المبيعات|زيادة المبيعات|what should|how (?:do|can) (?:i|we) (?:raise|grow|increase)|plan|advice/i
const SALES_DIAGNOSTIC_CUE_RE =
  /نازل(?:ة|ه)?|طايح(?:ة|ه)?|تراجع|انخفض|تضعف|ضعيف(?:ة|ه)?|شلون كانت|شو صاير|ليش|لماذا|الجمعة|السبت|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|\bwhy\b|\bdown\b|\bfell\b|\bdrop\b/i
const SALES_GENERAL_CUE_RE =
  /مبيعات|مبيع|باع|بعنا|سلة|فاتورة|خصم|خصومات|sales|revenue|basket|ticket/i

const WEEKDAY_CUE_PAIRS: readonly [RegExp, number][] = [
  [/(?:يوم\s+)?(?:الأحد|الاحد|\bsunday\b)/i, 0],
  [/(?:يوم\s+)?(?:الاثنين|الإثنين|\bmonday\b)/i, 1],
  [/(?:يوم\s+)?(?:الثلاثاء|\btuesday\b)/i, 2],
  [/(?:يوم\s+)?(?:الأربعاء|الاربعاء|\bwednesday\b)/i, 3],
  [/(?:يوم\s+)?(?:الخميس|\bthursday\b)/i, 4],
  [/(?:يوم\s+)?(?:الجمعة|الجمعه|\bfriday\b)/i, 5],
  [/(?:يوم\s+)?(?:السبت|\bsaturday\b)/i, 6],
]

function detectAskedWeekday(question: string): number | null {
  for (const [re, wd] of WEEKDAY_CUE_PAIRS) {
    if (re.test(question)) return wd
  }
  return null
}

/**
 * Multi-domain topic detection (Kuwaiti / Gulf / Levantine dialect, Arabic, English).
 * E.g. «ليش العاصمة نازلة؟ هل السبب الطاقم ولا المنصات؟» -> `['sales', 'delivery', 'hr']`.
 */
export function detectAdvisoryTopics(question: string): AdvisoryTopic[] {
  const q = question.toLowerCase()
  const specific: AdvisoryTopic[] = []
  if (DELIVERY_CUE_RE.test(q)) specific.push('delivery')
  if (INVENTORY_CUE_RE.test(q)) specific.push('inventory')
  if (HR_CUE_RE.test(q)) specific.push('hr')
  if (SEASONS_CUE_RE.test(q)) specific.push('seasons')

  const hasSalesDiagnostic = SALES_DIAGNOSTIC_CUE_RE.test(q)
  const hasSalesGeneral = SALES_GENERAL_CUE_RE.test(q)

  if (specific.length > 0) {
    if (hasSalesDiagnostic || (hasSalesGeneral && !SEASONS_CUE_RE.test(q) && !INVENTORY_CUE_RE.test(q))) {
      return ['sales', ...specific]
    }
    return specific
  }

  if (STRATEGY_CUE_RE.test(q)) return ['strategy']
  return ['sales']
}

/** Primary topic of a question (backwards-compatible single-topic helper). */
export function detectAdvisoryTopic(question: string): AdvisoryTopic {
  const topics = detectAdvisoryTopics(question)
  if (topics.length > 1 && topics[0] === 'sales') {
    return topics[1]!
  }
  return topics[0] ?? 'sales'
}

const FOLLOW_UP: Record<string, (f: CouncilFinding) => string> = {
  'wow-divergence': (f) =>
    `هل تغيّر شي في ${branchLabel(f.entities.branchId!).ar} الأسبوع الماضي — طاقم، منيو، أو توقف منصة؟ إذا تبين أقارن لك ساعة بساعة.`,
  'wow-outperformer': (f) =>
    `تبين أعرف شنو اللي تغيّر في ${branchLabel(f.entities.branchId!).ar} عشان ننقله لبقية الفروع؟`,
  'basket-shrink': (f) =>
    `تبين أطلع لك الأصناف اللي اختفت من سلة ${branchLabel(f.entities.branchId!).ar} مقارنة بالشهر اللي قبل؟`,
  'weekday-gap': (f) =>
    `نجرب عرض اليوم الضعيف في ${branchLabel(f.entities.branchId!).ar} أسبوعين ونقيس؟`,
  'platform-pause': (f) =>
    `تبين أرسل لمدير ${branchLabel(f.entities.branchId!).ar} قائمة ساعات التوقف عشان يراجعها مع المنصة؟`,
  'platform-decline': () =>
    'تبين أقارن ترتيب الفرع مع المنافسين في نفس المنطقة لو توفر تقرير المنصة؟',
  'season-prep': () => 'تبين أجهز لك خطة التحضير أسبوع بأسبوع لهذا الموسم؟',
  'negative-stock': () => 'تبين أطلع لك قائمة الأصناف السالبة بالاسم عشان يبدأ الجرد فيها؟',
  'qurain-transfer-gap': () => 'تبين أطلع لك التحويلات المعلّقة الصادرة من المطبخ المركزي حسب الفرع؟',
  'bom-variance': () => 'تبين نراجع الأصناف الأعلى انحرافاً عن الوصفة المعيارية هذا الأسبوع؟',
  'missed-checkout': () =>
    'تبين نبدأ بقسم واحد ونقيس الفرق بعد أسبوعين من الانصراف التلقائي؟',
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
  const v =
    est.unit === 'KWD'
      ? `${fmtKwd(est.value)} د.ك أسبوعياً`
      : est.unit === 'hours'
        ? `${est.value.toFixed(1)} ساعة أسبوعياً`
        : `${est.value}`
  return `تقدير: ${v} = ${est.formula}`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Unified root cause when >= 2 advisors point at the same branch OR the same hour.
 * Introduces zero invented numbers; cites shared branch and/or shared hour (`HH:00`).
 */
function unifiedRootCause(primary: CouncilFinding, linked: readonly CouncilFinding[]): string {
  const all = [primary, ...linked]
  const kinds = new Set(all.map((f) => f.kind))
  const names = [...new Set(all.map((f) => ADVISOR_NAME_AR[f.advisorId]))].join(' + ')

  const sharedBranch =
    primary.entities.branchId && linked.some((l) => l.entities.branchId === primary.entities.branchId)
      ? branchLabel(primary.entities.branchId).ar
      : null
  const sharedHour =
    primary.entities.hour !== undefined && linked.some((l) => l.entities.hour === primary.entities.hour)
      ? primary.entities.hour
      : null

  const scopeParts: string[] = []
  if (sharedBranch) scopeParts.push(`نفس الفرع (${sharedBranch})`)
  if (sharedHour !== null) scopeParts.push(`نفس الساعة (${pad2(sharedHour)}:00)`)
  const scopeLabel = scopeParts.join(' وفي ') || (primary.entities.branchId ? branchLabel(primary.entities.branchId).ar : 'نفس النطاق')

  const platformCh = all.find((f) => f.entities.channel)?.entities.channel
  const chText = platformCh ? ` (${channelLabel(platformCh).ar})` : ''

  if (
    (kinds.has('wow-divergence') || kinds.has('weekday-gap') || kinds.has('hour-gap')) &&
    (kinds.has('platform-pause') || kinds.has('platform-decline'))
  ) {
    return `${names} في ${scopeLabel} — تراجع المبيعات يتزامن مباشرة مع توقف/ضعف المنصات${chText} بينما المبيعات المباشرة مستمرة، فالسبب الجذري تشغيلي في إتاحة المتجر على التطبيقات خلال الذروة وليس ضعف الطلب.`
  }
  if (kinds.has('negative-stock') && (kinds.has('wow-divergence') || kinds.has('dying-sku'))) {
    return `${names} في ${scopeLabel} — الرصيد السالب مع تراجع المبيعات يشير إلى نفاد فعلي لأصناف رئيسية نتيجة تحويلات مخزنية غير معتمدة في Odoo.`
  }
  if (
    (kinds.has('overtime') || kinds.has('missed-checkout')) &&
    (kinds.has('platform-pause') || kinds.has('wow-divergence') || kinds.has('hour-gap'))
  ) {
    return `${names} في ${scopeLabel} — ضغط الورديات والعمل الإضافي يتقاطع مع فجوة الأداء، مما يدل على عدم تطابق جدول الطاقم مع ساعات الذروة الفعلية.`
  }
  if (kinds.has('wow-outperformer') || kinds.has('season-prep')) {
    return `${names} في ${scopeLabel} — تقاطع التفوق التشغيلي مع الزخم الموسمي يمثل فرصة نمو مشتركة يُستفاد منها بخطة تحضير موحدة.`
  }
  return `${names} في ${scopeLabel} — تقاطع المؤشرين يؤكد أن السبب تشغيلي مشترك يُعالج بخطة موحدة.`
}

export interface AdvisoryBlock {
  text: string
  allowedNumbers: number[]
  allowedDateStrings: string[]
  allowedEntityNames: string[]
  findings: string[]
  advisors: AdvisorId[]
  dataGaps: CouncilDataGap[]
}

export interface BuildAdvisoryInput {
  question: string
  branchId?: string | null
  topic?: AdvisoryTopic
  topics?: readonly AdvisoryTopic[]
  council: CouncilSnapshot | null | undefined
  /** Findings already surfaced earlier in this conversation (mutated if a `Set` is passed). */
  seenFingerprints?: Set<string> | ReadonlySet<string> | readonly string[]
  /** Format a sync ISO time for display (Kuwait). */
  formatSync?: (iso: string) => string
  maxProposals?: number
}

function advisorListForTopics(topics: readonly AdvisoryTopic[]): AdvisorId[] {
  const out: AdvisorId[] = []
  for (const t of topics) {
    for (const id of TOPIC_ADVISORS[t]) {
      if (!out.includes(id)) out.push(id)
    }
  }
  return out
}

function selectRelevantFindings(params: {
  reports: readonly AdvisorReport[]
  topics: readonly AdvisoryTopic[]
  branchId: string | null | undefined
  question: string
  seen: ReadonlySet<string>
}): CouncilFinding[] {
  const { reports, topics, branchId, question, seen } = params
  const isStrategy = topics.includes('strategy')
  const order = advisorListForTopics(topics)
  const askedWeekday = detectAskedWeekday(question)
  const asksOvertime = /اوفر ?تايم|أوفر ?تايم|عمل إضافي|عمل اضافي|\bovertime\b/i.test(question)
  const asksDiagnosticSales = SALES_DIAGNOSTIC_CUE_RE.test(question)
  const asksLowestBranch = isLowestBranchQuestion(question)

  const unseen = reports
    .flatMap((r) => r.findings)
    .filter((f) => order.includes(f.advisorId) && !seen.has(f.fingerprint))

  const scoped = unseen.filter((f) => {
    if (branchId) {
      // On a branch-specific question: match that branch, or allow company-wide findings ONLY for HR
      // (whose attendance rows have no branchId until work_location_id is populated).
      if (f.entities.branchId) return f.entities.branchId === branchId
      return false
    }
    if (isStrategy) {
      // Sales-growth strategy questions prioritize CFO / Delivery / Seasons before HR / Inventory.
      return true
    }
    if (f.advisorId === 'cfo' && topics.length === 1 && topics[0] === 'sales') {
      // Pure company-wide factual lookups (e.g. "كم كانت مبيعات أمس؟", "أي فرع الأعلى مبيعات أمس؟")
      // never hijack a single branch's diagnostic finding.
      if (!asksDiagnosticSales && !asksLowestBranch) {
        return !f.entities.branchId
      }
      if (asksLowestBranch) {
        return f.kind === 'wow-divergence'
      }
    }
    return true
  })

  return [...scoped].sort((a, b) => {
    // 1. Explicit weekday match wins (e.g. Q11 Friday -> weekday=5)
    if (askedWeekday !== null) {
      const aWd = a.entities.weekday === askedWeekday ? 1 : 0
      const bWd = b.entities.weekday === askedWeekday ? 1 : 0
      if (aWd !== bWd) return bWd - aWd
    }
    // 2. Explicit overtime wording prefers `overtime` over `missed-checkout`
    if (asksOvertime) {
      const aOt = a.kind === 'overtime' ? 1 : 0
      const bOt = b.kind === 'overtime' ? 1 : 0
      if (aOt !== bOt) return bOt - aOt
    }
    // 3. On general strategy ("raise sales this week"), prioritize CFO & Delivery before Seasons/HR/Inventory
    //    so seasonal occasions (e.g. salary-days) remain available for explicit seasonal questions.
    if (isStrategy) {
      const rank = (id: AdvisorId) => (id === 'cfo' ? 2 : id === 'delivery' ? 1 : id === 'seasons' ? 0 : -1)
      const aRank = rank(a.advisorId)
      const bRank = rank(b.advisorId)
      if (aRank !== bRank) return bRank - aRank
      const aNonWeekday = a.kind === 'weekday-gap' ? 0 : 1
      const bNonWeekday = b.kind === 'weekday-gap' ? 0 : 1
      if (aNonWeekday !== bNonWeekday) return bNonWeekday - aNonWeekday
      return findingImpactScore(b) - findingImpactScore(a)
    }
    return (
      order.indexOf(a.advisorId) - order.indexOf(b.advisorId) ||
      findingImpactScore(b) - findingImpactScore(a)
    )
  })
}

function findCrossAdvisorLinked(
  primary: CouncilFinding | null,
  reports: readonly AdvisorReport[],
  detectedAdvisors: readonly AdvisorId[],
  seen: ReadonlySet<string>,
): CouncilFinding[] {
  if (!primary) return []
  const candidates = reports
    .flatMap((r) => r.findings)
    .filter((f) => {
      if (f.advisorId === primary.advisorId || seen.has(f.fingerprint)) return false
      // Avoid linking seasonal upcoming calendar events onto unrelated past branch diagnoses unless seasons was asked.
      if (
        (f.advisorId === 'seasons' || primary.advisorId === 'seasons') &&
        !(detectedAdvisors.includes('seasons') && detectedAdvisors.length > 1 && detectedAdvisors.length < 5)
      ) {
        return false
      }
      const sameBranch =
        Boolean(primary.entities.branchId) && f.entities.branchId === primary.entities.branchId
      const sameHour =
        primary.entities.hour !== undefined && f.entities.hour === primary.entities.hour
      return sameBranch || sameHour
    })
    .sort((a, b) => {
      const aDet = detectedAdvisors.includes(a.advisorId) ? 1 : 0
      const bDet = detectedAdvisors.includes(b.advisorId) ? 1 : 0
      if (aDet !== bDet) return bDet - aDet
      return findingImpactScore(b) - findingImpactScore(a)
    })

  const byAdvisor = new Map<AdvisorId, CouncilFinding>()
  for (const c of candidates) {
    if (!byAdvisor.has(c.advisorId)) byAdvisor.set(c.advisorId, c)
    if (byAdvisor.size >= 2) break
  }
  return [...byAdvisor.values()]
}

interface ScopedGap {
  advisorId: AdvisorId
  gap: CouncilDataGap
}

function pickBestGapForAdvisor(
  report: AdvisorReport,
  question: string,
): CouncilDataGap | null {
  if (report.dataGaps.length === 0) return null
  if (report.advisorId === 'hr') {
    return (
      report.dataGaps.find((g) => g.odooModel.includes('work_location_id')) ?? report.dataGaps[0]!
    )
  }
  if (report.advisorId === 'inventory') {
    return report.dataGaps.find((g) => g.odooModel.includes('mrp.bom')) ?? report.dataGaps[0]!
  }
  if (report.advisorId === 'seasons' && /رواتب|راتب|معاش|salary|payday/i.test(question)) {
    return (
      report.dataGaps.find((g) => /الرواتب|salary/i.test(`${g.missingAr} ${g.missingEn}`)) ??
      report.dataGaps[0]!
    )
  }
  return report.dataGaps[0]!
}

function collectRelevantGaps(params: {
  reports: readonly AdvisorReport[]
  topics: readonly AdvisoryTopic[]
  usedAdvisors: ReadonlySet<AdvisorId>
  branchId: string | null | undefined
  question: string
}): ScopedGap[] {
  const { reports, topics, usedAdvisors, branchId, question } = params
  if (topics.includes('strategy')) return []
  // Pure single-topic `sales` without other domains only shows gaps when a non-CFO domain was asked.
  if (topics.length === 1 && topics[0] === 'sales') return []

  const targetAdvisors = advisorListForTopics(topics).filter((id) => id !== 'cfo')
  const out: ScopedGap[] = []
  for (const advId of targetAdvisors) {
    const rep = reports.find((r) => r.advisorId === advId)
    if (!rep || rep.dataGaps.length === 0) continue

    const advisorRepresented = usedAdvisors.has(advId)
    // Surface the precise structural gap when:
    // - the advisor had no finding for this question/branch, OR
    // - HR was asked (surface `work_location_id` branch-link gap), OR
    // - Inventory was asked about losses (surface `mrp.bom` theoretical-usage gap).
    const needsStructuralGap =
      !advisorRepresented ||
      advId === 'hr' ||
      (advId === 'inventory' && !branchId)
    if (!needsStructuralGap) continue

    const chosen = pickBestGapForAdvisor(rep, question)
    if (chosen) out.push({ advisorId: advId, gap: chosen })
  }
  return out
}

function render(params: {
  primary: CouncilFinding | null
  linked: readonly CouncilFinding[]
  scopedGaps: readonly ScopedGap[]
  maxProposals: number
  dropProposals: ReadonlySet<string>
  formatSync: (iso: string) => string
}): { text: string; used: CouncilFinding[]; syncStrings: string[]; hourLabels: string[] } {
  const { primary, linked, scopedGaps, maxProposals, dropProposals, formatSync } = params
  const lines: string[] = []
  const used: CouncilFinding[] = []
  const syncStrings: string[] = []
  const hourLabels: string[] = []

  if (!primary && scopedGaps.length > 0) {
    for (const { advisorId, gap } of scopedGaps) {
      lines.push(
        `• غير متوفر في Odoo (${ADVISOR_NAME_AR[advisorId]} — ${gap.odooModel}): ${gap.missingAr}`,
      )
      lines.push(`• ابدأ بتسجيل: ${gap.recordAr}`)
    }
  }

  if (primary) {
    used.push(primary, ...linked)
    if (linked.length > 0) {
      // Cross-advisor synthesis (>= 2 advisors on same branch or same hour):
      // ONE unified observation, BOTH advisors' evidences, ONE unified root cause, ONE unified plan.
      const combinedTitle = [primary, ...linked]
        .map((f) => `${ADVISOR_NAME_AR[f.advisorId]}: ${f.titleAr}`)
        .join(' | ')
      lines.push(`• الملاحظة: ${combinedTitle}`)

      for (const f of [primary, ...linked]) {
        const ev = f.evidence
          .slice(0, 2)
          .map((e) => `${e.labelAr}: ${unitText(e)}`)
          .join('؛ ')
        lines.push(
          `• الدليل (${ADVISOR_NAME_AR[f.advisorId]} — ${f.evidence[0].odooModel}، ${f.evidence[0].period.from} → ${f.evidence[0].period.to}): ${ev}`,
        )
      }

      if (primary.entities.hour !== undefined) {
        hourLabels.push(`${pad2(primary.entities.hour)}:00`)
      }
      lines.push(`• لماذا: ${unifiedRootCause(primary, linked)}`)
    } else {
      lines.push(`• الملاحظة: ${primary.titleAr}`)
      const ev = primary.evidence
        .slice(0, 2)
        .map((e) => `${e.labelAr}: ${unitText(e)}`)
        .join('؛ ')
      lines.push(
        `• الدليل (${primary.evidence[0].odooModel}، ${primary.evidence[0].period.from} → ${primary.evidence[0].period.to}): ${ev}`,
      )
      lines.push(`• لماذا: ${primary.rootCause.ar}`)
    }

    // Interleave proposals across primary + linked so cross-domain plans cite actions from both advisors
    const candidateProposals: Array<{ p: CouncilFinding['proposals'][number]; key: string }> = []
    if (linked.length > 0) {
      if (primary.proposals[0]) {
        candidateProposals.push({ p: primary.proposals[0], key: `${primary.fingerprint}#0` })
      }
      for (const lf of linked) {
        if (lf.proposals[0]) {
          candidateProposals.push({ p: lf.proposals[0], key: `${lf.fingerprint}#0` })
        }
      }
      primary.proposals.slice(1).forEach((p, idx) => {
        candidateProposals.push({ p, key: `${primary.fingerprint}#${idx + 1}` })
      })
    } else {
      primary.proposals.forEach((p, idx) => {
        candidateProposals.push({ p, key: `${primary.fingerprint}#${idx}` })
      })
    }

    const proposals = candidateProposals
      .filter(({ key }) => !dropProposals.has(key))
      .slice(0, maxProposals)

    if (proposals.length > 0) {
      lines.push('• مقترحات:')
      for (const { p } of proposals) {
        lines.push(
          `  ◦ ${p.who.ar}: ${p.what.ar} — ${p.when.ar}.${p.expectedImpact ? ` ${estimateText(p.expectedImpact)}` : ''}`,
        )
      }
    }

    for (const { advisorId, gap } of scopedGaps) {
      lines.push(
        `• غير متوفر في Odoo (${ADVISOR_NAME_AR[advisorId]} — ${gap.odooModel}): ${gap.missingAr} — ابدأ بتسجيل: ${gap.recordAr}`,
      )
    }

    const fu = FOLLOW_UP[primary.kind]?.(primary)
    if (fu) lines.push(`• سؤال: ${fu}`)
  }

  if (lines.length === 0) return { text: '', used, syncStrings, hourLabels }

  const srcParts: string[] = []
  const citedAdvisorIds = new Set<AdvisorId>()
  for (const f of used) {
    if (citedAdvisorIds.has(f.advisorId)) continue
    citedAdvisorIds.add(f.advisorId)
    const e = f.evidence[0]
    const sync = e.syncAt ? formatSync(e.syncAt) : 'غير متاح'
    if (e.syncAt) syncStrings.push(sync)
    srcParts.push(
      `${ADVISOR_NAME_AR[f.advisorId]} (${e.odooModel}، ${e.period.from} → ${e.period.to}، آخر مزامنة: ${sync})`,
    )
  }
  for (const { advisorId, gap } of scopedGaps) {
    if (citedAdvisorIds.has(advisorId)) continue
    citedAdvisorIds.add(advisorId)
    srcParts.push(`${ADVISOR_NAME_AR[advisorId]} (${gap.odooModel} — فجوة بيانات)`)
  }
  if (srcParts.length > 0) lines.push(`• مصادر المستشارين: ${srcParts.join('؛ ')}`)

  return { text: lines.join('\n'), used, syncStrings, hourLabels }
}

function allowedFor(findings: readonly CouncilFinding[]): number[] {
  const out = councilNumbers([
    {
      advisorId: 'cfo',
      domainAr: '',
      domainEn: '',
      period: null,
      generatedAt: null,
      status: 'ready',
      findings: [...findings],
      dataGaps: [],
    },
  ])
  for (const f of findings) {
    for (const est of [f.weeklyImpact, ...f.proposals.map((p) => p.expectedImpact)]) {
      if (est) out.push(...numbersIn(est.formula))
    }
  }
  // Text shows signed changes as words ("fell 15.3%"), so the magnitude is the traced figure.
  return [...out, ...out.map((n) => Math.abs(n))]
}

const ISO_DATE_IN_TEXT_RE = /\b\d{4}-\d{2}-\d{2}\b/g

const ENTITY_NAMES = [
  ...GLOBAL_BRANCH_OPTIONS.flatMap((o) => [o.ar, o.en]),
  ...COMPANY_CONTEXT.branches.flatMap((b) => [b.ar, b.en]),
  COMPANY_CONTEXT.centralKitchen.ar,
  COMPANY_CONTEXT.centralKitchen.en,
  COMPANY_CONTEXT.exhibitionBooths.ar,
  COMPANY_CONTEXT.exhibitionBooths.en,
  '360/Stock',
  'QRN/Stock',
  'Odoo 17',
]

export function buildAdvisoryBlock(
  input: BuildAdvisoryInput,
  verify: (
    text: string,
    allowed: number[],
    opts: { allowedDateStrings: string[]; allowedEntityNames: string[] },
  ) => { valid: boolean; unverifiedNumbers: number[] },
): AdvisoryBlock | null {
  const council = input.council
  if (!council || council.reports.length === 0) return null

  const topics: readonly AdvisoryTopic[] = input.topics
    ? input.topics
    : input.topic
      ? [input.topic]
      : detectAdvisoryTopics(input.question)
  const detectedAdvisors = advisorListForTopics(topics)
  const seenSet = new Set<string>(input.seenFingerprints ?? [])
  const maxProposals = input.maxProposals ?? 3
  const formatSync = input.formatSync ?? ((iso: string) => iso.slice(0, 16).replace('T', ' '))

  const findings = selectRelevantFindings({
    reports: council.reports,
    topics,
    branchId: input.branchId,
    question: input.question,
    seen: seenSet,
  })
  const primary = findings[0] ?? null
  const linked = findCrossAdvisorLinked(primary, council.reports, detectedAdvisors, seenSet)
  const provisionalAdvisors = new Set<AdvisorId>(
    [primary, ...linked].filter((f): f is CouncilFinding => Boolean(f)).map((f) => f.advisorId),
  )
  const scopedGaps = collectRelevantGaps({
    reports: council.reports,
    topics,
    usedAdvisors: provisionalAdvisors,
    branchId: input.branchId,
    question: input.question,
  })

  const drop = new Set<string>()
  for (let attempt = 0; attempt < 4; attempt++) {
    const { text, used, syncStrings, hourLabels } = render({
      primary,
      linked,
      scopedGaps,
      maxProposals,
      dropProposals: drop,
      formatSync,
    })
    if (!text) return null

    const gapTexts = scopedGaps.map(({ gap }) => `${gap.missingAr} ${gap.recordAr}`).join(' ')
    const gapIsoDates = [...gapTexts.matchAll(ISO_DATE_IN_TEXT_RE)].map((m) => m[0])
    const allowedNumbers = [
      ...allowedFor(used),
      ...scopedGaps.flatMap(({ gap }) => numbersIn(`${gap.missingAr} ${gap.recordAr}`)),
    ]
    const allowedDateStrings = [
      ...new Set([
        ...used.flatMap((f) => f.evidence.flatMap((e) => [e.period.from, e.period.to])),
        ...syncStrings,
        ...gapIsoDates,
        ...hourLabels,
      ]),
    ]
    const check = verify(text, allowedNumbers, {
      allowedDateStrings,
      allowedEntityNames: ENTITY_NAMES,
    })
    const estimatesLabelled = text
      .split('\n')
      .filter((l) => /تقدير/.test(l))
      .every((l) => /تقدير: .+ = .+/.test(l))

    if (check.valid && estimatesLabelled) {
      const usedFingerprints = used.map((f) => f.fingerprint)
      if (input.seenFingerprints instanceof Set) {
        for (const fp of usedFingerprints) input.seenFingerprints.add(fp)
      }
      const allAdvisors = [
        ...new Set<AdvisorId>([
          ...used.map((f) => f.advisorId),
          ...scopedGaps.map((g) => g.advisorId),
        ]),
      ]
      return {
        text,
        allowedNumbers,
        allowedDateStrings,
        allowedEntityNames: ENTITY_NAMES,
        findings: usedFingerprints,
        advisors: allAdvisors,
        dataGaps: scopedGaps.map((g) => g.gap),
      }
    }

    // Regenerate without the proposals that carry unverified figures.
    const bad = new Set(check.unverifiedNumbers)
    const allUsed = [primary, ...linked].filter((f): f is CouncilFinding => Boolean(f))
    let dropped = false
    for (const f of allUsed) {
      f.proposals.forEach((p, i) => {
        const nums = numbersIn(
          `${p.who.ar} ${p.what.ar} ${p.when.ar} ${p.expectedImpact ? estimateText(p.expectedImpact) : ''}`,
        )
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
