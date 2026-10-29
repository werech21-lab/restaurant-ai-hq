import { describe, expect, it } from 'vitest'
import { erpCatalog, filterCatalog, type CatalogItem } from '@/lib/erp-catalog'
import type { MessageKey } from '@/lib/i18n'

const label = (key: MessageKey) => key

describe('ERP catalog', () => {
  it('keeps planned modules off real routes', () => {
    const planned = erpCatalog.filter((item) => item.status === 'planned')
    expect(planned.every((item) => item.href === undefined)).toBe(true)
    expect(erpCatalog.find((item) => item.id === 'kitchen')).toMatchObject({ href: '/erp/kitchen', status: 'ready' })
    expect(erpCatalog.find((item) => item.id === 'delivery')).toMatchObject({ href: '/erp/delivery', status: 'ready' })
    expect(erpCatalog.find((item) => item.id === 'ai')).toMatchObject({ href: '/erp/ai', status: 'ready' })
    expect(erpCatalog.find((item) => item.id === 'aggregator')?.branches).toHaveLength(4)
  })

  it('filters by the visible title and description', () => {
    const items: CatalogItem[] = [
      { id: 'finance', href: '/erp/finance', title: 'erpnav.finance', detail: 'hub.finance', status: 'ready' },
      { id: 'kitchen', title: 'nav.kitchen', detail: 'hub.kitchen', status: 'planned' },
    ]
    expect(filterCatalog(items, '  kitchen ', label).map((item) => item.id)).toEqual(['kitchen'])
    expect(filterCatalog(items, '', label)).toHaveLength(2)
    expect(filterCatalog(items, 'missing', label)).toHaveLength(0)
  })
})
