/**
 * Feryal Client & Event Contract Audit Helper (`src/lib/feryal-gemini-brain.ts`)
 *
 * Purged of all static `ODOO`, `LEDGER`, `EXB_UNIT`, `AETHER_FINDINGS`, and `JOURNEY_PLAYS`
 * baseline constants. Routes all chat requests exclusively to `askDualHeavyBrain`
 * (`POST /api/erp/feryal/chat`).
 */

import {
  askDualHeavyBrain,
  getDeterministicFeryalReply,
  type BrainMode,
} from './dual-heavy-brain'

export { getDeterministicFeryalReply }

export const FERYAL_VENTURE_FOODS_KNOWLEDGE =
  'شركة فنتشر فودز الكويت: 6 علامات تجارية معتمدة و7 فروع مربوطة في Odoo + بند غير منسوب لفرع. جميع الأرقام تستعلم حياً من Odoo فقط.'

export interface GeminiChatTurn {
  role: 'user' | 'model'
  text: string
}

export interface FeryalGeminiResponse {
  reply: string
  provider: 'gemini' | 'claude' | 'dual' | 'grok' | 'chatgpt' | 'deterministic' | 'odoo-live'
  model: string
}

export async function askFeryalGeminiBrain(params: {
  prompt: string
  lang?: 'ar' | 'en'
  mode?: BrainMode
  history?: GeminiChatTurn[]
  extraContext?: string
}): Promise<FeryalGeminiResponse> {
  const res = await askDualHeavyBrain({
    prompt: params.prompt,
    lang: params.lang,
    mode: params.mode,
    history: (params.history ?? []).map((t) => ({
      role: t.role === 'model' ? 'assistant' : 'user',
      content: t.text,
    })),
    extraContext: params.extraContext,
  })

  return {
    reply: res.reply,
    provider: res.provider,
    model: res.geminiModel || 'odoo-live',
  }
}

export interface ContractDeepAuditResult {
  provider: 'gemini' | 'deterministic'
  verdictAr: string
  verdictEn: string
  verdictBadgeAr: string
  verdictBadgeEn: string
  score: number
  strengthsAr: string[]
  strengthsEn: string[]
  trapsAr: string[]
  trapsEn: string[]
  risksAr: string[]
  risksEn: string[]
  counterClausesAr: string[]
  counterClausesEn: string[]
  solutionsAr: string[]
  solutionsEn: string[]
  negotiationScriptAr: string
  negotiationScriptEn: string
  recommendedActionAr: string
  recommendedActionEn: string
}

export interface EventContractAuditInput {
  eventName?: string
  organizer?: string
  rentKwd?: number
  boothRentKwd?: number
  days?: number
  durationDays?: number
  expectedDailyVisitors?: number
  revenueSharePct?: number
  exclusivityGranted?: boolean
  rainForceMajeureClause?: boolean
  electricityIncluded?: boolean
  targetBrand?: string
  clausesText?: string
  contractText?: string
  eventDescription?: string
  executiveVision?: string
  attachmentBase64?: string
  attachmentMimeType?: string
  lang?: 'ar' | 'en'
}

/**
 * Evaluates user-submitted hypothetical booth/event contract text & simulator inputs strictly
 * from the submitted form values without injecting any static company sales or baseline numbers.
 */
