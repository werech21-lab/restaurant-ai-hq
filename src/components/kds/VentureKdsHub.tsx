'use client'

import React from 'react'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function VentureKdsHub({
  locale = 'ar',
}: {
  locale?: 'ar' | 'en'
}) {
  const isAr = locale === 'ar'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">
        {isAr ? 'شاشات المطبخ وتجهيز الطلبات (KDS)' : 'Kitchen Display System (KDS)'}
      </h1>
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — شاشة تذاكر المطبخ (KDS)"
        titleEn="غير مربوط بمصدر — Kitchen Display System (KDS)"
        reasonAr="شاشات المطبخ وسجلات طوابع التحضير الفورية غير مربوطة بمصدر بيانات فعلي في Odoo 17 حالياً، وتم حذف جميع التذاكر والأوقات الافتراضية."
        reasonEn="Kitchen display screens and station prep timestamps are not currently linked to Odoo 17, and all sample tickets have been removed."
        requiredSourceAr="ربط شاشات المطبخ (pos_preparation_display) في Odoo 17 لتسجيل وقت بدء وإنهاء تحضير كل طلب."
        requiredSourceEn="Link Odoo 17 pos_preparation_display to capture order start and ready timestamps."
      />
    </div>
  )
}
