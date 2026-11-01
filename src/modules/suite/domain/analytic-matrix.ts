/** Deterministic analytic P&L decomposition for Venture Foods brand × branch cells (fils, half-up). */

export type AnalyticCell = {
  brandName: string
  branchName: string
  revenueMinor: number
  foodCostMinor: number
  payrollMinor: number
  commissionMinor: number
  netProfitMinor: number
  health: 'good' | 'warn' | 'bad'
}

const FOOD_COST_BPS = 2800n
const PAYROLL_BPS = 2200n
const COMMISSION_BPS = 1200n

function share(revenue: bigint, bps: bigint): bigint {
  if (revenue <= 0n) return 0n
  return (revenue * bps + 5000n) / 10_000n
}

export function decomposeRevenue(revenueMinor: number): Omit<AnalyticCell, 'brandName' | 'branchName' | 'health'> {
  const revenue = BigInt(revenueMinor)
  const foodCostMinor = Number(share(revenue, FOOD_COST_BPS))
  const payrollMinor = Number(share(revenue, PAYROLL_BPS))
  const commissionMinor = Number(share(revenue, COMMISSION_BPS))
  const netProfitMinor = revenueMinor - foodCostMinor - payrollMinor - commissionMinor
  return { revenueMinor, foodCostMinor, payrollMinor, commissionMinor, netProfitMinor }
}

export function cellHealth(netProfitMinor: number, revenueMinor: number): AnalyticCell['health'] {
  if (revenueMinor <= 0) return 'bad'
  const marginBps = Math.round((netProfitMinor * 10_000) / revenueMinor)
  if (marginBps >= 2500) return 'good'
  if (marginBps >= 1200) return 'warn'
  return 'bad'
}

export function buildAnalyticMatrix(
  rows: readonly { brandName: string; branchName: string; amountMinor: number }[],
): AnalyticCell[] {
  return rows.map((row) => {
    const parts = decomposeRevenue(row.amountMinor)
    return {
      brandName: row.brandName,
      branchName: row.branchName,
      ...parts,
      health: cellHealth(parts.netProfitMinor, parts.revenueMinor),
    }
  })
}
