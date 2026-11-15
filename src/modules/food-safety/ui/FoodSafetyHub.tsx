'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export type SafetyTab = 'cold' | 'maintenance' | 'inspection' | 'healthCards' | 'shelfLife'

export default function FoodSafetyHub() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto py-4">
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — سلامة الغذاء وحساسات التبريد والصيانة"
        titleEn="غير مربوط بمصدر — Food Safety, Cold Chain IoT & Maintenance"
        reasonAr="حساسات درجات حرارة الثلاجات والفريزرات وسجلات الكروت الصحية والصيانة غير مربوطة بمصدر إنترنت الأشياء (IoT) أو جداول أودو الفعلية حالياً، لذا تم إخفاء جميع القراءات غير الموثقة."
        reasonEn="Cold-chain temperature sensors, health card registries, and preventive maintenance logs are not linked to an active IoT telemetry or Odoo module source."
        requiredSourceAr="Cold-Chain IoT Telemetry + Odoo Maintenance / HR Expiry Module"
      />
    </div>
  )
}
