'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function VenturePurchasesHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const isAr = locale === 'ar'
  const [showLocalDb, setShowLocalDb] = useState(false)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isAr ? 'المشتريات وطلبات التوريد' : 'Purchases & Procurement'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/erp/warehouse-chain"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
          >
            {isAr ? 'فتح أوامر شراء Odoo 17' : 'Open Odoo 17 Purchase Orders'}
          </Link>
          {liveChildren ? (
            <button
              type="button"
              onClick={() => setShowLocalDb((v) => !v)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              {isAr ? 'السجلات المحلية' : 'Local Records'}
            </button>
          ) : null}
        </div>
      </div>

      {showLocalDb && liveChildren ? (
        <div>{liveChildren}</div>
      ) : (
        <UnlinkedSourceNotice
          isAr={isAr}
          titleAr="غير مربوط بمصدر — طلبات الشراء الداخلية الافتراضية"
          titleEn="غير مربوط بمصدر — Internal Purchase Requisitions"
          reasonAr="تم حذف جميع طلبات الشراء الداخلية وفروقات الأسعار الثابتة غير الموثقة. لعرض أوامر الشراء والموردين الفعليين من Odoo 17 انتقل إلى صفحة سلسلة المخزن والمشتريات (/erp/warehouse-chain) أو اسأل المستشارة فريال."
          reasonEn="All static purchase requisitions and price-radar placeholders have been removed. Open /erp/warehouse-chain or ask Feryal for Odoo 17 purchase.order totals."
          requiredSourceAr="قراءة purchase.order و purchase.order.line عبر /api/erp/purchase-orders."
          requiredSourceEn="Read purchase.order and purchase.order.line via /api/erp/purchase-orders."
        />
      )}
    </div>
  )
}
