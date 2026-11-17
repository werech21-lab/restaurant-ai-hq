/** Review follow-up M2: an unknown brand order count stays unknown (null → —) on every screen. */
import { describe, expect, it } from 'vitest'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import { DEFAULT_GLOBAL_FILTERS, type GlobalFilters } from '@/lib/aether/global-filter-engine'
import { computeErpComparison } from '@/lib/erp-comparison-engine'
import { buildBrandOnlyCube } from './support/minimal-cube'

const RANGE = { from: '2026-11-10', to: '2026-11-16' }
const PRIOR = { from: '2026-11-03', to: '2026-11-09' }
const customFilters = (brand: string, branch = 'all'): GlobalFilters => ({
  ...DEFAULT_GLOBAL_FILTERS,
  period: 'custom',
  customFrom: RANGE.from,
  customTo: RANGE.to,
  brand: brand as GlobalFilters['brand'],
  branch: branch as GlobalFilters['branch'],
})

describe('M2 — Cores Hub custom period (cube path)', () => {
  it('brand share keeps a null order count as null (and AOV null), not 0', () => {
    const cube = buildBrandOnlyCube(RANGE, { 'china-garden': { netKwd: 120, orders: null, linesCount: 31 } })
    const snap = computeCoresHubSnapshot(customFilters('china-garden'), [], null, cube)
    const cg = snap.sales.brandShare.find((r) => r.id === 'china-garden')
    expect(cg?.salesKwd).toBe(120)
    expect(cg?.orders).toBeNull()
    expect(cg?.aovKwd).toBeNull()
  })

  it('a real brand order count still flows through', () => {
    const cube = buildBrandOnlyCube(RANGE, { 'china-garden': { netKwd: 120, orders: 18, linesCount: 31 } })
    const snap = computeCoresHubSnapshot(customFilters('china-garden'), [], null, cube)
    expect(snap.sales.brandShare.find((r) => r.id === 'china-garden')?.orders).toBe(18)
  })

  it('brand × branch: line counts are never shown as orders', () => {
    const cube = buildBrandOnlyCube(RANGE, { 'china-garden': { netKwd: 120, orders: 18, linesCount: 31 } })
    const snap = computeCoresHubSnapshot(customFilters('china-garden'), [], null, cube)
    const ardiya = snap.sales.branchRanking.find((r) => r.id === 'ardiya')
    expect(ardiya?.salesKwd).toBe(120)
    expect(ardiya?.orders).toBeNull()
  })
})

describe('M2 — ERP comparison', () => {
  const query = (brandIds: 'all' | ['china-garden'], branchIds: 'all' | ['ardiya'] = 'all') => ({
    mode: 'date-vs-date' as const,
    granularity: 'range' as const,
    periodA: RANGE,
    periodB: PRIOR,
    brandIds,
    branchIds,
    channelIds: 'all' as const,
  })

  it('brand slice with an unknown order count: completed orders and AOV are null and the KPI is unavailable', () => {
    const cubeA = buildBrandOnlyCube(RANGE, { 'china-garden': { netKwd: 120, orders: null, linesCount: 31 } })
    const cubeB = buildBrandOnlyCube(PRIOR, { 'china-garden': { netKwd: 100, orders: 15, linesCount: 25 } })
    const cmp = computeErpComparison(query(['china-garden']), { cubeA, cubeB })
    expect(cmp.selectionA.completedOrders).toBeNull()
    expect(cmp.selectionA.aovKwd).toBeNull()
    expect(cmp.selectionB.completedOrders).toBe(15)
    expect(cmp.kpis.completedOrders.available).toBe(false)
    expect(cmp.kpis.averageCheck.available).toBe(false)
  })

  it('brand × branch slice: line counts are not reported as orders', () => {
    const cubeA = buildBrandOnlyCube(RANGE, { 'china-garden': { netKwd: 120, orders: 18, linesCount: 31 } })
    const cubeB = buildBrandOnlyCube(PRIOR, { 'china-garden': { netKwd: 100, orders: 15, linesCount: 25 } })
    const cmp = computeErpComparison(query(['china-garden'], ['ardiya']), { cubeA, cubeB })
    expect(cmp.selectionA.netSalesKwd).toBe(120)
    expect(cmp.selectionA.completedOrders).toBeNull()
  })

  it('known brand orders are summed as before', () => {
    const cubeA = buildBrandOnlyCube(RANGE, { 'china-garden': { netKwd: 120, orders: 18, linesCount: 31 } })
    const cubeB = buildBrandOnlyCube(PRIOR, { 'china-garden': { netKwd: 100, orders: 15, linesCount: 25 } })
    const cmp = computeErpComparison(query(['china-garden']), { cubeA, cubeB })
    expect(cmp.selectionA.completedOrders).toBe(18)
    expect(cmp.kpis.completedOrders.available).toBe(true)
  })
})
