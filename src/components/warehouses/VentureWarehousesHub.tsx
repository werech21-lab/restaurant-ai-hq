'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Warehouse } from 'lucide-react'
import { SectionCard, StateBlock } from '@/components/ui'

export function VentureWarehousesHub({
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
        icon={<Warehouse className="h-5 w-5" aria-hidden />}
        title={isAr ? 'المستودعات وسلسلة التوريد الداخلي' : 'Warehouses & Internal Supply Chain'}
        subtitle={
          isAr
            ? 'المطبخ المركزي ومخازن الفروع الـ 7 النشطة'
            : 'Central kitchen and the 7 active branch warehouses'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/erp/warehouse-chain"
              className="ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500"
            >
              {isAr ? 'فتح حركات مخازن Odoo 17' : 'Open Odoo 17 Stock Moves'}
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
                ? 'حساسات التبريد والجرد اليدوي غير مربوطة'
                : 'Cold-Chain Sensors & Manual Counts Not Connected'
            }
            description={
              isAr
                ? 'قراءات حساسات غرف التبريد ومحاضر الجرد الثابتة غير مربوطة بمصدر بيانات فعلي. لمتابعة حركات المخزون الفعلية المسجلة في Odoo 17 انتقل إلى صفحة سلسلة المخزن والفروع (/erp/warehouse-chain).'
                : 'Cold-chain IoT telemetry and static count sheets are unlinked. Open /erp/warehouse-chain for Odoo 17 stock.move and stock.quant records.'
            }
          />
        )}
      </SectionCard>
    </div>
  )
}
