'use client'

import React from 'react'
import UnlinkedSourceNotice from '@/components/erp/UnlinkedSourceNotice'
import { useI18n } from '@/lib/i18n'

export interface TalabatGeoZoneRadarProps {
  locale?: 'ar' | 'en'
}

export default function TalabatGeoZoneRadar({ locale: propLocale }: TalabatGeoZoneRadarProps = {}) {
  let ctxLocale: 'ar' | 'en' = 'ar'
  try {
    const i18n = useI18n()
    if (i18n?.locale) ctxLocale = i18n.locale
  } catch {}

  const isAr = (propLocale ?? ctxLocale) !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full min-w-0">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="رادار المناطق الجغرافية لمنصات التوصيل"
        titleEn="Aggregator Geo-Zone Coverage Radar"
        reasonAr="حالة فتح وإغلاق المناطق السكنية على طلبات وديليفرو وكيتا وجاهز غير مربوطة بواجهة برمجية رسمية من المنصات أو Odoo."
        reasonEn="Residential delivery polygon statuses across Talabat, Deliveroo, Keeta, and Jahez are not connected to an official platform API or Odoo."
        requiredSourceAr="واجهة برمجية رسمية من منصات التوصيل لتغطية المناطق السكنية"
        requiredSourceEn="Official Aggregator Geo-Polygon & Availability API"
      />
    </div>
  )
}
