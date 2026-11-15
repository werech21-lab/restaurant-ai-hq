'use client'

import React from 'react'
import UnlinkedSourceNotice from '@/components/erp/UnlinkedSourceNotice'
import { useI18n } from '@/lib/i18n'
import type { AccountDeliveryMode } from '@/lib/radar/talabat-geo-zone-radar'

export interface AggregatorRadarProps {
  permissions?: readonly string[]
}

export function ModeBadgePill({ mode, isEn }: { mode: AccountDeliveryMode | 'TMP'; isEn: boolean }) {
  if (mode === 'Tgo') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-500/20">
        <span className="font-extrabold">Tgo</span>
        <span>{isEn ? 'Platform Delivery' : 'توصيل المنصة'}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700 ring-1 ring-sky-500/20">
      <span className="font-extrabold">TMP</span>
      <span>{isEn ? 'Restaurant Delivery (TMP)' : 'توصيل المطعم (TMP)'}</span>
    </span>
  )
}

export default function AggregatorRadar(_props: AggregatorRadarProps) {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl p-4 sm:p-6">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="رادار حسابات القطاعات ومناطق التوصيل (Tgo / TMP)"
        titleEn="Aggregator Zone Accounts & Polygon Radar (Tgo / TMP)"
        reasonAr="حالة أفرع المناطق السكنية وحوادث إغلاق المضلع الجغرافي على منصات التوصيل غير مربوطة بواجهة برمجية رسمية."
        reasonEn="Zone account statuses and delivery polygon restrictions across aggregator platforms are not connected to an official data source."
      />
    </div>
  )
}
