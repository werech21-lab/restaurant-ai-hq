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
  { id: 'finance', href: '/erp/finance', title: 'erpnav.finance', detail: 'hub.finance', status: 'ready' },
  { id: 'ledger', href: '/erp/ledger', title: 'erpnav.ledger', detail: 'hub.ledger', status: 'ready' },
  { id: 'procurement', href: '/erp/procurement', title: 'erpnav.procurement', detail: 'hub.procurement', status: 'ready' },
  { id: 'inventory', href: '/erp/inventory', title: 'erpnav.inventory', detail: 'hub.inventory', status: 'ready' },
  { id: 'crm', href: '/erp/crm', title: 'erpnav.crm', detail: 'hub.crm', status: 'ready' },
  { id: 'org', href: '/erp/org', title: 'erpnav.org', detail: 'hub.org', status: 'ready' },
  { id: 'iam', href: '/erp/iam', title: 'erpnav.iam', detail: 'hub.iam', status: 'ready' },
  { id: 'admin', href: '/erp/admin', title: 'erpnav.admin', detail: 'hub.admin', status: 'ready', branches: [
    { href: '/erp/admin?tab=accounts', title: 'hub.branch.accounts' },
    { href: '/erp/admin?tab=permissions', title: 'hub.branch.permissions' },
    { href: '/erp/admin?tab=activity', title: 'hub.branch.activity' },
  ] },
  { id: 'hr', href: '/erp/hr', title: 'erpnav.hr', detail: 'hub.hr', status: 'ready', branches: [
    { href: '/erp/hr?tab=employees', title: 'hub.branch.employees' },
    { href: '/erp/hr?tab=attendance', title: 'hub.branch.attendance' },
    { href: '/erp/hr?tab=leaves', title: 'hub.branch.leaves' },
    { href: '/erp/hr?tab=payroll', title: 'hub.branch.payroll' },
    { href: '/erp/hr?tab=appraisals', title: 'hub.branch.appraisals' },
    { href: '/erp/hr?tab=expenses', title: 'hub.branch.expenses' },
  ] },
  { id: 'operations', href: '/erp/operations', title: 'erpnav.operations', detail: 'hub.ops', status: 'ready', branches: [
    { href: '/erp/operations?tab=contracts', title: 'hub.branch.contracts' },
    { href: '/erp/operations?tab=documents', title: 'hub.branch.documents' },
    { href: '/erp/operations?tab=quality', title: 'hub.branch.quality' },
  ] },
  { id: 'contracts', href: '/erp/contracts', title: 'erpnav.contracts', detail: 'hub.advisor', status: 'ready' },
  { id: 'compliance', href: '/erp/compliance', title: 'erpnav.compliance', detail: 'hub.compliance', status: 'ready', branches: [
    { href: '/erp/compliance?tab=laws', title: 'hub.branch.circulars' },
    { href: '/erp/compliance?tab=gate', title: 'hub.branch.gate' },
    { href: '/erp/compliance?tab=memory', title: 'hub.branch.memory' },
  ] },
  { id: 'archive', href: '/erp/archive', title: 'erpnav.archive', detail: 'hub.archive', status: 'ready' },
  { id: 'intelligence', href: '/erp/intelligence', title: 'erpnav.intelligence', detail: 'hub.intelligence', status: 'ready', branches: [
    { href: '/erp/intelligence?tab=radar', title: 'hub.branch.radar' },
    { href: '/erp/intelligence?tab=telemetry', title: 'hub.branch.telemetry' },
  ] },
  { id: 'ai', href: '/erp/ai', title: 'erpnav.ai', detail: 'hub.ai', status: 'beta' },
  { id: 'kitchen', href: '/erp/kitchen', title: 'nav.kitchen', detail: 'hub.kitchen', status: 'ready' },
  { id: 'delivery', href: '/erp/delivery', title: 'nav.delivery', detail: 'hub.delivery', status: 'ready' },
]

export function filterCatalog(items: readonly CatalogItem[], query: string, label: (key: MessageKey) => string): CatalogItem[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return [...items]
  return items.filter((item) => {
    const branches = (item.branches ?? []).map((branch) => label(branch.title)).join(' ')
    return `${label(item.title)} ${label(item.detail)} ${branches}`.toLocaleLowerCase().includes(needle)
  })
}
