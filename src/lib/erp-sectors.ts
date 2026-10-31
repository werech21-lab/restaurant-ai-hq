import type { MessageKey } from '@/lib/i18n'

/** Seven Venture Foods divisions: six Odoo cores plus executive AI, legal and sync. */
export type SectorId = 'sales' | 'finance' | 'inventory' | 'people' | 'projects' | 'marketing' | 'executive'

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
    id: 'sales',
    title: 'sector.sales',
    links: [
      { href: '/erp/sales-crm?tab=crm', title: 'spec.crm' },
      { href: '/erp/sales-crm?tab=sales', title: 'spec.sales' },
      { href: '/erp/sales-crm?tab=pos', title: 'spec.pos' },
      { href: '/erp/sales-crm?tab=subscriptions', title: 'spec.subscriptions' },
      { href: '/erp/crm', title: 'erpnav.crm' },
    ],
  },
  {
    id: 'finance',
    title: 'sector.finance',
    links: [
      { href: '/erp/finance?tab=accounting', title: 'spec.accounting' },
      { href: '/erp/finance?tab=invoicing', title: 'spec.invoices' },
      { href: '/erp/finance?tab=expenses', title: 'spec.expenses' },
      { href: '/erp/finance?tab=analytic', title: 'spec.analytic' },
      { href: '/erp/ledger?tab=entries', title: 'spec.ledger' },
    ],
  },
  {
    id: 'inventory',
    title: 'sector.inventory',
    links: [
      { href: '/erp/inventory?tab=stock', title: 'spec.inventory' },
      { href: '/erp/inventory?tab=mrp', title: 'spec.mrp' },
      { href: '/erp/inventory?tab=purchase', title: 'spec.purchasing' },
      { href: '/erp/inventory?tab=plm', title: 'spec.plm' },
      { href: '/erp/inventory?tab=maintenance', title: 'spec.maintenance' },
      { href: '/erp/procurement?tab=requests', title: 'erpnav.procurement' },
      { href: '/erp/kitchen', title: 'spec.kitchen' },
      { href: '/erp/delivery', title: 'spec.delivery' },
      { href: '/erp/org', title: 'spec.org' },
      { href: '/erp/operations?tab=quality', title: 'spec.quality' },
    ],
  },
  {
    id: 'people',
    title: 'sector.people',
    links: [
      { href: '/erp/hr?tab=employees', title: 'spec.employees' },
      { href: '/erp/hr?tab=recruitment', title: 'spec.recruitment' },
      { href: '/erp/hr?tab=leaves', title: 'spec.leaves' },
      { href: '/erp/hr?tab=attendance', title: 'spec.attendance' },
      { href: '/erp/hr?tab=payroll', title: 'spec.payroll' },
    ],
  },
  {
    id: 'projects',
    title: 'sector.projects',
    links: [
      { href: '/erp/projects?tab=project', title: 'spec.project' },
      { href: '/erp/projects?tab=timesheets', title: 'spec.timesheets' },
      { href: '/erp/projects?tab=helpdesk', title: 'spec.helpdesk' },
    ],
  },
  {
    id: 'marketing',
    title: 'sector.marketing',
    links: [
      { href: '/erp/marketing?tab=website', title: 'spec.website' },
      { href: '/erp/marketing?tab=ecommerce', title: 'spec.ecommerce' },
      { href: '/erp/marketing?tab=email', title: 'spec.email' },
      { href: '/erp/marketing?tab=automation', title: 'spec.automation' },
      { href: '/erp/marketing?tab=radar', title: 'spec.radar' },
      { href: '/erp/aggregator-radar', title: 'erpnav.aggregator' },
    ],
  },
  {
    id: 'executive',
    title: 'sector.executive',
    links: [
      { href: '/erp/intelligence?tab=radar', title: 'spec.hq' },
      { href: '/erp/ai?tab=decisions', title: 'spec.ai' },
      { href: '/erp/governance?tab=tasks', title: 'spec.tasks' },
      { href: '/erp/contracts', title: 'spec.advisor' },
      { href: '/erp/compliance?tab=laws', title: 'spec.compliance' },
      { href: '/erp/archive', title: 'spec.archive' },
      { href: '/erp/odoo-sync', title: 'spec.odoo' },
      { href: '/erp/admin?tab=accounts', title: 'spec.admin' },
      { href: '/erp/iam', title: 'spec.iam' },
    ],
  },
]

const defaultTab: Record<string, string> = {
  '/erp/sales-crm': 'crm',
  '/erp/finance': 'invoicing',
  '/erp/inventory': 'stock',
  '/erp/ledger': 'entries',
  '/erp/procurement': 'requests',
  '/erp/hr': 'employees',
  '/erp/projects': 'project',
  '/erp/marketing': 'website',
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

/** The sector that owns the current screen. */
export function activeSectorId(path: string, tab: string | null): SectorId {
  if (path.startsWith('/erp/sales-crm') || path.startsWith('/erp/crm')) return 'sales'
  if (path.startsWith('/erp/projects')) return 'projects'
  if (path.startsWith('/erp/marketing') || path.startsWith('/erp/aggregator-radar')) return 'marketing'
  if (
    path.startsWith('/erp/odoo-sync') ||
    path.startsWith('/erp/admin') ||
    path.startsWith('/erp/iam') ||
    path.startsWith('/erp/ai') ||
    path.startsWith('/erp/intelligence') ||
    path.startsWith('/erp/contracts') ||
    path.startsWith('/erp/compliance') ||
    path.startsWith('/erp/archive') ||
    path.startsWith('/erp/governance') ||
    path === '/erp'
  ) {
    return 'executive'
  }
  if (path.startsWith('/erp/hr')) return 'people'
  if (
    path.startsWith('/erp/inventory') ||
    path.startsWith('/erp/kitchen') ||
    path.startsWith('/erp/delivery') ||
    path.startsWith('/erp/org') ||
    path.startsWith('/erp/operations') ||
    path.startsWith('/erp/procurement')
  ) {
    return 'inventory'
  }
  if (path.startsWith('/erp/finance') || path.startsWith('/erp/ledger')) return 'finance'
  return 'executive'
}

export function sectorSummary(id: SectorId, metrics: SectorMetrics | null): SectorSummary {
  if (!metrics?.scoped) return { kind: 'ready' }
  if (id === 'executive') return { kind: 'pending', pendingApprovals: metrics.pendingApprovals }
  if (id === 'finance') return { kind: 'finance', revenueMinor: metrics.revenueMinor, postedJournals: metrics.postedJournals }
  if (id === 'inventory') return { kind: 'supply', stockAlerts: metrics.stockAlerts, recipes: metrics.recipes, deliveryOrders: metrics.deliveryOrders }
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
