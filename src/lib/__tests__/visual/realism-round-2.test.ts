/**
 * Round 2 realism fixes, on the real 17 Nov 2026 payload (06:05 Kuwait sync):
 * - Cores: the brand donut total (product lines) is reconciled against POS net, gap shown;
 *   zero-sale brands / channels are listed by name, not as 0.000 rows.
 * - Home Today: "so far · until hh:mm" and a same-hours comparison with yesterday.
 * - Before/After: the headline is the value after; the change is a labelled badge.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import { DEFAULT_GLOBAL_FILTERS } from '@/lib/aether/global-filter-engine'
import { resolveTodaySameHoursComparison } from '@/lib/aether/hero-delta'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

const summary = loadLiveTodaySummary()
const today = { ...DEFAULT_GLOBAL_FILTERS, period: 'today' as const }

describe('Cores brand reconciliation (real Today bucket)', () => {
  const snap = computeCoresHubSnapshot(today, [], summary)
  it('brand basis Σ = 160.300 vs POS net 154.700 → gap −5.600, all from the payload', () => {
    const byBrand = summary.buckets!.today!.byBrand as unknown as Record<string, { netKwd: number }>
    const brandSum = Math.round(Object.values(byBrand).reduce((s, b) => s + b.netKwd, 0) * 1000) / 1000
    expect(snap.sales.brandReconciliation).toEqual({
      brandTotalKwd: brandSum,
      posNetKwd: summary.buckets!.today!.totals.netSalesKwd as number,
      gapKwd: Math.round(((summary.buckets!.today!.totals.netSalesKwd as number) - brandSum) * 1000) / 1000,
    })
    expect(snap.sales.brandReconciliation!.gapKwd).toBe(-5.6)
  })
  it('no reconciliation line when a single brand is selected', () => {
    expect(computeCoresHubSnapshot({ ...today, brand: 'china-garden' }, [], summary).sales.brandReconciliation).toBeNull()
  })
  it('the studio lists zero-sale brands and channels by name instead of 0.000 rows', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/aether/CoresHubStudio.tsx'), 'utf8')
    expect(src).toContain('data-idle-brands="true"')
    expect(src).toContain('data-idle-channels="true"')
    expect(src).toContain('data-brand-reconciliation="true"')
  })
})

describe('Home Today: same completed hours vs yesterday', () => {
  const series = summary.hourlySeries ?? []
  it('compares only hours before the cutoff on both days (identical series → 0.0%)', () => {
    const r = resolveTodaySameHoursComparison(series, series, 13)
    const expected = Math.round(series.filter((h) => h.hour < 13).reduce((s, h) => s + h.netKwd, 0) * 1000) / 1000
    expect(r).toEqual({ cutoffHour: 13, todayKwd: expected, yesterdayKwd: expected, pct: 0 })
  })
  it('no comparison without both hourly series or before the first completed hour', () => {
    expect(resolveTodaySameHoursComparison(series, null, 13)).toBeNull()
    expect(resolveTodaySameHoursComparison(null, series, 13)).toBeNull()
    expect(resolveTodaySameHoursComparison(series, series, 0)).toBeNull()
  })
  it('Home shows "so far today · until hh:mm" and labels the comparison with the cutoff hour', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/aether/FullJourney360.tsx'), 'utf8')
    expect(src).toContain('data-today-so-far="true"')
    expect(src).toContain('مقارنة بأمس حتى')
    expect(src).toContain('data-idle-booths="true"')
  })
  it('every recorded-zero branch card (0 KWD, 0 orders) collapses to the named line; unknown (null) keeps its card', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/aether/FullJourney360.tsx'), 'utf8')
    expect(src).toContain('const isIdleBoothCard = (row: BranchCardRow): boolean => row.salesKwd === 0 && row.orders === 0')
    expect(src).toContain("بلا مبيعات حتى الآن اليوم: ")
  })
  it('the 7-day pulse falls back to the month bucket\'s real daily rows when the payload has no week bucket', () => {
    expect(summary.buckets && 'week' in summary.buckets).toBe(false)
    const month = computeCoresHubSnapshot({ ...DEFAULT_GLOBAL_FILTERS, period: 'month' }, [], summary).sales.timeline
    expect(month.length).toBeGreaterThanOrEqual(7)
    expect(month.slice(-7).map((d) => d.id)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'])
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/aether/FullJourney360.tsx'), 'utf8')
    expect(src).toContain("computeCoresHubSnapshot({ ...filters, period: 'month' }, [], liveSummary)")
  })
})

describe('Warehouse table cells', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/components/erp/WarehouseDailyChainStudio.tsx'), 'utf8')
  it('a branch with no recorded movement shows «—», not a row of 0.000', () => {
    expect(src).toContain('data-no-movement="true"')
  })
  it('LTR codes / quantities sit in a <bdi>, so the RTL column alignment is kept', () => {
    expect(src).not.toMatch(/<td dir="ltr"/)
    expect(src).toContain('<bdi dir="ltr">{sku.code}</bdi>')
  })
  it('global CSS aligns any dir="ltr" table cell with its column in Arabic pages', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')
    expect(css).toContain('html[dir="rtl"] td[dir="ltr"].text-end { text-align: left; }')
    expect(css).toContain('html[dir="rtl"] :is(td, th).tabular-nums.text-end { text-align: left; }')
  })
})

describe('Before/After KPI cards', () => {
  it('headline is the value after; the change is a labelled badge; before is spelled out', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/aether/BeforeAfterStudio.tsx'), 'utf8')
    expect(src).toContain("formatKpiVal(kpi, 'after', resolvedLocale)")
    expect(src).toContain('data-kpi-change="true"')
    expect(src).toContain("isAr ? 'التغيّر' : 'Change'")
    expect(src).toContain("isAr ? 'قبل:' : 'Before:'")
  })
})

describe('panel pages: no recorded value → «—», never 0.000 (full-site audit)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
  it('inventory and stock count: a product cost of 0 is "not recorded", not a 0.000 cost / estimate', () => {
    expect(read('src/app/(panel)/inventory/page.tsx')).toContain('formatKwd(row.costPrice > 0 ? row.costPrice : null')
    expect(read('src/app/(panel)/stock-count/page.tsx')).toContain('estCostKwd: item.costPrice > 0 ? item.currentStock * item.costPrice : null')
  })
  it('HR directory: no salary on file shows «—», not a 0.000 KWD contract', () => {
    expect(read('src/components/hr/EnterpriseHrCommandHub.tsx')).toContain('if (!(emp.basicSalary > 0)) return null')
  })
  it('BI insights: no invoices → no invented 0% / +100% growth or margin; no cash accounts → no projection', () => {
    const bi = read('src/services/bi.service.ts')
    expect(bi).toContain('const growth: number | null = salesPrev <= 0.001 ? null')
    expect(bi).toContain('const marginNow: number | null = salesNow <= 0.001 ? null')
    expect(bi).toContain('cashAccounts.length > 0 ?')
    expect(bi).not.toContain('(salesNow > 0 ? 100 : 0)')
  })
})
