'use client'

import React from 'react'
import Link from 'next/link'
import { AlertTriangle, Building2, ClipboardCheck } from 'lucide-react'
import { DataTable, KpiCard, SectionCard, type DataTableColumn } from '@/components/ui'
import { formatQty } from '@/lib/format'

export interface LowStockItemRow {
  id: string
  name: string
  code: string
  currentStock: number
  reorderLevel: number
  estCostKwd: number
}

export function StockCountView({
  locale = 'ar',
  scopeLabel,
  lowCount,
  lowItems,
}: {
  locale?: 'ar' | 'en'
  scopeLabel: string
  lowCount: number
  lowItems: LowStockItemRow[]
}) {
  const isAr = locale !== 'en'
  const resolvedLocale = isAr ? 'ar' : 'en'

  const columns: ReadonlyArray<DataTableColumn<LowStockItemRow>> = [
    {
      key: 'item',
      header: isAr ? 'الصنف' : 'Item',
      render: (row) => (
        <div>
          <p className="font-semibold" style={{ color: 'var(--ds-text-primary)' }}>
            {row.name}
          </p>
          <p dir="ltr" className="ds-num font-mono text-xs" style={{ color: 'var(--ds-text-muted)' }}>
            {row.code}
          </p>
        </div>
      ),
    },
    {
      key: 'currentStock',
      header: isAr ? 'الرصيد' : 'On hand',
      align: 'numeric',
      render: (row) => formatQty(row.currentStock),
    },
    {
      key: 'reorderLevel',
      header: isAr ? 'حد الطلب' : 'Reorder',
      align: 'numeric',
      render: (row) => formatQty(row.reorderLevel),
    },
    {
      key: 'estCostKwd',
      header: isAr ? 'التكلفة التقديرية' : 'Est. cost',
      format: 'kwd',
      align: 'numeric',
      accessor: (row) => row.estCostKwd,
    },
  ]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          locale={resolvedLocale}
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
          label={isAr ? 'أصناف تحت حد الطلب' : 'Items below reorder'}
          value={lowCount}
          format="int"
          higherIsBetter={false}
        />

        <SectionCard
          locale={resolvedLocale}
          icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
          title={isAr ? 'نطاق الجرد' : 'Count scope'}
          subtitle={scopeLabel}
        />

        <SectionCard
          locale={resolvedLocale}
          icon={<Building2 className="h-4 w-4" aria-hidden />}
          title={isAr ? 'مسار المطبخ المركزي' : 'Central kitchen'}
          actions={
            <Link
              href="/central-kitchen"
              className="ds-focus-ring inline-flex min-h-9 items-center text-sm font-bold hover:underline"
              style={{ color: 'var(--ds-accent)' }}
            >
              {isAr ? 'فتح المطبخ المركزي' : 'Open central kitchen'}
            </Link>
          }
        />
      </div>

      <DataTable<LowStockItemRow>
        locale={resolvedLocale}
        columns={columns}
        rows={lowItems}
        rowKey={(row) => row.id}
        emptyTitle={
          isAr ? 'لا أصناف تحت حد الطلب في هذا النطاق.' : 'No items below reorder in this scope.'
        }
        emptyDescription={
          isAr
            ? 'جميع الأصناف المرصودة فوق حد إعادة الطلب حالياً.'
            : 'All monitored stock items are currently above their reorder threshold.'
        }
      />
    </div>
  )
}
