import { describe, expect, it } from 'vitest'
import { aggregateAggregatorMatrix } from '@/lib/aether/aggregator-matrix'
import { DASHBOARD_BRANCH_CARD_IDS } from '@/lib/aether/global-filter-engine'
import { monthCube } from '@/lib/__tests__/phase-5/support/feryal-dialect-fixture'

const CHANNELS = ['talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo', 'jahez', 'snoonu'] as const

describe('aggregator matrix rows sum to the platform totals', () => {
  it('sums each platform from the same fixture cells as the matrix', () => {
    const cube = monthCube()
    const result = aggregateAggregatorMatrix({
      branchIds: DASHBOARD_BRANCH_CARD_IDS,
      channelKeys: CHANNELS,
      cell: (branchId, channelKey) =>
        cube.byBranch[branchId as keyof typeof cube.byBranch]?.channels?.[
          channelKey as keyof (typeof cube.unattributed)['channels']
        ],
      unattributed: (channelKey) =>
        cube.unattributed.channels[channelKey as keyof typeof cube.unattributed.channels],
    })

    for (const channel of CHANNELS) {
      let expected = 0
      for (const branchId of DASHBOARD_BRANCH_CARD_IDS) {
        expected +=
          cube.byBranch[branchId as keyof typeof cube.byBranch]?.channels?.[
            channel as keyof (typeof cube.unattributed)['channels']
          ]?.netKwd ?? 0
      }
      expected +=
        cube.unattributed.channels[channel as keyof typeof cube.unattributed.channels]?.netKwd ?? 0
      expected = Math.round(expected * 1000) / 1000
      const rowSum = result.rows
        .filter((row) => row.channelKey === channel)
        .reduce((sum, row) => sum + row.netKwd, 0)
      expect(Math.round(rowSum * 1000) / 1000).toBe(expected)
      expect(result.byPlatform[channel]?.netKwd).toBe(expected)
    }
  })
})
