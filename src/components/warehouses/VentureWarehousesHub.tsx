'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function VentureWarehousesHub({
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
          {isAr ? 'المستودعات وسلسلة التوريد الداخلي' : 'Warehouses & Internal Supply Chain'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/erp/warehouse-chain"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
          >
            {isAr ? 'فتح حركات مخازن Odoo 17' : 'Open Odoo 17 Stock Moves'}
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
          titleAr="غير مربوط بمصدر — حساسات التبريد والجرد اليدوي"
          titleEn="غير مربوط بمصدر — Cold-Chain Sensors & Manual Counts"
          reasonAr="قراءات حساسات غرف التبريد ومحاضر الجرد الثابتة غير مربوطة بمصدر بيانات فعلي. لمتابعة حركات المخزون الفعلية المسجلة في Odoo 17 انتقل إلى صفحة سلسلة المخزن والفروع (/erp/warehouse-chain)."
          reasonEn="Cold-chain IoT telemetry and static count sheets are unlinked. Open /erp/warehouse-chain for Odoo 17 stock.move records."
          requiredSourceAr="ربط حساسات درجات الحرارة ونموذج stock.quant من Odoo 17."
          requiredSourceEn="Link cold-chain IoT sensors and Odoo 17 stock.quant."
        />
      )}
    </div>
  )
}