export async function analyzeEventContractWithGemini(
  contractInput: EventContractAuditInput,
): Promise<ContractDeepAuditResult> {
  const safeDays = Math.max(
    1,
    Math.round(Number(contractInput.durationDays ?? contractInput.days) || 1),
  )
  const safeRent = Math.max(
    0,
    Number(contractInput.boothRentKwd ?? contractInput.rentKwd) || 0,
  )
  const dailyRent = Math.round(safeRent / safeDays)
  const rawText = `${contractInput.contractText ?? ''} ${contractInput.clausesText ?? ''}`.trim()
  const hasForceMajeure =
    Boolean(contractInput.rainForceMajeureClause) ||
    /قوة قاهرة|أمطار|توقف جوي|force majeure|weather/i.test(rawText)
  const hasExclusivity =
    Boolean(contractInput.exclusivityGranted) ||
    /حصرية|حصري|exclusiv/i.test(rawText)
  const hasElectricity =
    Boolean(contractInput.electricityIncluded) ||
    /كهرباء|تيار|مولد|electric|power/i.test(rawText)
  const hasRevShareInText =
    (Number(contractInput.revenueSharePct) || 0) > 0 ||
    /نسبة من المبيعات|revenue share|commission/i.test(rawText)

  let score = 82
  const risksAr: string[] = []
  const risksEn: string[] = []
  const strengthsAr: string[] = []
  const strengthsEn: string[] = []

  if (!rawText && !contractInput.attachmentBase64) {
    score -= 10
    risksAr.push('لم يتم إرفاق نص بنود العقد بعد؛ تم تقييم مدخلات المحاكاة الافتراضية فقط.')
    risksEn.push('No contract text attached yet; evaluation reflects submitted simulator inputs only.')
  }

  if (hasRevShareInText && safeRent > 0) {
    score -= 18
    risksAr.push(
      `الجمع بين إيجار ثابت (${safeRent.toLocaleString('en-US')} د.ك) ونسبة مشاركة مبيعات يزيد التزامات المعرض الافتراضية.`,
    )
    risksEn.push(
      `Combining fixed rent (${safeRent.toLocaleString('en-US')} KWD) with a revenue share clause increases fee exposure.`,
    )
  } else {
    strengthsAr.push('هيكل الإيجار المدخل واضح دون ازدواج مع نسبة مشاركة مبيعات.')
    strengthsEn.push('Submitted rent structure avoids dual fixed-rent plus revenue-share overlap.')
  }

  if (!hasForceMajeure) {
    score -= 12
    risksAr.push('لم يظهر بند صريح للإعفاء من الإيجار اليومي في حالات التوقف الجوي أو القوة القاهرة.')
    risksEn.push('No explicit daily rent abatement clause detected for weather or force-majeure stops.')
  } else {
    strengthsAr.push('يتضمن النص إشارة لحماية التوقف الجوي أو القوة القاهرة.')
    strengthsEn.push('Includes weather or force-majeure protection clause.')
  }

  if (!hasExclusivity) {
    score -= 8
    risksAr.push('غياب شرط حصرية الفئة الغذائية قد يسمح بتكرار نفس النشاط في الموقع.')
    risksEn.push('Absence of category exclusivity may allow direct category overlap at the venue.')
  } else {
    strengthsAr.push('يتضمن النص إشارة لحصرية الفئة الغذائية.')
    strengthsEn.push('Includes category exclusivity clause.')
  }

  if (!hasElectricity) {
    score -= 6
    risksAr.push('يلزم تثبيت شمولية الأحمال الكهربائية والتراخيص البلدية ضمن الإيجار المدخل.')
    risksEn.push('Confirm three-phase electrical load and municipal permit coverage in base rent.')
  }

  const finalScore = Math.max(20, Math.min(95, score))
  const counterClausesAr = [
    'تثبيت بند إعفاء نسبي من الإيجار عن أي يوم يتوقف فيه المعرض بقرار تنظيمي أو ظرف جوي.',
    'النص صراحة على شمولية الكهرباء الثلاثية والحراسة الليلية دون رسوم إضافية.',
    'ربط الدفعات المالية بمراحل التسليم الفعلي للموقع وجاهزية التشغيل.',
  ]
  const counterClausesEn = [
    'Add pro-rata daily rent abatement for any organizer or weather-mandated closure day.',
    'Explicitly include three-phase power and overnight security in the base booth rent.',
    'Tie installment payments to physical site handover and operational readiness.',
  ]
  const solutionsAr = [
    'تجهيز التحضيرات الأساسية في مطبخ العارضية المركزي والاكتفاء بالتسوية السريعة في الموقع.',
    'تخصيص نقطة بيع مستقلة في Odoo عند التعاقد الفعلي لفصل مبيعات المعرض عن الفروع السبعة.',
  ]
  const solutionsEn = [
    'Prepare base items at Ardiya Central Kitchen and limit on-site work to final assembly.',
    'Register a dedicated POS config in Odoo upon signing so actual booth sales stay cleanly tracked.',
  ]

  const verdictAr =
    finalScore >= 72
      ? `مراجعة البنود المدخلة (${finalScore}/100): الإيجار اليومي الافتراضي ${dailyRent.toLocaleString('en-US')} د.ك لمدة ${safeDays} يوم.`
      : `يوصى بتعديل البنود التحفظية قبل التوقيع (${finalScore}/100) — الإيجار اليومي المدخل ${dailyRent.toLocaleString('en-US')} د.ك.`
  const verdictEn =
    finalScore >= 72
      ? `Submitted Clause Review (${finalScore}/100): Hypothetical daily rent ${dailyRent.toLocaleString('en-US')} KWD over ${safeDays} days.`
      : `Protective clause revisions advised prior to signing (${finalScore}/100) — ${dailyRent.toLocaleString('en-US')} KWD/day.`

  return {
    provider: 'deterministic',
    verdictAr,
    verdictEn,
    verdictBadgeAr: verdictAr,
    verdictBadgeEn: verdictEn,
    score: finalScore,
    strengthsAr,
    strengthsEn,
    trapsAr: risksAr,
    trapsEn: risksEn,
    risksAr,
    risksEn,
    counterClausesAr,
    counterClausesEn,
    solutionsAr,
    solutionsEn,
    negotiationScriptAr: counterClausesAr.join(' '),
    negotiationScriptEn: counterClausesEn.join(' '),
    recommendedActionAr:
      finalScore >= 72
        ? 'استكمال المراجعة المالية مع المدير المالي قبل الاعتماد.'
        : 'التفاوض على البنود التحفظية المسجلة أعلاه قبل أي التزام مالي.',
    recommendedActionEn:
      finalScore >= 72
        ? 'Proceed to final CFO review before commitment.'
        : 'Negotiate the flagged protective clauses before committing funds.',
  }
}
