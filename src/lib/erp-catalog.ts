import type { MessageKey } from '@/lib/i18n'

export type CatalogStatus = 'ready' | 'beta' | 'planned'

export type CatalogBranch = { href: string; title: MessageKey }

export type CatalogItem = {
  id: string
  href?: string
  title: MessageKey
  detail: MessageKey
  status: CatalogStatus
  branches?: readonly CatalogBranch[]
}

export const erpCatalog: readonly CatalogItem[] = [
  { id: 'sales-crm', href: '/erp/sales-crm', title: 'sector.sales', detail: 'hub.crm', status: 'ready', branches: [
    { href: '/erp/sales-crm?tab=crm', title: 'spec.crm' },
    { href: '/erp/sales-crm?tab=sales', title: 'spec.sales' },
    { href: '/erp/sales-crm?tab=pos', title: 'spec.pos' },
    { href: '/erp/sales-crm?tab=subscriptions', title: 'spec.subscriptions' },
  ] },
  { id: 'finance', href: '/erp/finance', title: 'erpnav.finance', detail: 'hub.finance', status: 'ready' },
  { id: 'ledger', href: '/erp/ledger', title: 'erpnav.ledger', detail: 'hub.ledger', status: 'ready' },
  { id: 'inventory', href: '/erp/inventory', title: 'erpnav.inventory', detail: 'hub.inventory', status: 'ready' },
  { id: 'procurement', href: '/erp/procurement', title: 'erpnav.procurement', detail: 'hub.procurement', status: 'ready' },
  { id: 'hr', href: '/erp/hr', title: 'erpnav.hr', detail: 'hub.hr', status: 'ready', branches: [
    { href: '/erp/hr?tab=employees', title: 'hub.branch.employees' },
    { href: '/erp/hr?tab=recruitment', title: 'spec.recruitment' },
    { href: '/erp/hr?tab=attendance', title: 'hub.branch.attendance' },
    { href: '/erp/hr?tab=leaves', title: 'hub.branch.leaves' },
    { href: '/erp/hr?tab=payroll', title: 'hub.branch.payroll' },
  ] },
  { id: 'projects', href: '/erp/projects', title: 'sector.projects', detail: 'spec.project', status: 'ready' },
  { id: 'marketing', href: '/erp/marketing', title: 'sector.marketing', detail: 'hub.aggregator', status: 'ready' },
  { id: 'crm', href: '/erp/crm', title: 'erpnav.crm', detail: 'hub.crm', status: 'ready' },
  { id: 'org', href: '/erp/org', title: 'erpnav.org', detail: 'hub.org', status: 'ready' },
  { id: 'kitchen', href: '/erp/kitchen', title: 'nav.kitchen', detail: 'hub.kitchen', status: 'ready' },
  { id: 'delivery', href: '/erp/delivery', title: 'nav.delivery', detail: 'hub.delivery', status: 'ready' },
  { id: 'operations', href: '/erp/operations', title: 'erpnav.operations', detail: 'hub.ops', status: 'ready' },
  { id: 'contracts', href: '/erp/contracts', title: 'erpnav.contracts', detail: 'hub.advisor', status: 'ready' },
  { id: 'compliance', href: '/erp/compliance', title: 'erpnav.compliance', detail: 'hub.compliance', status: 'ready' },
  { id: 'archive', href: '/erp/archive', title: 'erpnav.archive', detail: 'hub.archive', status: 'ready' },
  { id: 'intelligence', href: '/erp/intelligence', title: 'erpnav.intelligence', detail: 'hub.intelligence', status: 'ready' },
  { id: 'governance', href: '/erp/governance', title: 'erpnav.governance', detail: 'hub.governance', status: 'ready' },
  { id: 'ai', href: '/erp/ai', title: 'erpnav.ai', detail: 'hub.ai', status: 'ready' },
  { id: 'odoo', href: '/erp/odoo-sync', title: 'spec.odoo', detail: 'odoo.lead', status: 'ready' },
  { id: 'admin', href: '/erp/admin', title: 'erpnav.admin', detail: 'hub.admin', status: 'ready' },
  { id: 'iam', href: '/erp/iam', title: 'erpnav.iam', detail: 'hub.iam', status: 'ready' },
  { id: 'aggregator', href: '/erp/aggregator-radar', title: 'erpnav.aggregator', detail: 'hub.aggregator', status: 'ready', branches: [
    { href: '/erp/aggregator-radar?view=apps#rank', title: 'hub.branch.platforms' },
    { href: '/erp/aggregator-radar?view=pulse#rank', title: 'hub.branch.georank' },
    { href: '/erp/aggregator-radar#gap', title: 'hub.branch.gap' },
    { href: '/erp/aggregator-radar#escalation', title: 'hub.branch.escalation' },
  ] },
]

export function filterCatalog(items: readonly CatalogItem[], query: string, label: (key: MessageKey) => string): CatalogItem[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return [...items]
  return items.filter((item) => {
    const branches = (item.branches ?? []).map((branch) => label(branch.title)).join(' ')
    return `${label(item.title)} ${label(item.detail)} ${branches}`.toLocaleLowerCase().includes(needle)
  })
}
