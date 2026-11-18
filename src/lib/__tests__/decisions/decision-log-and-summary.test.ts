/**
 * Decision log outcome measurement and the executive summary, on the REAL 17 Nov 2026 payload
 * (64 completed days × 7 branches, 2026-09-14 → 2026-11-16). No hand-written sales figures.
 */
import { describe, expect, it } from 'vitest'
import { measureDecisionOutcome, validateDecisionInput } from '@/lib/council/decisions'
import { summaryFactNumbers, templateSummary } from '@/lib/council/executive-summary'
import { runCouncil } from '@/lib/council/runner'
import { completedDailyByBranch, sumWindow } from '@/lib/council/series'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

const summary = loadLiveTodaySummary()
const d = completedDailyByBranch(summary)!

describe('decision outcome (before vs after, peers as control)', () => {
  it('a branch decision on 2026-10-19: 28 weekday-aligned days each side, lift = branch change − peers change', () => {
    const o = measureDecisionOutcome({ decidedDay: '2026-10-19', branchId: 'promenade' }, d)
    expect(o.state).toBe('measured')
    expect(o.scope).toBe('branch')
    expect(o.windowDays).toBe(28)
    expect(o.before).toMatchObject({ from: '2026-09-21', to: '2026-10-18' })
    expect(o.after).toMatchObject({ from: '2026-10-20', to: '2026-11-16' })
    // Independently recomputed from the same real rows.
    const a = sumWindow(d, '2026-10-20', '2026-11-16', 'promenade').netFils
    const b = sumWindow(d, '2026-09-21', '2026-10-18', 'promenade').netFils
    const pa = sumWindow(d, '2026-10-20', '2026-11-16').netFils - a
    const pb = sumWindow(d, '2026-09-21', '2026-10-18').netFils - b
    expect(o.before!.netKwd).toBe(b / 1000)
    expect(o.after!.netKwd).toBe(a / 1000)
    expect(o.changePct).toBe(Math.round(((a - b) / b) * 1000) / 10)
    expect(o.peersChangePct).toBe(Math.round(((pa - pb) / pb) * 1000) / 10)
    expect(o.liftPts).toBe(Math.round((o.changePct! - o.peersChangePct!) * 10) / 10)
    expect(o.weeklyLiftKwd).toBe(Math.round(((a - b * (pa / pb)) * 7) / 28) / 1000)
  })

  it('a company-wide decision has no control group: lift = own change', () => {
    const o = measureDecisionOutcome({ decidedDay: '2026-10-19', branchId: null }, d)
    expect(o.scope).toBe('company')
    expect(o.peersChangePct).toBeNull()
    expect(o.liftPts).toBe(o.changePct)
  })

  it('fewer than 7 completed days after the decision → too early; no payload → no data', () => {
    expect(measureDecisionOutcome({ decidedDay: '2026-11-12', branchId: 'salmiya' }, d)).toMatchObject({ state: 'too-early', daysAfter: 4, changePct: null })
    expect(measureDecisionOutcome({ decidedDay: '2026-10-19', branchId: 'salmiya' }, null).state).toBe('no-data')
  })

  it('validates decision requests (fingerprint shape, status, note length)', () => {
    expect(validateDecisionInput({ fingerprint: 'forecast:market-wide:drop:2026-11-13', status: 'accepted' })).toEqual({ fingerprint: 'forecast:market-wide:drop:2026-11-13', status: 'accepted', note: null })
    expect(validateDecisionInput({ fingerprint: 'forecast:x', status: 'approved' })).toBeNull()
    expect(validateDecisionInput({ fingerprint: '<script>', status: 'accepted' })).toBeNull()
    expect(validateDecisionInput({ fingerprint: 'menu:reprice:1', status: 'testing', note: 'x'.repeat(900) })!.note).toHaveLength(500)
  })
})

describe('executive summary (template)', () => {
  const snap = runCouncil({ cfo: { summary }, seasons: { summary, events: [] }, drivers: { summary }, benchmark: { summary }, forecast: { summary } })
  const s = templateSummary(snap)
  it('leads with the company headlines, then the actions ranked by weekly KWD', () => {
    expect(s.source).toBe('template')
    expect(s.ar.length).toBe(s.en.length)
    expect(s.basis[0]).toMatch(/^(drivers:company|forecast:)/)
    expect(s.basis.length).toBeGreaterThanOrEqual(3)
  })
  it('every decimal in the summary is an Odoo evidence / estimate number', () => {
    const facts = new Set(summaryFactNumbers(snap).map((n) => n.toFixed(3)))
    for (const line of [...s.ar, ...s.en]) {
      for (const tok of line.replace(/,/g, '').match(/\d+\.\d+/g) ?? []) expect(facts.has(Number(tok).toFixed(3)), `${tok} in "${line}"`).toBe(true)
    }
  })
})
