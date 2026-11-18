import 'server-only'
/**
 * Feryal's executive summary of a council snapshot.
 *
 * The deterministic template is always available. When a provider key is configured, one AI rewrite
 * (Arabic, 3–5 lines) is attempted per snapshot. It is accepted only if EVERY line starts with the id
 * of one finding (`[F1]` …) and that line's numbers all belong to that same finding: its evidence
 * values, Estimate values / inputs, thresholds and hour, or numbers written in its own title / cause /
 * proposals; and every ISO date in the line is one of that finding's dates. Bare day / month integers
 * are never allowed on their own (dates are matched whole). Any failing line → the template is served.
 * At most one provider call per snapshot per server instance, and none more often than every 6 hours.
 */
import { summaryFindings, templateSummary, type ExecutiveSummary } from '@/lib/council/executive-summary'
import type { CouncilFinding, CouncilSnapshot } from '@/lib/council/types'
import { errorFields, logger } from '@/lib/logger'
import { readCouncilKeys } from '@/server/ai/env'
import { resolveCouncilModels } from '@/server/ai/models'
import { decimalFromNumber, extractCanonicalDecimals } from '@/server/ai/number-guard'
import { callProvider } from '@/server/ai/providers'

const MIN_INTERVAL_MS = 6 * 3_600_000
const g = globalThis as unknown as { councilSummaryCache?: { key: string; at: number; summary: ExecutiveSummary } }

const SYSTEM = [
  'أنت فريال، مستشارة تنفيذية لشركة مطاعم في الكويت.',
  'اكتب ملخصاً تنفيذياً من 3 إلى 5 أسطر بالعربية الفصحى المبسطة.',
  'كل سطر يتناول نتيجة واحدة فقط ويبدأ بمعرّفها بين قوسين مربعين كما ورد، مثل: [F1] ...',
  'في كل سطر استخدم فقط أرقام وتواريخ تلك النتيجة كما هي (لا تحسب أرقاماً جديدة، لا نسب جديدة، لا تقريب مختلف، لا أرقام من نتيجة أخرى).',
  'رتّب حسب الأثر الأسبوعي بالدينار، واذكر لكل سطر: ما حدث، لماذا، والإجراء المقترح ومسؤوله.',
  'لا تضف معلومات غير موجودة في الحقائق.',
].join('\n')

const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g
const LINE_TAG = /^\s*(?:[-•*]\s*)?\[F(\d+)\]\s*/

function findingTexts(f: CouncilFinding): string[] {
  return [f.titleAr, f.titleEn, f.rootCause.ar, f.rootCause.en, ...f.proposals.flatMap((p) => [p.who.ar, p.what.ar, p.when.ar, p.who.en, p.what.en, p.when.en])]
}

/** ISO dates a line about this finding may mention: its evidence periods and the dates in its texts. */
export function findingDates(f: CouncilFinding): Set<string> {
  const out = new Set<string>()
  for (const e of f.evidence) {
    out.add(e.period.from)
    out.add(e.period.to)
  }
  for (const text of findingTexts(f)) for (const m of text.matchAll(ISO_DATE)) out.add(m[0])
  return out
}

/**
 * Number tokens a line about this finding may contain (canonical, both signs): its evidence values,
 * Estimate values and inputs, thresholds and hour, and the numbers written in its own texts once ISO
 * dates are removed — so a bare "13" or "11" that only exists inside a date is never allowed.
 */
export function findingNumberTokens(f: CouncilFinding): Set<string> {
  const out = new Set<string>()
  const add = (tok: string | null) => {
    if (!tok) return
    out.add(tok)
    out.add(tok.startsWith('-') ? tok.slice(1) : tok === '0' ? '0' : `-${tok}`)
  }
  const nums: number[] = [...f.evidence.map((e) => e.value), ...Object.values(f.thresholds ?? {})]
  if (f.entities.hour !== undefined) nums.push(f.entities.hour)
  for (const est of [f.weeklyImpact, ...f.proposals.map((p) => p.expectedImpact)]) {
    if (est) nums.push(est.value, ...Object.values(est.inputs))
  }
  for (const n of nums) add(decimalFromNumber(n))
  for (const text of findingTexts(f)) for (const tok of extractCanonicalDecimals(text.replace(ISO_DATE, ' '))) add(tok)
  return out
}

