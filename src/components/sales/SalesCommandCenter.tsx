'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import { SectionCard, StateBlock } from '@/components/ui'

export type SalesTabId =
  | 'scorecard'
  | 'aggregators'
  | 'menu'
  | 'slow-movers'
  | 'branches'
  | 'upselling'
  | 'live-invoices'
  | 'reports'

interface Props {
  initialLocale?: 'ar' | 'en'
  initialTab?: SalesTabId
  liveChildren?: React.ReactNode
}

export function SalesCommandCenter({
  initialLocale = 'ar',
  initialTab = 'scorecard',
  liveChildren,
}: Props) {
  const isAr = initialLocale !== 'en'
  const resolvedLocale = isAr ? 'ar' : 'en'
  const [showDbInvoices, setShowDbInvoices] = useState(initialTab === 'live-invoices')

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <SectionCard
        locale={resolvedLocale}
        icon={<BarChart3 className="h-5 w-5" aria-hidden />}
        title={isAr ? 'لوحة المبيعات والفواتير' : 'Sales & Invoices Panel'}
        subtitle={
          isAr
            ? 'تم إزالة جميع الجداول والتوقعات الثابتة؛ مبيعات نقاط البيع المعتمدة متوفرة مباشرة في ملخص Odoo 17.'
            : 'All static tables and estimates have been removed; Odoo 17 POS sales are available in the Executive Summary.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/erp"
              className="ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500"
            >
              {isAr ? 'فتح ملخص Odoo 17' : 'Open Odoo 17 Summary'}
            </Link>
            {liveChildren ? (
              <button
                type="button"
                aria-pressed={showDbInvoices}
                onClick={() => setShowDbInvoices((v) => !v)}
                className="ds-surface ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-xs font-bold hover:bg-[var(--ds-bg-hover)]"
              >
                {isAr ? 'سجلات الفواتير المحلية' : 'Local Invoice Records'}
              </button>
            ) : null}
          </div>
        }
      >
        {showDbInvoices && liveChildren ? (
          <div>{liveChildren}</div>
        ) : (
          <StateBlock
            state="unlinked"
            locale={resolvedLocale}
            title={
              isAr
                ? 'لوحة المبيعات التفصيلية القديمة غير مربوطة'
                : 'Legacy Sales Sub-Panel Not Connected'
            }
            description={
              isAr
                ? 'هذه الشاشة الفرعية غير مربوطة بمصدر مستقل، وتم حذف كافة الأرقام والنسب الشهرية الثابتة منها. لعرض مبيعات Odoo 17 الفعلية حسب الفرع أو العلامة أو الصنف انتقل إلى صفحة ملخص الشركة (/erp) أو المبيعات والمينيو (/erp/cores).'
                : 'This sub-panel is not linked to an independent source and all static monthly baselines have been purged. Open /erp or /erp/cores for Odoo 17 POS figures (pos.order & pos.order.line).'
            }
          />
        )}
      </SectionCard>
    </div>
  )
}
