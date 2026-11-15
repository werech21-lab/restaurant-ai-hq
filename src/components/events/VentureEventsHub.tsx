'use client'

import React from 'react'
import UnlinkedSourceNotice from '@/components/erp/UnlinkedSourceNotice'
import { useI18n } from '@/lib/i18n'

export default function VentureEventsHub() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl p-4 sm:p-6">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="إدارة المعارض والفعاليات والمخيمات المؤقتة"
        titleEn="Exhibitions, Camps & Special Events Management"
        reasonAr="مشاريع الفعاليات وعقود البوثات المؤقتة وقوائم المعدات غير مربوطة بمراكز تكلفة منفصلة في Odoo."
        reasonEn="Temporary exhibition contracts, booth fit-out rosters, and camp operations are not connected to dedicated live cost centers in Odoo."
      />
    </div>
  )
}
