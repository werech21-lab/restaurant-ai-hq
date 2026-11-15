'use client'

import React from 'react'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import { useLang } from '@/components/aether/ui'

export function DemandForecastV2({ anchor: _anchor }: { anchor: string }) {
  const { isAr } = useLang()

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-6">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — توقعات الطلب والطقس وتحضير المطبخ"
        titleEn="غير مربوط بمصدر — Demand, Weather & Kitchen Prep Forecaster"
        reasonAr="بيانات الأرصاد الجوية وخطط التحضير اليومية المعيارية غير مربوطة بمصدر بيانات فعلي في Odoo 17، وتم حذف جميع التوقعات الاصطناعية."
        reasonEn="Weather feeds and standard daily prep par levels are not linked to Odoo 17, and all synthetic forecasts have been removed."
        requiredSourceAr="ربط نموذج mrp.bom وخطط الإنتاج اليومية في Odoo 17 مع مزود بيانات الطقس."
        requiredSourceEn="Link Odoo 17 mrp.bom and daily production schedules with a weather feed."
      />
    </div>
  )
}
