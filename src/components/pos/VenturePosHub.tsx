'use client'

import React from 'react'
import UnlinkedSourceNotice from '@/components/erp/UnlinkedSourceNotice'

export interface VenturePosHubProps {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}

export function VenturePosHub({ locale = 'ar' }: VenturePosHubProps) {
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl p-4 sm:p-6">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="نقطة البيع التفاعلية (POS Terminal)"
        titleEn="Interactive POS Terminal"
        reasonAr="يتم تشغيل جلسات الكاشير وإصدار الفواتير مباشرة داخل نظام Odoo POS في الفروع السبعة؛ هذه الشاشة غير مربوطة بإنشاء جلسات بيع مباشرة."
        reasonEn="Cashier sessions and receipt issuance run directly inside Odoo POS across the 7 operating branches; this screen is not wired for direct POS order entry."
      />
    </div>
  )
}

export default VenturePosHub
