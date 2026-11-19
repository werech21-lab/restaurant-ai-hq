import { describe, expect, it } from 'vitest'
import {
  YEAR_CLOSED_READ_TIMEOUT_MS,
  YEAR_PAYMENT_GROUP_BY,
  foldYearBranchChannels,
  yearReadCall,
} from '@/lib/odoo/pos-order-query'

const BRANCHES = ['360-mall', 'al-kout', 'assima', 'promenade', 'avenues', 'salmiya', 'ardiya'] as const
const CHANNELS = ['dine-in', 'talabat-tgo', 'takeaway-direct'] as const

describe('year branch channels', () => {
  it('groups the year payment read by session and method, with a 45s closed-year timeout', () => {
    expect([...YEAR_PAYMENT_GROUP_BY]).toEqual(['session_id', 'payment_method_id'])
    const closed = yearReadCall({ fromUtc: '2026-01-01 00:00:00', toUtc: '2026-11-19 00:00:00' })
    expect(closed.timeout?.timeoutMs).toBe(YEAR_CLOSED_READ_TIMEOUT_MS)
    expect(YEAR_CLOSED_READ_TIMEOUT_MS).toBe(45_000)
  })

  it('keeps each branch channel non-zero and adds the branches once to the year total', () => {
    const payments = [
      { configId: 17, methodName: 'Cash', netKwd: 134_698, orders: 4000 },
      { configId: 17, methodName: 'Talabat Go', netKwd: 90_004, orders: 2100 },
      { configId: 8, methodName: 'Cash', netKwd: 50_000, orders: 900 },
      { configId: 24, methodName: 'Cash', netKwd: 11_500, orders: 300 },
    ]
    const folded = foldYearBranchChannels({
      payments,
      branchOfConfig: (id) => (id === 17 ? '360-mall' : id === 8 ? 'promenade' : null),
      isDeliveryConfig: (id) => id === 24,
      channelOf: (method, isDelivery) => (method.includes('Talabat') ? 'talabat-tgo' : isDelivery ? 'takeaway-direct' : 'dine-in'),
      branchIds: BRANCHES,
      channelKeys: CHANNELS,
    })

    expect(folded.byBranch['360-mall']['dine-in'].netKwd).toBe(134_698)
    expect(folded.byBranch['360-mall']['talabat-tgo'].netKwd).toBe(90_004)
    expect(folded.byBranch.promenade['dine-in'].netKwd).toBe(50_000)
    expect(folded.unmapped['takeaway-direct'].netKwd).toBe(11_500)
    expect(folded.byBranch['360-mall']['dine-in'].netKwd).not.toBe(0)

    const branchNet = BRANCHES.reduce(
      (sum, id) => sum + CHANNELS.reduce((inner, key) => inner + (folded.byBranch[id][key]?.netKwd ?? 0), 0),
      0,
    )
    const unmappedNet = CHANNELS.reduce((sum, key) => sum + (folded.unmapped[key]?.netKwd ?? 0), 0)
    const inputNet = payments.reduce((sum, row) => sum + row.netKwd, 0)
    expect(branchNet + unmappedNet).toBe(inputNet)
    expect(folded.totalNet).toBe(inputNet)
    expect(branchNet + unmappedNet).toBe(folded.totalNet)
  })
})
