import type { MessageKey } from '@/lib/i18n'

/** The six executive sectors. Every specialty is an existing route. */
export type SectorId = 'executive' | 'finance' | 'supply' | 'people' | 'legal' | 'system'

export type SectorLink = { href: string; title: MessageKey }

export type ErpSector = { id: SectorId; title: MessageKey; links: readonly SectorLink[] }

/** Live figures the hub may show. Money stays in integer fils. */
export type SectorMetrics = {
  scoped: boolean
  revenueMinor: number
  pendingApprovals: number
  stockAlerts: number
  postedJournals: number
  recipes: number
  deliveryOrders: number
}

export type SectorSummary =
  | { kind: 'ready' }
  | { kind: 'pending'; pendingApprovals: number }
  | { kind: 'finance'; revenueMinor: number; postedJournals: number }
  | { kind: 'supply'; stockAlerts: number; recipes: number; deliveryOrders: number }

export const erpSectors: readonly ErpSector[] = [
  {
    id: 'executive',
    title: 'sector.executive',
    links: [
      { href: '/erp', title: 'spec.hq' },
      { href: '/erp/ai?tab=decisions', title: 'spec.ai' },
      { href: '/erp/aggregator-radar', title: 'spec.radar' },
      { href: '/erp/intelligence?tab=radar', title: 'spec.market' },
      { href: '/erp/governance?tab=tasks', title: 'spec.tasks' },
    ],
  },
  {
    id: 'finance',
    title: 'sector.finance',
    links: [
      { href: '/erp/ledger?tab=entries', title: 'spec.ledger' },
      { href: '/erp/ledger?tab=accounts', title: 'spec.accounts' },
      { href: '/erp/procurement?tab=requests', title: 'spec.purchasing' },
      { href: '/erp/finance', title: 'spec.invoices' },
      { href: '/erp/hr?tab=expenses', title: 'spec.expenses' },
    ],
  },
  {
    id: 'supply',
    title: 'sector.supply',
    links: [
      { href: '/erp/inventory', title: 'spec.inventory' },
      { href: '/erp/kitchen', title: 'spec.kitchen' },
      { href: '/erp/org', title: 'spec.org' },
      { href: '/erp/delivery', title: 'spec.delivery' },
      { href: '/erp/crm', title: 'spec.crm' },
      { href: '/erp/operations?tab=quality', title: 'spec.quality' },
    ],
  },
  {
    id: 'people',
    title: 'sector.people',
    links: [
      { href: '/erp/hr?tab=employees', title: 'spec.employees' },
      { href: '/erp/hr?tab=attendance', title: 'spec.attendance' },
      { href: '/erp/hr?tab=leaves', title: 'spec.leaves' },
      { href: '/erp/hr?tab=payroll', title: 'spec.payroll' },
      { href: '/erp/hr?tab=appraisals', title: 'spec.appraisals' },
      { href: '/erp/hr?tab=appointments', title: 'spec.appointments' },
    ],
  },
  {
    id: 'legal',
    title: 'sector.legal',
    links: [
      { href: '/erp/contracts', title: 'spec.advisor' },
      { href: '/erp/compliance?tab=laws', title: 'spec.compliance' },
      { href: '/erp/governance?tab=violations', title: 'spec.violations' },
      { href: '/erp/governance?tab=inquiry', title: 'spec.inquiry' },
      { href: '/erp/governance?tab=monitor', title: 'spec.monitor' },
      { href: '/erp/archive', title: 'spec.archive' },
    ],
  },
  {
    id: 'system',
    title: 'sector.system',
    links: [
      { href: '/erp/odoo-sync', title: 'spec.odoo' },
      { href: '/erp/admin?tab=accounts', title: 'spec.admin' },
      { href: '/erp/iam', title: 'spec.iam' },
    ],
  },
]

const defaultTab: Record<string, string> = {
  '/erp/ledger': 'entries',
  '/erp/procurement': 'requests',
  '/erp/hr': 'employees',
  '/erp/operations': 'contracts',
  '/erp/governance': 'violations',
  '/erp/intelligence': 'radar',
  '/erp/ai': 'decisions',
  '/erp/compliance': 'laws',
  '/erp/admin': 'accounts',
}

export function linkPath(href: string): string {
  return href.split('?')[0] ?? href
}

export function linkTab(href: string): string | null {
  const query = href.split('?')[1]
  if (!query) return null
  return new URLSearchParams(query).get('tab')
}

/** The tab a workspace shows when the address has none. */
export function effectiveTab(path: string, tab: string | null): string | null {
  if (tab) return tab
  return defaultTab[path] ?? null
}

/**
 * The sector that owns the current screen. A shared route such as procurement follows the open tab,
 * and `/erp/governance` stays in legal even when the task tab was opened from human resources.
 */
export function activeSectorId(path: string, tab: string | null): SectorId {
  if (path.startsWith('/erp/odoo-sync') || path.startsWith('/erp/admin') || path.startsWith('/erp/iam')) return 'system'
  if (path === '/erp' || path.startsWith('/erp/ai') || path.startsWith('/erp/aggregator-radar') || path.startsWith('/erp/intelligence')) return 'executive'
  if (path.startsWith('/erp/governance') && tab === 'tasks') return 'executive'
  if (path.startsWith('/erp/hr') && tab === 'expenses') return 'finance'
  if (path.startsWith('/erp/finance') || path.startsWith('/erp/ledger') || path.startsWith('/erp/procurement')) return 'finance'
  if (path.startsWith('/erp/hr')) return 'people'
  if (
    path.startsWith('/erp/inventory') ||
    path.startsWith('/erp/kitchen') ||
    path.startsWith('/erp/delivery') ||
    path.startsWith('/erp/org') ||
    path.startsWith('/erp/crm') ||
    path.startsWith('/erp/operations')
  ) {
    return 'supply'
  }
  if (path.startsWith('/erp/contracts') || path.startsWith('/erp/compliance') || path.startsWith('/erp/archive') || path.startsWith('/erp/governance')) {
    return 'legal'
  }
  return 'executive'
}

export function sectorSummary(id: SectorId, metrics: SectorMetrics | null): SectorSummary {
  if (!metrics?.scoped) return { kind: 'ready' }
  if (id === 'executive') return { kind: 'pending', pendingApprovals: metrics.pendingApprovals }
  if (id === 'finance') return { kind: 'finance', revenueMinor: metrics.revenueMinor, postedJournals: metrics.postedJournals }
  if (id === 'supply') return { kind: 'supply', stockAlerts: metrics.stockAlerts, recipes: metrics.recipes, deliveryOrders: metrics.deliveryOrders }
  return { kind: 'ready' }
}

export function filterSectors(sectors: readonly ErpSector[], query: string, label: (key: MessageKey) => string): ErpSector[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return sectors.map((sector) => ({ ...sector, links: [...sector.links] }))
  return sectors
    .map((sector) => {
      if (label(sector.title).toLowerCase().includes(needle)) return { ...sector, links: [...sector.links] }
      return {
        ...sector,
        links: sector.links.filter((link) => label(link.title).toLowerCase().includes(needle)),
      }
    })
    .filter((sector) => sector.links.length > 0)
}
