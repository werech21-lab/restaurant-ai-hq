import type { MessageKey } from '@/lib/i18n'

export type CatalogStatus = 'ready' | 'beta' | 'planned'

export type CatalogItem = {
  id: string
  href?: string
  title: MessageKey
  detail: MessageKey
  status: CatalogStatus
}

export const erpCatalog: readonly CatalogItem[] = [
  { id: 'finance', href: '/erp/finance', title: 'erpnav.finance', detail: 'hub.finance', status: 'ready' },
  { id: 'ledger', href: '/erp/ledger', title: 'erpnav.ledger', detail: 'hub.ledger', status: 'ready' },
  { id: 'procurement', href: '/erp/procurement', title: 'erpnav.procurement', detail: 'hub.procurement', status: 'ready' },
  { id: 'inventory', href: '/erp/inventory', title: 'erpnav.inventory', detail: 'hub.inventory', status: 'ready' },
  { id: 'crm', href: '/erp/crm', title: 'erpnav.crm', detail: 'hub.crm', status: 'ready' },
  { id: 'org', href: '/erp/org', title: 'erpnav.org', detail: 'hub.org', status: 'ready' },
  { id: 'iam', href: '/erp/iam', title: 'erpnav.iam', detail: 'hub.iam', status: 'ready' },
  { id: 'ai', href: '/erp/ai', title: 'erpnav.ai', detail: 'hub.ai', status: 'beta' },
  { id: 'kitchen', href: '/erp/kitchen', title: 'nav.kitchen', detail: 'hub.kitchen', status: 'ready' },
  { id: 'delivery', href: '/erp/delivery', title: 'nav.delivery', detail: 'hub.delivery', status: 'ready' },
]

export function filterCatalog(items: readonly CatalogItem[], query: string, label: (key: MessageKey) => string): CatalogItem[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return [...items]
  return items.filter((item) => `${label(item.title)} ${label(item.detail)}`.toLocaleLowerCase().includes(needle))
}
