import 'server-only'
/**
 * Feryal's executive summary of a council snapshot.
 *
 * The deterministic template is always available. When a provider key is configured, one AI rewrite
 * (Arabic, 3–5 lines) is attempted per snapshot and accepted only if every number in it already appears
 * in the council's facts (evidence, Estimate values / inputs, thresholds) or in the findings' own text
 * (titles, causes, proposals, dates) — checked with the shared number guard's set check. Anything else (no key, timeout, an unverified number) falls back to the template.
 * At most one provider call per snapshot per server instance, and none more often than every 6 hours.
 */
import { summaryFactNumbers, summaryFindings, templateSummary, type ExecutiveSummary } from '@/lib/council/executive-summary'
import type { CouncilSnapshot } from '@/lib/council/types'
import { errorFields, logger } from '@/lib/logger'
import { readCouncilKeys } from '@/server/ai/env'
import { resolveCouncilModels } from '@/server/ai/models'
import { decimalFromNumber, extractCanonicalDecimals, guardAnswerNumbers } from '@/server/ai/number-guard'
import { callProvider } from '@/server/ai/providers'

const MIN_INTERVAL_MS = 6 * 3_600_000
const g = globalThis as unknown as { councilSummaryCache?: { key: string; at: number; summary: ExecutiveSummary } }

const SYSTEM = [
  'أنت فريال، مستشارة تنفيذية لشركة مطاعم في الكويت.',
  'اكتب ملخصاً تنفيذياً من 3 إلى 5 أسطر بالعربية الفصحى المبسطة، كل سطر يبدأ بـ "- ".',
  'استخدم فقط الأرقام الموجودة في الحقائق المعطاة كما هي (لا تحسب أرقاماً جديدة، لا نسب جديدة، لا تقريب مختلف).',
  'رتّب حسب الأثر الأسبوعي بالدينار، واذكر لكل سطر: ما حدث، لماذا، والإجراء المقترح ومسؤوله.',
  'لا تضف معلومات غير موجودة في الحقائق. لا تذكر التواريخ إلا كما وردت.',
].join('\n')

/** Every number token the summary may contain (canonical form, both signs). */
export function summaryAllowedTokens(snapshot: CouncilSnapshot): Set<string> {
  const out = new Set<string>()
  for (const n of summaryFactNumbers(snapshot)) {
    for (const v of [n, -n]) {
      const c = decimalFromNumber(v)
      if (c) out.add(c)
    }
  }
  for (const f of snapshot.reports.flatMap((r) => r.findings)) {
    const texts = [f.titleAr, f.titleEn, f.rootCause.ar, f.rootCause.en, ...f.proposals.flatMap((p) => [p.who.ar, p.what.ar, p.when.ar, p.who.en, p.what.en, p.when.en]), ...f.evidence.flatMap((e) => [e.period.from, e.period.to])]
    for (const tok of extractCanonicalDecimals(texts.join(' '))) {
      out.add(tok)
      out.add(tok.startsWith('-') ? tok.slice(1) : `-${tok}`)
    }
  }
  return out
}

function factsFor(snapshot: CouncilSnapshot) {
  return summaryFindings(snapshot, 5).map((f) => ({
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
    const facts = factsFor(snapshot)
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
      const lines = res.text.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean).slice(0, 5)
      const guard = guardAnswerNumbers(lines.join('\n'), summaryAllowedTokens(snapshot))
      if (lines.length >= 2 && guard.ok) summary = { ...template, source: 'ai', ar: lines }
      else logger.info('council summary rejected by number guard', { offending: guard.offending.slice(0, 5) })
    }
  } catch (error) {
    logger.error('council summary failed', errorFields(error))
  }
  g.councilSummaryCache = { key, at: nowMs, summary }
  return summary
}
