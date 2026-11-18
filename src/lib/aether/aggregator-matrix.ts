export interface AggregatorCell {
  netKwd: number
  orders: number
}

export interface AggregatorMatrixRow {
  branchId: string
  channelKey: string
  netKwd: number
  orders: number
}

export function aggregateAggregatorMatrix(input: {
  branchIds: readonly string[]
  channelKeys: readonly string[]
  cell: (branchId: string, channelKey: string) => AggregatorCell | null | undefined
  unattributed?: (channelKey: string) => AggregatorCell | null | undefined
}): { rows: AggregatorMatrixRow[]; byPlatform: Record<string, AggregatorCell> } {
  const rows: AggregatorMatrixRow[] = []
  const byPlatform: Record<string, AggregatorCell> = {}
  const branches = [...input.branchIds, 'unattributed']
  for (const branchId of branches) {
    for (const channelKey of input.channelKeys) {
      const source =
        branchId === 'unattributed'
          ? input.unattributed?.(channelKey)
          : input.cell(branchId, channelKey)
      const netKwd = Number(source?.netKwd) || 0
      const orders = Math.round(Number(source?.orders) || 0)
      rows.push({ branchId, channelKey, netKwd, orders })
      const prev = byPlatform[channelKey] ?? { netKwd: 0, orders: 0 }
      byPlatform[channelKey] = {
        netKwd: Math.round((prev.netKwd + netKwd) * 1000) / 1000,
        orders: prev.orders + orders,
      }
    }
  }
  return { rows, byPlatform }
}
