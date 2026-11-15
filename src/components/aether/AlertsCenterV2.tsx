'use client'

import React from 'react'
import { useLang } from '@/components/aether/ui'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function AlertsCenterV2() {
  const { isAr } = useLang()

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto py-4">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — مركز التنبيهات المالية الآلية"
        titleEn="غير مربوط بمصدر — Automated Financial Alerts"
        reasonAr="تم إيقاف التنبيهات الثابتة بالكامل. لا تُعرض أي تنبيهات مالية إلا عند ربطها باستعلامات أودو 17 الفعلية وسقوف يعتمدها الأدمن على الخادم عبر جرس الحوكمة."
        reasonEn="Static financial alerts have been removed. Alerts only appear when evaluated against real Odoo 17 queries and admin-saved server thresholds."
        requiredSourceAr="/api/erp/governance (Admin Thresholds + Odoo 17 Queries)"
      />
    </div>
  )
}

export default AlertsCenterV2
