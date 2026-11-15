'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import type { PrepSlaTier } from '@/lib/warehouse-prep-engine'

export function PrepTrafficBadge({
  tier,
  isAr,
}: {
  tier: PrepSlaTier
  isAr: boolean
  compact?: boolean
}) {
  if (tier === 'green') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
        {isAr ? 'أخضر' : 'Green'}
      </span>
    )
  }
  if (tier === 'yellow') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
        {isAr ? 'أصفر' : 'Yellow'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
      {isAr ? 'أحمر' : 'Red'}
    </span>
  )
}

export function OrderPrepSlaStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto py-4">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — التزام تحضير المطبخ (KDS)"
        titleEn="غير مربوط بمصدر — Kitchen Order Prep SLA (KDS)"
        reasonAr="شاشات تحضير المطبخ (KDS) غير مربوطة بمصدر توقيت فعلي في أودو 17 حالياً، لذا تم إخفاء جميع المؤشرات والتذاكر لمنع عرض أي أرقام غير حقيقية."
        reasonEn="Kitchen Display System (KDS) preparation timestamps are not linked to an active Odoo 17 data source. All metrics and ticket tables are hidden."
        requiredSourceAr="Odoo 17 POS Preparation Display / KDS Timestamps"
      />
    </div>
  )
}

export default OrderPrepSlaStudio
