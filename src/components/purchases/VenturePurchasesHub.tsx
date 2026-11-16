'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { SectionCard, StateBlock } from '@/components/ui'

export function VenturePurchasesHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const isAr = locale !== 'en'
  const resolvedLocale = isAr ? 'ar' : 'en'
  const [showLocalDb, setShowLocalDb] = useState(false)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <SectionCard
        locale={resolvedLocale}
        icon={<ShoppingCart className="h-5 w-5" aria-hidden />}
        title={isAr ? 'المشتريات وطلبات التوريد' : 'Purchases & Procurement'}
        subtitle={
          isAr
            ? 'متابعة أوامر الشراء المعتمدة وفواتير الموردين'
            : 'Approved purchase orders and supplier procurement tracking'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/erp/warehouse-chain"
              className="ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500"
            >
              {isAr ? 'فتح أوامر شراء Odoo 17' : 'Open Odoo 17 Purchase Orders'}
            </Link>
            {liveChildren ? (
              <button
                type="button"
                aria-pressed={showLocalDb}
                onClick={() => setShowLocalDb((v) => !v)}
                className="ds-surface ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-xs font-bold hover:bg-[var(--ds-bg-hover)]"
              >
                {isAr ? 'السجلات المحلية' : 'Local Records'}
              </button>
            ) : null}
          </div>
        }
      >
        {showLocalDb && liveChildren ? (
          <div>{liveChildren}</div>
        ) : (
          <StateBlock
            state="unlinked"
            locale={resolvedLocale}
            title={
              isAr
                ? 'طلبات الشراء الداخلية الافتراضية غير مربوطة'
                : 'Internal Purchase Requisitions Not Connected'
            }
            description={
              isAr
                ? 'تم حذف جميع طلبات الشراء الداخلية وفروقات الأسعار الثابتة غير الموثقة. لعرض أوامر الشراء والموردين الفعليين من Odoo 17 انتقل إلى صفحة سلسلة المخزن والمشتريات (/erp/warehouse-chain) أو اسأل المستشارة فريال.'
                : 'All static purchase requisitions and price-radar placeholders have been removed. Open /erp/warehouse-chain or ask Feryal for Odoo 17 purchase.order totals via /api/erp/purchase-orders.'
            }
          />
        )}
      </SectionCard>
    </div>
  )
}
