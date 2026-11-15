'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

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
  const isAr = initialLocale === 'ar'
  const [showDbInvoices, setShowDbInvoices] = useState(initialTab === 'live-invoices')

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isAr ? 'لوحة المبيعات والفواتير' : 'Sales & Invoices Panel'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'تم إزالة جميع الجداول والتوقعات الثابتة؛ مبيعات نقاط البيع المعتمدة متوفرة مباشرة في ملخص Odoo 17.'
              : 'All static tables and estimates have been removed; Odoo 17 POS sales are available in the Executive Summary.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/erp"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
          >
            {isAr ? 'فتح ملخص Odoo 17' : 'Open Odoo 17 Summary'}
          </Link>
          {liveChildren ? (
            <button
              type="button"
              onClick={() => setShowDbInvoices((v) => !v)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              {isAr ? 'سجلات الفواتير المحلية' : 'Local Invoice Records'}
            </button>
          ) : null}
        </div>
      </div>

      {showDbInvoices && liveChildren ? (
        <div>{liveChildren}</div>
      ) : (
        <UnlinkedSourceNotice
          isAr={isAr}
          titleAr="غير مربوط بمصدر — لوحة المبيعات التفصيلية القديمة"
          titleEn="غير مربوط بمصدر — Legacy Sales Panel"
          reasonAr="هذه الشاشة الفرعية غير مربوطة بمصدر مستقل، وتم حذف كافة الأرقام والنسب الشهرية الثابتة منها. لعرض مبيعات Odoo 17 الفعلية حسب الفرع أو العلامة أو الصنف انتقل إلى صفحة ملخص الشركة (/erp) أو المبيعات والمينيو (/erp/cores)."
          reasonEn="This sub-panel is not linked to an independent source and all static monthly baselines have been purged. Open /erp or /erp/cores for Odoo 17 POS figures."
          requiredSourceAr="استخدم /erp و /erp/cores لقراءة pos.order و pos.order.line من Odoo 17."
          requiredSourceEn="Use /erp and /erp/cores to read pos.order and pos.order.line from Odoo 17."
        />
      )}
    </div>
  )
}
