'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export function RegulationsComplianceStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto py-4">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — سجل التراخيص والامتثال الرقابي"
        titleEn="غير مربوط بمصدر — Regulatory Licenses & Municipal Compliance"
        reasonAr="سجلات تراخيص البلدية وهيئة الغذاء والقوى العاملة والإطفاء العام غير مربوطة بقاعدة بيانات الوثائق الحكومية أو سجلات أودو حالياً، لذا تم إخفاء كافة النسب والبنود الافتراضية."
        reasonEn="Municipality, PAFN, Manpower, and Fire Force permit registries are not linked to an active document or Odoo compliance table. All synthetic readiness scores have been removed."
        requiredSourceAr="Odoo Documents / Municipal & PAFN License Registry"
      />
    </div>
  )
}

export default RegulationsComplianceStudio
