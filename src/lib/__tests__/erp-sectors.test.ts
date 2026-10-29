import { describe, expect, it } from 'vitest'
import { erpCatalog } from '@/lib/erp-catalog'
import { activeSectorId, erpSectors, filterSectors, linkPath, sectorSummary } from '@/lib/erp-sectors'
import type { MessageKey } from '@/lib/i18n'

const label = (key: MessageKey) => key

describe('ERP sectors', () => {
  it('groups every working module into the six sectors once', () => {
    expect(erpSectors).toHaveLength(6)
    const hrefs = erpSectors.flatMap((sector) => sector.links.map((link) => link.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const item of erpCatalog) {
      if (!item.href) continue
      const covered = hrefs.some((href) => linkPath(href) === item.href)
      expect(covered, item.id).toBe(true)
    }
  })

  it('follows the open tab when one route serves two sectors', () => {
    expect(activeSectorId('/erp/procurement', 'invoices')).toBe('finance')
    expect(activeSectorId('/erp/procurement', null)).toBe('supply')
    expect(activeSectorId('/erp/operations', 'quality')).toBe('supply')
    expect(activeSectorId('/erp/operations', 'contracts')).toBe('commercial')
    expect(activeSectorId('/erp/operations', null)).toBe('commercial')
    expect(activeSectorId('/erp/governance', 'tasks')).toBe('legal')
    expect(activeSectorId('/erp/hr', 'payroll')).toBe('people')
    expect(activeSectorId('/erp', null)).toBe('executive')
    expect(activeSectorId('/erp/admin', 'accounts')).toBe('legal')
    expect(activeSectorId('/erp/aggregator-radar', null)).toBe('executive')
  })

  it('uses live figures only when one company is in scope', () => {
    const metrics = {
      scoped: true,
      revenueMinor: 19680000,
      pendingApprovals: 2,
      stockAlerts: 1,
      postedJournals: 4,
      recipes: 3,
      deliveryOrders: 80,
    }
    expect(sectorSummary('finance', null)).toEqual({ kind: 'ready' })
    expect(sectorSummary('finance', { ...metrics, scoped: false })).toEqual({ kind: 'ready' })
    expect(sectorSummary('finance', metrics)).toEqual({ kind: 'finance', revenueMinor: 19680000, postedJournals: 4 })
    expect(sectorSummary('executive', metrics)).toEqual({ kind: 'pending', pendingApprovals: 2 })
    expect(sectorSummary('people', metrics)).toEqual({ kind: 'ready' })
  })

  it('hides a sector when the search misses every specialty', () => {
    expect(filterSectors(erpSectors, 'spec.kitchen', label).map((sector) => sector.id)).toEqual(['supply'])
    expect(filterSectors(erpSectors, 'missing-specialty', label)).toHaveLength(0)
  })
})
