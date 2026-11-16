'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function SocialReviewsStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] min-w-0 mx-auto p-3.5 sm:p-5">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="تقييمات العملاء ومنصات التواصل"
        titleEn="Customer & Social Reviews"
        reasonAr="واجهات برمجة تقييمات خرائط جوجل ومنصات التوصيل وحسابات التواصل غير مربوطة بمصدر فعلي حالياً، لذا تم إخفاء جميع التقييمات والنسب."
        reasonEn="Google Maps, delivery platform ratings, and social review APIs are not linked to an active source. All synthetic reviews and ratings have been removed."
        requiredSourceAr="Google Business Profile API + Aggregator Reviews API"
        requiredSourceEn="Google Business Profile API + Aggregator Reviews API"
      />
    </div>
  )
}

export default SocialReviewsStudio
