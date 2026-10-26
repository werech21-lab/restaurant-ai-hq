'use client'

import { Badge, Num } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import { formatMinor, money } from '@/lib/money'
import { isLowStock, stockValue, type Item } from '@/modules/inventory/client'

// Generic ERP screen helpers live in the shared components folder. They are re-exported so the inventory screens keep one import.
export { dateTimeText, Modal, useDebounced, type ListPage, type Phase } from '@/components/erp/common'

/** Quantity x unit cost as a KWD string, or a dash when the number is outside the safe range. */
export function itemValueText(item: Pick<Item, 'currentStock' | 'unitCostMinor'>): string {
  try {
    return formatMinor(stockValue(item.currentStock, money(item.unitCostMinor)).amountMinor)
  } catch {
    return '—'
  }
}

export function StockBadge({ item }: { item: Pick<Item, 'currentStock' | 'reorderLevel' | 'isActive'> }) {
  const { t } = useI18n()
  if (!item.isActive) return <Badge tone="neutral">{t('inv.badge.inactive')}</Badge>
  if (item.currentStock === 0) return <Badge tone="bad">{t('inv.badge.out')}</Badge>
  if (isLowStock(item.currentStock, item.reorderLevel)) return <Badge tone="warn">{t('inv.badge.low')}</Badge>
  return <Badge tone="good">{t('inv.badge.ok')}</Badge>
}

export function Quantity({ value, unit }: { value: number; unit?: Item['unit'] }) {
  const { t } = useI18n()
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <Num>{value.toLocaleString('en-US')}</Num>
      {unit ? <span className="text-xs text-gray-400">{t(`inv.unit.${unit}`)}</span> : null}
    </span>
  )
}
