import { describe, expect, it } from 'vitest'
import posRegistry from '@/lib/odoo/pos-registry.json'
import {
  YEAR_CLOSED_READ_TIMEOUT_MS,
  YEAR_PAYMENT_GROUP_BY,
  foldYearBranchChannels,
  yearReadCall,
} from '@/lib/odoo/pos-order-query'

const BRANCHES = ['360-mall', 'al-kout', 'assima', 'promenade', 'avenues', 'salmiya', 'ardiya'] as const
const CHANNELS = ['dine-in', 'talabat-tgo', 'takeaway-direct'] as const

const deliveryIds = Object.entries(posRegistry.registers)
  .filter(([, row]) => 'delivery' in row && row.delivery === true)
  .map(([id]) => Number(id))
  .sort((a, b) => a - b)

describe('delivery register ids', () => {
  it('keeps the round-6 delivery set, including registers 11, 15, 18, 20 and 22', () => {
    expect(deliveryIds).toEqual([3, 11, 15, 18, 20, 22, 23, 24, 35])
  })

  it('keeps year takeaway at 24,276 and leaves dine-in on the non-delivery registers', () => {
    const isDelivery = (id: number) => deliveryIds.includes(id)
    const payments = [
      { configId: 11, methodName: 'Cash', netKwd: 1_000, orders: 10 },
      { configId: 15, methodName: 'Cash', netKwd: 1_000, orders: 10 },
      { configId: 18, methodName: 'Cash', netKwd: 1_000, orders: 10 },
      { configId: 20, methodName: 'Cash', netKwd: 1_098, orders: 10 },
      { configId: 22, methodName: 'Cash', netKwd: 1_000, orders: 10 },
      { configId: 24, methodName: 'Cash', netKwd: 12_000, orders: 80 },
      { configId: 3, methodName: 'Cash', netKwd: 7_178, orders: 40 },
      { configId: 17, methodName: 'Cash', netKwd: 134_698, orders: 4000 },
      { configId: 17, methodName: 'Talabat Go', netKwd: 90_004, orders: 2100 },
    ]
    const folded = foldYearBranchChannels({
      payments,
      branchOfConfig: (id) => (id === 17 ? '360-mall' : id === 3 ? 'ardiya' : id === 11 ? 'promenade' : null),
      isDeliveryConfig: isDelivery,
      channelOf: (method, delivery) =>
        method.includes('Talabat') ? 'talabat-tgo' : delivery ? 'takeaway-direct' : 'dine-in',
      branchIds: BRANCHES,
      channelKeys: CHANNELS,
    })
    const takeaway =
      BRANCHES.reduce((sum, id) => sum + (folded.byBranch[id]['takeaway-direct']?.netKwd ?? 0), 0) +
      (folded.unmapped['takeaway-direct']?.netKwd ?? 0)
    const dineIn =
      BRANCHES.reduce((sum, id) => sum + (folded.byBranch[id]['dine-in']?.netKwd ?? 0), 0) +
      (folded.unmapped['dine-in']?.netKwd ?? 0)
    expect(takeaway).toBe(24_276)
    expect(dineIn).toBe(134_698)
    expect(folded.byBranch['360-mall']['talabat-tgo'].netKwd).toBe(90_004)
  })
})

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
