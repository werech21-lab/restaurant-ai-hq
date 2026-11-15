'use client'

import React from 'react'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function VentureAutomationHub({ locale = 'ar' }: { locale?: 'ar' | 'en' }) {
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">
        {isAr ? 'قواعد الأتمتة والتنبيهات الآلية' : 'Operational Automations'}
      </h1>
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — محرك قواعد الأتمتة القديم"
        titleEn="غير مربوط بمصدر — Legacy Automation Rules"
        reasonAr="تم حذف جميع قواعد التنبيه الافتراضية الثابتة من هذه الشاشة. تنبيهات تجاوز السقوف الفعلية من Odoo 17 تعمل حصرياً عبر /api/erp/governance."
        reasonEn="All static placeholder automation rules have been removed. Threshold breaches from Odoo 17 are evaluated strictly via /api/erp/governance."
        requiredSourceAr="ربط إجراءات base.automation في Odoo 17 أو استخدام قواعد /api/erp/governance."
        requiredSourceEn="Link Odoo 17 base.automation or use /api/erp/governance thresholds."
      />
    </div>
  )
}
