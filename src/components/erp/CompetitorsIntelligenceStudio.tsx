'use client'

import React from 'react'
import UnlinkedSourceNotice from '@/components/erp/UnlinkedSourceNotice'
import { useI18n } from '@/lib/i18n'

export function CompetitorsIntelligenceStudio() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl p-4 sm:p-6">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="ذكاء المنافسين ومقارنة الأسعار"
        titleEn="Competitors Intelligence & Price Benchmarking"
        reasonAr="أسعار وتقييمات وأزمنة توصيل المنافسين في السوق الكويتي غير مربوطة بمصدر بيانات رسمي أو Odoo."
        reasonEn="Competitor menu pricing, ratings, and delivery ETAs in Kuwait are not connected to an official data feed or Odoo."
      />
    </div>
  )
}

export default CompetitorsIntelligenceStudio
