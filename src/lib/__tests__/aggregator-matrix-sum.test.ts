import { describe, expect, it } from 'vitest'
import { aggregateAggregatorMatrix } from '@/lib/aether/aggregator-matrix'
import { DASHBOARD_BRANCH_CARD_IDS } from '@/lib/aether/global-filter-engine'
import { monthCube } from '@/lib/__tests__/phase-5/support/feryal-dialect-fixture'

const CHANNELS = ['talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo', 'jahez', 'snoonu'] as const
type ChannelKey = (typeof CHANNELS)[number]

function cellNet(cube: ReturnType<typeof monthCube>, branchId: string, channel: ChannelKey): number {
  if (branchId === 'unattributed') return cube.unattributed.channels[channel]?.netKwd ?? 0
  return cube.byBranch[branchId as keyof typeof cube.byBranch]?.channels?.[channel]?.netKwd ?? 0
}

describe('aggregator matrix rows sum to the platform totals', () => {
  it('matches byChannel when branches plus unattributed are that channel', () => {
    const cube = monthCube()
    for (const channel of CHANNELS) {
      const net = DASHBOARD_BRANCH_CARD_IDS.reduce(
        (sum, branchId) => sum + cellNet(cube, branchId, channel),
        cellNet(cube, 'unattributed', channel),
      )
      cube.byChannel[channel] = {
        netKwd: Math.round(net * 1000) / 1000,
        orders: cube.byChannel[channel]?.orders ?? 0,
      }
    }

    const result = aggregateAggregatorMatrix({
      branchIds: DASHBOARD_BRANCH_CARD_IDS,
      channelKeys: CHANNELS,
      cell: (branchId, channelKey) =>
        cube.byBranch[branchId as keyof typeof cube.byBranch]?.channels?.[channelKey as ChannelKey],
      unattributed: (channelKey) => cube.unattributed.channels[channelKey as ChannelKey],
    })

    for (const channel of CHANNELS) {
      const rowSum = result.rows
        .filter((row) => row.channelKey === channel)
        .reduce((sum, row) => sum + row.netKwd, 0)
      expect(Math.round(rowSum * 1000) / 1000).toBe(cube.byChannel[channel].netKwd)
      expect(result.byPlatform[channel]?.netKwd).toBe(cube.byChannel[channel].netKwd)
    }
  })
})
