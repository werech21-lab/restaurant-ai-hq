/**
 * Advisor council on REAL cached data only:
 * - the live 17 Nov 2026 payload (per-branch daily rows synced 06:00 Kuwait);
 * - the real Odoo export of 31 Oct 2026 (hr.attendance, hr.employee departments, stock.quant).
 * Expected values are what Odoo holds; inputs that are not cached are asserted as unavailable.
 */
import { describe, expect, it } from 'vitest'
import { cfoAdvisor } from '@/lib/council/advisors/cfo'
import { deliveryAdvisor } from '@/lib/council/advisors/delivery'
import { hrAdvisor } from '@/lib/council/advisors/hr'
import { inventoryAdvisor } from '@/lib/council/advisors/inventory'
import { SUGGESTED_SEASON_EVENTS, seasonsAdvisor } from '@/lib/council/advisors/seasons'
import { rankDiscoveries, runCouncil } from '@/lib/council/runner'
import { completedDailyByBranch, sumWindow } from '@/lib/council/series'
import { untracedNumbers } from '@/lib/council/trace'
import { loadLiveTodaySummary, loadOdooExport, realHrInput, realInventoryInput } from './support'

const summary = loadLiveTodaySummary()
const fullInputs = () => ({
  cfo: { summary },
  hr: realHrInput(),
  inventory: realInventoryInput(),
  seasons: { summary, events: SUGGESTED_SEASON_EVENTS },
})

describe('completed periods only', () => {
  it('drops the sync day (17 Nov, partial at 06:00) and keeps 14 Sep → 16 Nov', () => {
    const d = completedDailyByBranch(summary)!
    expect(d.days[0]).toBe('2026-09-14')
    expect(d.days[d.days.length - 1]).toBe('2026-11-16')
    expect(d.days).not.toContain('2026-11-17')
  })
})

describe('CFO advisor (real 17 Nov payload)', () => {
  const r = cfoAdvisor.run({ summary })
  const byKind = (k: string) => r.findings.find((f) => f.kind === k)!

  it('week-over-week: Assima diverges from the company; values equal Σ of the real daily rows', () => {
    const f = byKind('wow-divergence')
    expect(f.entities.branchId).toBe('assima')
    const d = completedDailyByBranch(summary)!
    const a = sumWindow(d, '2026-11-10', '2026-11-16', 'assima')
    const b = sumWindow(d, '2026-11-03', '2026-11-09', 'assima')
    expect(f.evidence[0]).toMatchObject({ odooModel: 'pos.order', period: { from: '2026-11-10', to: '2026-11-16' }, value: a.netFils / 1000 })
    expect(f.evidence[1]).toMatchObject({ period: { from: '2026-11-03', to: '2026-11-09' }, value: b.netFils / 1000 })
    expect(f.evidence[0].value).toBe(3285.029)
    expect(f.evidence[1].value).toBe(3877.102)
    expect(f.weeklyImpact).toMatchObject({ label: 'Estimate', value: 592.073, formula: 'prior-week net − last-week net' })
    expect(f.proposals.length).toBeGreaterThanOrEqual(2)
  })

  it('basket shrink at The Avenues and the Ardiya Friday gap are found from the same rows', () => {
    expect(byKind('basket-shrink')).toMatchObject({ entities: { branchId: 'avenues' } })
    expect(byKind('weekday-gap')).toMatchObject({ entities: { branchId: 'ardiya', weekday: 5 } })
  })

  it('reports the cube and the GL lock as data gaps (not in this payload) — no profit figure', () => {
    expect(r.status).toBe('partial')
    expect(r.dataGaps.map((g) => g.odooModel)).toEqual(['pos.order.line / pos.payment', 'res.company (period_lock_date)'])
    expect(JSON.stringify(r.findings)).not.toMatch(/profit/i)
  })

  it('is unavailable without a payload', () => {
    const empty = cfoAdvisor.run({ summary: null })
    expect(empty.status).toBe('unavailable')
    expect(empty.findings).toEqual([])
  })
})

describe('Delivery advisor', () => {
  it('without the hour × branch × platform matrix: unavailable, data gaps only, no numbers', () => {
    const r = deliveryAdvisor.run({})
    expect(r.status).toBe('unavailable')
    expect(r.findings).toEqual([])
    expect(r.dataGaps.map((g) => g.odooModel)).toEqual(['pos.payment', 'pos.payment'])
    expect(r.dataGaps[0].missingEn).toMatch(/TGO\/TMP/)
  })
})

