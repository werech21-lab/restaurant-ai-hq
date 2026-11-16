'use client'

import React from 'react'
import UnlinkedSourceNotice from '@/components/erp/UnlinkedSourceNotice'
import { useI18n } from '@/lib/i18n'

export function CompetitorsIntelligenceStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto min-w-0 max-w-5xl p-3.5 sm:p-5">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="ذكاء المنافسين ومقارنة الأسعار"
        titleEn="Competitors Intelligence & Price Benchmarking"
        reasonAr="أسعار وتقييمات وأزمنة توصيل المنافسين في السوق الكويتي غير مربوطة بمصدر بيانات رسمي أو Odoo."
        reasonEn="Competitor menu pricing, ratings, and delivery ETAs in Kuwait are not connected to an official data feed or Odoo."
        requiredSourceAr="ربط أسعار وقوائم المنافسين على منصات التوصيل بمصدر بيانات معتمد."
        requiredSourceEn="Connect verified competitor menu pricing and delivery ETA feeds."
      />
    </div>
  )
}

export default CompetitorsIntelligenceStudio
