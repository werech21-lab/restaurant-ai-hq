'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n'
import type { FormatLocale } from '@/lib/format'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

export type SafetyTab = 'cold' | 'maintenance' | 'inspection' | 'healthCards' | 'shelfLife'

export interface FoodSafetyHubProps {
  locale?: FormatLocale
}

function FoodSafetyHubBody({ locale }: { locale: FormatLocale }) {
  const isAr = locale !== 'en'

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="mx-auto w-full max-w-[1920px] min-w-0 p-3.5 sm:p-5"
    >
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="سلامة الغذاء وحساسات التبريد والصيانة"
        titleEn="Food Safety, Cold Chain IoT & Preventive Maintenance"
        reasonAr="حساسات درجات حرارة الثلاجات والفريزرات وسجلات الكروت الصحية والصيانة غير مربوطة بمصدر إنترنت الأشياء (IoT) أو جداول أودو الفعلية حالياً، لذا تم إخفاء جميع القراءات غير الموثقة."
        reasonEn="Cold-chain temperature sensors, health card registries, and preventive maintenance logs are not linked to an active IoT telemetry or Odoo module source."
        requiredSourceAr="حساسات التبريد (IoT) + وحدة الصيانة وإقامات الموارد البشرية في أودو"
        requiredSourceEn="Cold-Chain IoT Telemetry + Odoo Maintenance / HR Expiry Module"
      />
    </div>
  )
}

function FoodSafetyHubI18n() {
  const { locale } = useI18n()
  return <FoodSafetyHubBody locale={locale === 'en' ? 'en' : 'ar'} />
}

export default function FoodSafetyHub({ locale: explicitLocale }: FoodSafetyHubProps) {
  if (explicitLocale !== undefined) {
    return <FoodSafetyHubBody locale={explicitLocale} />
  }
  return <FoodSafetyHubI18n />
}
