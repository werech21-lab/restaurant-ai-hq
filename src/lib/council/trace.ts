import type { AdvisorReport, CouncilFinding } from './types'
import { GLOBAL_BRANCH_OPTIONS } from '@/lib/aether/global-filter-engine'
import { councilNumbers } from './runner'

/** Entity names that contain digits (e.g. «مول 360») are names, not figures. */
const NAME_TOKENS = [...GLOBAL_BRANCH_OPTIONS.flatMap((o) => [o.ar, o.en]), '360/Stock', '360']
  .filter((n) => /\d/.test(n))
  .sort((a, b) => b.length - a.length)

export function maskNames(text: string): string {
  let t = text
  for (const n of NAME_TOKENS) t = t.split(n).join(' ')
  return t
}

const ISO_DATE = /\d{4}-\d{2}-\d{2}/g
const NUM = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g

/** All text a finding shows (titles, root cause, proposals, estimate formulas excluded). */
export function findingTexts(f: CouncilFinding): string[] {
  return [
    f.titleAr, f.titleEn, f.rootCause.ar, f.rootCause.en,
    ...f.evidence.flatMap((e) => [e.labelAr, e.labelEn]),
    ...f.proposals.flatMap((p) => [p.who.ar, p.who.en, p.what.ar, p.what.en, p.when.ar, p.when.en]),
  ]
}

export function numbersIn(text: string): number[] {
  return [...maskNames(text).replace(ISO_DATE, ' ').matchAll(NUM)].map((m) => Number(m[0].replace(/,/g, '')))
}

/** Numbers shown in a report's text that no evidence value, estimate or threshold accounts for. */
export function untracedNumbers(report: AdvisorReport): { fingerprint: string; value: number }[] {
  const out: { fingerprint: string; value: number }[] = []
  for (const f of report.findings) {
    const allowed = councilNumbers([{ ...report, findings: [f] }])
    const ok = (n: number) => allowed.some((a) => Math.abs(Math.abs(a) - n) < 0.0005 || Math.abs(Math.round(Math.abs(a) * 10) / 10 - n) < 0.0005)
    for (const t of findingTexts(f)) for (const n of numbersIn(t)) if (!ok(n)) out.push({ fingerprint: f.fingerprint, value: n })
  }
  return out
}
