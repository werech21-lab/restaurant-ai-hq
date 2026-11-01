import { describe, expect, it } from 'vitest'
import { buildAnalyticMatrix, cellHealth, decomposeRevenue } from '@/modules/suite/domain/analytic-matrix'

describe('analytic profitability matrix', () => {
  it('decomposes revenue into BOM, payroll, commission and net without floats', () => {
    const parts = decomposeRevenue(1_000_000)
    expect(parts.foodCostMinor).toBe(280_000)
    expect(parts.payrollMinor).toBe(220_000)
    expect(parts.commissionMinor).toBe(120_000)
    expect(parts.netProfitMinor).toBe(380_000)
    expect(parts.foodCostMinor + parts.payrollMinor + parts.commissionMinor + parts.netProfitMinor).toBe(1_000_000)
  })

  it('marks health from net margin bands', () => {
    expect(cellHealth(380_000, 1_000_000)).toBe('good')
    expect(cellHealth(150_000, 1_000_000)).toBe('warn')
    expect(cellHealth(50_000, 1_000_000)).toBe('bad')
  })

  it('builds a 6×10-ready matrix from suite analytic rows', () => {
    const cells = buildAnalyticMatrix([
      { brandName: 'Farm Brown', branchName: 'Ardiya', amountMinor: 500_000 },
      { brandName: 'China Garden', branchName: 'Salmiya 1', amountMinor: 250_000 },
    ])
    expect(cells).toHaveLength(2)
    expect(cells[0]?.brandName).toBe('Farm Brown')
    expect(cells[0]?.netProfitMinor).toBe(decomposeRevenue(500_000).netProfitMinor)
  })
})