describe('HR advisor (real 31 Oct export)', () => {
  const r = hrAdvisor.run(realHrInput())
  it('counts the real shifts: 865 closed, 186 over 10 h, 137 over 12 h, 135 open (1000-row sample)', () => {
    const missed = r.findings.find((f) => f.kind === 'missed-checkout')!
    expect(missed.evidence.find((e) => e.domain === 'check_out set, duration > 12 h')!.value).toBe(137)
    expect(missed.evidence.find((e) => e.domain === 'check_out set')!.value).toBe(865)
    expect(r.findings.find((f) => f.kind === 'overtime')!.evidence[0].value).toBe(186)
    expect(r.findings.find((f) => f.kind === 'open-checkins')!.evidence[0].value).toBe(135)
  })
  it('lists the missing branch link and the sample cap as data gaps', () => {
    expect(r.dataGaps.map((g) => g.odooModel)).toContain('hr.employee (work_location_id)')
    expect(r.dataGaps.some((g) => /1000/.test(g.missingEn))).toBe(true)
  })
  it('never carries an employee name', () => {
    const names = loadOdooExport().models['hr.employee'].map((e) => (e as unknown as { name: string }).name).filter((n) => n && n.length > 5)
    const text = JSON.stringify(r)
    for (const n of names) expect(text.includes(n)).toBe(false)
  })
  it('is unavailable without attendance', () => {
    expect(hrAdvisor.run({ attendance: null }).status).toBe('unavailable')
  })
})

describe('Inventory advisor (real 31 Oct export)', () => {
  const r = inventoryAdvisor.run(realInventoryInput())
  it('360 Mall: 18 of 94 sampled items negative; other locations reported as evidence', () => {
    const f = r.findings[0]
    expect(f).toMatchObject({ kind: 'negative-stock', entities: { branchId: '360-mall' } })
    expect(f.evidence[0].value).toBe(18)
    expect(f.evidence[1].value).toBe(94)
  })
  it('names stock.move and mrp.bom as missing (not exported / not probed live)', () => {
    expect(r.dataGaps.map((g) => g.odooModel)).toEqual(['stock.quant', 'stock.move / stock.scrap', 'mrp.bom / mrp.bom.line'])
  })
})

describe('Seasons advisor (real daily rows)', () => {
  const r = seasonsAdvisor.run({ summary, events: SUGGESTED_SEASON_EVENTS })
  it('salary days: compares the two previous salary windows in the data vs normal days', () => {
    const f = r.findings.find((x) => x.fingerprint.startsWith('seasons:salary-days'))!
    expect(f.evidence.filter((e) => e.labelEn === 'Average day in the window').map((e) => e.period)).toEqual([
      { from: '2026-10-25', to: '2026-10-31' },
      { from: '2026-09-25', to: '2026-10-01' },
    ])
    expect(f.proposals).toHaveLength(3)
  })
  it('a season whose last-year window is not in the data is a data gap, never a number', () => {
    expect(r.dataGaps.some((g) => g.missingEn.includes('Ramadan') && g.missingEn.includes('2026-02-18'))).toBe(true)
    expect(r.findings.some((f) => f.fingerprint.includes('ramadan'))).toBe(false)
  })
})

describe('council runner', () => {
  it('every number in every report traces to evidence, an Estimate or a declared threshold', () => {
    for (const rep of runCouncil(fullInputs()).reports) expect(untracedNumbers(rep), rep.advisorId).toEqual([])
  })

  it('is deterministic', () => {
    expect(runCouncil(fullInputs())).toEqual(runCouncil(fullInputs()))
  })

  it("Today's Discoveries: top 3 by impact × novelty, and nothing shown in the last 7 days repeats", () => {
    const snap = runCouncil(fullInputs())
    expect(snap.discoveries).toHaveLength(3)
    const scores = snap.discoveries.map((d) => d.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    const seen = new Set(snap.discoveries.map((d) => d.finding.fingerprint))
    const next = rankDiscoveries(snap.reports, seen)
    for (const d of next) expect(seen.has(d.finding.fingerprint)).toBe(false)
  })

  it('links advisors that point at the same branch', () => {
    const snap = runCouncil(fullInputs())
    const salary = snap.discoveries.find((d) => d.finding.fingerprint.startsWith('seasons:salary-days'))
    expect(salary?.linkedAdvisors).toContain('cfo')
  })

  it('with no inputs every advisor is unavailable and there are no discoveries', () => {
    const snap = runCouncil({})
    expect(snap.reports.every((r) => r.status === 'unavailable')).toBe(true)
    expect(snap.discoveries).toEqual([])
  })
})
