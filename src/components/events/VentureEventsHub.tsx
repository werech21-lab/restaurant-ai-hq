'use client'

import React from 'react'
import UnlinkedSourceNotice from '@/components/erp/UnlinkedSourceNotice'
import { useI18n } from '@/lib/i18n'

export default function VentureEventsHub() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-5xl min-w-0 p-3.5 sm:p-5">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="إدارة المعارض والفعاليات والمخيمات المؤقتة"
        titleEn="Exhibitions, Camps & Special Events Management"
        reasonAr="مشاريع الفعاليات وعقود البوثات المؤقتة وقوائم المعدات غير مربوطة بمراكز تكلفة منفصلة في Odoo."
        reasonEn="Temporary exhibition contracts, booth fit-out rosters, and camp operations are not connected to dedicated cost centers in Odoo."
        requiredSourceAr="مراكز التكلفة والحسابات التحليلية في Odoo 17 (account.analytic.account)"
        requiredSourceEn="Odoo 17 Analytical Accounts / Cost Centers (account.analytic.account)"
      />
    </div>
  )
}