export interface SummaryLineCheck {
  ok: boolean
  /** Lines with the finding id removed (for display). */
  lines: string[]
  failures: { line: number; reason: 'no-finding-tag' | 'unknown-finding' | 'date' | 'number'; token?: string }[]
}

/** Checks AI lines against the findings they name (`findings[i]` is `[F${i + 1}]`). */
export function checkSummaryLines(rawLines: readonly string[], findings: readonly CouncilFinding[]): SummaryLineCheck {
  const failures: SummaryLineCheck['failures'] = []
  const lines: string[] = []
  rawLines.forEach((raw, i) => {
    const m = LINE_TAG.exec(raw)
    if (!m) {
      failures.push({ line: i, reason: 'no-finding-tag' })
      return
    }
    const f = findings[Number(m[1]) - 1]
    const body = raw.slice(m[0].length).trim()
    lines.push(body)
    if (!f) {
      failures.push({ line: i, reason: 'unknown-finding', token: `F${m[1]}` })
      return
    }
    const dates = findingDates(f)
    for (const d of body.matchAll(ISO_DATE)) {
      if (!dates.has(d[0])) failures.push({ line: i, reason: 'date', token: d[0] })
    }
    const allowed = findingNumberTokens(f)
    for (const tok of extractCanonicalDecimals(body.replace(ISO_DATE, ' '))) {
      if (!allowed.has(tok)) failures.push({ line: i, reason: 'number', token: tok })
    }
  })
  return { ok: failures.length === 0 && lines.length > 0, lines, failures }
}

function factsFor(findings: readonly CouncilFinding[]) {
  return findings.map((f, i) => ({
    id: `F${i + 1}`,
    title: f.titleAr,
    cause: f.rootCause.ar,
    weeklyImpactKwd: f.weeklyImpact?.unit === 'KWD' ? { value: f.weeklyImpact.value, formula: f.weeklyImpact.formula } : null,
    evidence: f.evidence.map((e) => ({ label: e.labelAr, value: e.value, unit: e.unit, period: `${e.period.from} → ${e.period.to}` })),
    proposal: f.proposals[0] ? { who: f.proposals[0].who.ar, what: f.proposals[0].what.ar, when: f.proposals[0].when.ar } : null,
  }))
}

/** Template, or a guarded AI rewrite when available. Never throws. */
export async function executiveSummaryFor(snapshot: CouncilSnapshot, nowMs = Date.now()): Promise<ExecutiveSummary> {
  const template = templateSummary(snapshot)
  if (template.ar.length === 0) return template
  const key = `${snapshot.generatedAt ?? ''}:${template.basis.join('|')}`
  const cached = g.councilSummaryCache
  if (cached && (cached.key === key || nowMs - cached.at < MIN_INTERVAL_MS)) {
    return cached.key === key ? cached.summary : template
  }
  const apiKey = readCouncilKeys().anthropic
  if (apiKey.length < 20) return template
  let summary: ExecutiveSummary = template
  try {
    const picks = summaryFindings(snapshot, 5)
    const facts = factsFor(picks)
    const res = await callProvider({
      provider: 'anthropic',
      apiKey,
      model: resolveCouncilModels().anthropic,
      system: SYSTEM,
      user: `الحقائق (من مجلس المستشارين، مصدرها Odoo):\n${JSON.stringify(facts)}`,
      timeoutMs: 20_000,
      maxTokens: 600,
    })
    if (res.status === 'ok') {
      const raw = res.text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5)
      const check = checkSummaryLines(raw, picks)
      if (raw.length >= 2 && check.ok) summary = { ...template, source: 'ai', ar: check.lines }
      else logger.info('council summary rejected by per-finding number check', { failures: check.failures.slice(0, 5) })
    }
  } catch (error) {
    logger.error('council summary failed', errorFields(error))
  }
  g.councilSummaryCache = { key, at: nowMs, summary }
  return summary
}
