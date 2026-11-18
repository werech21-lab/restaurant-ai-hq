/**
 * Strategic advisors (drivers · menu · benchmark · forecast) on the REAL 17 Nov 2026 payload
 * (06:05 Kuwait sync): 64 completed days × 7 branches of pos.order net / orders, the month hourly
 * profile and the Today bucket. No hand-written sales figures.
 */
import { describe, expect, it } from 'vitest'
import { backtestForecast, engineerMenu, forecastDay, robustZ, splitOrdersAov } from '@/lib/council/analytics'
import { benchmarkAdvisor, branchKpis, weekdayMatrix, FORMAT_DIFFERENCE_PCT } from '@/lib/council/advisors/benchmark'
import { contributions, driverWindows, driversAdvisor } from '@/lib/council/advisors/drivers'
import { detectAnomalies, forecastAdvisor, forecastNext7, marketWideDays, MAX_PUBLISHED_MAPE } from '@/lib/council/advisors/forecast'
import { menuAdvisor } from '@/lib/council/advisors/menu'
import { councilNumbers, runCouncil } from '@/lib/council/runner'
import { completedDailyByBranch, sumWindow } from '@/lib/council/series'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

const summary = loadLiveTodaySummary()
const d = completedDailyByBranch(summary)!

describe('analytics on real daily rows', () => {
  it('orders × basket split adds up to the change exactly (every branch, last 7 vs prior 7)', () => {
    const last = d.days[d.days.length - 1]
    const aFrom = d.days[d.days.length - 7]
    const bTo = d.days[d.days.length - 8]
    const bFrom = d.days[d.days.length - 14]
    for (const id of d.branchIds) {
      const a = sumWindow(d, aFrom, last, id)
      const b = sumWindow(d, bFrom, bTo, id)
      const s = splitOrdersAov(a, b)!
      expect(s.ordersEffectFils + s.basketEffectFils).toBe(a.netFils - b.netFils)
    }
  })

  it('robust z needs spread and 4+ points', () => {
    expect(robustZ(10, [10, 10, 10, 10])).toBeNull()
    expect(robustZ(10, [1, 2, 3])).toBeNull()
  })

  it('a forecast never reads data on or after its origin', () => {
    const origin = d.days[d.days.length - 7]
    const day = d.days[d.days.length - 3]
    const before = forecastDay(d, null, day, origin)
    const tampered = { ...d, byDay: { ...d.byDay } }
    for (const x of d.days.filter((x) => x >= origin)) tampered.byDay[x] = Object.fromEntries(Object.keys(d.byDay[x]).map((b) => [b, { netFils: 1, orders: 1 }]))
    expect(forecastDay(tampered, null, day, origin)).toBe(before)
  })

  it('the company forecast is backtested on 28 held-out days and published only under the error cap', () => {
    const bt = backtestForecast(d, null)!
    expect(bt.scoredDays).toBe(28)
    expect(bt.mapePct).toBeLessThanOrEqual(MAX_PUBLISHED_MAPE)
    const fc = forecastNext7(d, null)!
    expect(fc.next7.map((p) => p.day)).toEqual(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'])
    for (const p of fc.next7) expect(p.lowKwd).toBeLessThanOrEqual(p.forecastKwd)
    expect(fc.totalKwd).toBe(Math.round(fc.next7.reduce((s, p) => s + p.forecastKwd * 1000, 0)) / 1000)
  })

  it('menu quadrant needs at least 4 sold items: the real Today brand lines (3 sold) are not classified', () => {
    const byBrand = summary.buckets!.today!.byBrand as unknown as Record<string, { netKwd: number; qty: number }>
    const rows = Object.entries(byBrand).map(([id, b], i) => ({ productId: i + 1, name: id, brandId: 'all', qty: b.qty, netKwd: b.netKwd, discountKwd: 0, unitCostKwd: null }))
    expect(rows.filter((r) => r.qty > 0)).toHaveLength(3)
    expect(engineerMenu(rows)).toBeNull()
  })
})

describe('drivers advisor', () => {
  const w = driverWindows({ summary })!
  it('uses the payload daily rows (branch level) and says channel / brand are not in this payload', () => {
    expect(w.source).toBe('daily')
    const r = driversAdvisor.run({ summary })
    expect(r.status).toBe('partial')
    expect(r.dataGaps[0].missingEn).toMatch(/channel and brand/)
  })
  it('branch contributions add up to the company change to the fils', () => {
    const total = w.total.a.netFils - w.total.b.netFils
    expect(contributions(w, 'branch').reduce((s, r) => s + r.deltaFils, 0)).toBe(total)
  })
  it('names the branch that explains most of the drop and the dominant effect', () => {
    const r = driversAdvisor.run({ summary })
    const company = r.findings.find((f) => f.kind === 'company-split')!
    expect(company.titleEn).toMatch(/^Sales -5\.3%/)
    const top = r.findings.find((f) => f.kind === 'branch-driver-down')!
    expect(top.entities.branchId).toBe('promenade')
    expect(top.titleEn).toContain('mainly through basket size')
    expect(top.proposals[0].what.en).toMatch(/upsell/)
  })
})

describe('forecast & anomalies advisor', () => {
  it('Friday 13 Nov: three branches below normal together → one market-wide finding, not three local ones', () => {
    const m = marketWideDays(detectAnomalies(d))
    expect(m[0]).toMatchObject({ day: '2026-11-13', direction: 'drop' })
    expect(m[0].anomalies.map((a) => a.branchId).sort()).toEqual(['360-mall', 'assima', 'promenade'])
    const r = forecastAdvisor.run({ summary })
    const kinds = r.findings.map((f) => `${f.kind}:${f.entities.branchId ?? ''}:${f.evidence[0].period.from}`)
    expect(kinds).toContain('market-wide-drop::2026-11-13')
    expect(kinds).not.toContain('anomaly-drop:promenade:2026-11-13')
  })
  it('the forecast finding states its backtest error and flags last week’s unusual days', () => {
    const f = forecastAdvisor.run({ summary }).findings.find((x) => x.kind === 'forecast-next7')!
    expect(f.titleEn).toMatch(/model error 10\.0%/)
    expect(f.thresholds?.unusualBranchDaysLastWeek).toBeGreaterThan(0)
  })
  it('no payload → unavailable with the record to add, never a number', () => {
    const r = forecastAdvisor.run({ summary: null })
    expect(r.status).toBe('unavailable')
    expect(r.findings).toEqual([])
  })
})

describe('benchmark advisor', () => {
  it('28-day branch KPIs vs peers; a format difference (> 35% ticket gap) is not sized as lost upsell', () => {
    const k = branchKpis(d)!
    expect(k.rows).toHaveLength(7)
    const kout = k.rows.find((r) => r.branchId === 'al-kout')!
    expect(kout.aovVsPeersPct!).toBeLessThan(-FORMAT_DIFFERENCE_PCT)
    const r = benchmarkAdvisor.run({ summary })
    expect(r.findings.some((f) => f.entities.branchId === 'al-kout')).toBe(false)
  })
  it('weekday matrix: each branch profile sums to ~100% and gaps to the peer median are in points', () => {
    const m = weekdayMatrix(d)!
    for (const row of m.rows) expect(Math.abs(row.shares.reduce((s, v) => s + v, 0) - 100)).toBeLessThan(0.5)
  })
})

describe('menu advisor', () => {
  it('without product lines for a completed period: unavailable with the Odoo record to add', () => {
    const r = menuAdvisor.run({ cube: null })
    expect(r.status).toBe('unavailable')
    expect(r.dataGaps[0].odooModel).toBe('pos.order.line')
  })
})

describe('council integration', () => {
  const snap = runCouncil({ cfo: { summary }, seasons: { summary, events: [] }, drivers: { summary }, benchmark: { summary }, forecast: { summary } })
  it('runs nine advisors deterministically', () => {
    expect(snap.reports.map((r) => r.advisorId)).toEqual(['cfo', 'delivery', 'hr', 'inventory', 'seasons', 'drivers', 'menu', 'benchmark', 'forecast'])
    const again = runCouncil({ cfo: { summary }, seasons: { summary, events: [] }, drivers: { summary }, benchmark: { summary }, forecast: { summary } })
    expect(JSON.stringify(again)).toBe(JSON.stringify(snap))
  })
  it('every decimal in a new finding title is an evidence / estimate number', () => {
    const nums = new Set(councilNumbers(snap.reports).map((n) => Math.abs(n).toFixed(3)))
    for (const r of snap.reports.filter((x) => ['drivers', 'benchmark', 'forecast'].includes(x.advisorId))) {
      for (const f of r.findings) {
        for (const tok of f.titleEn.match(/\d+\.\d+/g) ?? []) expect(nums.has(Number(tok).toFixed(3)), `${tok} in "${f.titleEn}"`).toBe(true)
      }
    }
  })
})
