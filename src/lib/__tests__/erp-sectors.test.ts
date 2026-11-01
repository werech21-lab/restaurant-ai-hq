import { describe, expect, it } from 'vitest'
import { activeSectorId, erpSectors, filterSectors, linkPath, sectorSummary } from '@/lib/erp-sectors'
import type { MessageKey } from '@/lib/i18n'

const label = (key: MessageKey) => key

describe('ERP sectors', () => {
  it('groups modules into seven divisions with unique links and no marketing/inventory duplicates', () => {
    expect(erpSectors).toHaveLength(7)
    const hrefs = erpSectors.flatMap((sector) => sector.links.map((link) => link.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)

    const marketing = erpSectors.find((sector) => sector.id === 'marketing')
    expect(marketing?.links.filter((link) => linkPath(link.href) === '/erp/aggregator-radar' || link.href.includes('tab=radar'))).toHaveLength(1)
    expect(marketing?.links.some((link) => link.title === 'erpnav.aggregator')).toBe(true)
    expect(marketing?.links.some((link) => link.title === 'spec.radar')).toBe(false)

    const inventory = erpSectors.find((sector) => sector.id === 'inventory')
    expect(inventory?.links.map((link) => link.href)).toEqual([
      '/erp/inventory?tab=stock',
      '/erp/inventory?tab=mrp',
      '/erp/inventory?tab=purchase',
      '/erp/inventory?tab=plm',
      '/erp/inventory?tab=maintenance',
    ])
    expect(inventory?.links.some((link) => ['erpnav.procurement', 'spec.kitchen', 'spec.delivery', 'spec.org', 'spec.quality'].includes(link.title))).toBe(false)
  })

  it('follows the open tab when one route serves two sectors', () => {
    expect(activeSectorId('/erp/sales-crm', 'pos')).toBe('sales')
    expect(activeSectorId('/erp/procurement', 'invoices')).toBe('inventory')
    expect(activeSectorId('/erp/operations', 'quality')).toBe('inventory')
    expect(activeSectorId('/erp/hr', 'expenses')).toBe('people')
    expect(activeSectorId('/erp/governance', 'tasks')).toBe('executive')
    expect(activeSectorId('/erp/hr', 'payroll')).toBe('people')
    expect(activeSectorId('/erp', null)).toBe('executive')
    expect(activeSectorId('/erp/admin', 'accounts')).toBe('executive')
    expect(activeSectorId('/erp/odoo-sync', null)).toBe('executive')
    expect(activeSectorId('/erp/marketing', 'radar')).toBe('marketing')
    expect(activeSectorId('/erp/projects', 'helpdesk')).toBe('projects')
    expect(activeSectorId('/erp/aggregator-radar', null)).toBe('marketing')
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
    expect(sectorSummary('inventory', metrics)).toEqual({
      kind: 'supply',
      stockAlerts: 1,
      recipes: 3,
      deliveryOrders: 80,
    })
  })

  it('hides a sector when the search misses every specialty', () => {
    expect(filterSectors(erpSectors, 'spec.mrp', label).map((sector) => sector.id)).toEqual(['inventory'])
    expect(filterSectors(erpSectors, 'missing-specialty', label)).toHaveLength(0)
  })
})
