'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function DeliverySlaStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto py-4">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — التزام زمن توصيل السائقين"
        titleEn="غير مربوط بمصدر — Rider Delivery Duration SLA"
        reasonAr="بيانات تتبع رحلات السائقين وزمن الاستلام والتسليم غير مربوطة بمصدر GPS أو واجهة منصات التوصيل حالياً، لذلك تم إخفاء جميع الأرقام والجداول."
        reasonEn="Rider pickup-to-dropoff telemetry is not linked to an active fleet GPS or aggregator webhook source. All numbers and trip tables are hidden."
        requiredSourceAr="Fleet Dispatch GPS / Aggregator Rider Telemetry API"
      />
    </div>
  )
}

export default DeliverySlaStudio
