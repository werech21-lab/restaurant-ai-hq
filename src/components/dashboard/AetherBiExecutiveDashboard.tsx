'use client'

import React from 'react'
import Link from 'next/link'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import { useI18n } from '@/lib/i18n'

function AetherBiExecutiveDashboardBody({ isAr }: { isAr: boolean }) {
  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isAr ? 'التقرير المالي والتشغيلي' : 'Financial & Operational Summary'}
        </h1>
        <Link
          href="/erp"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        >
          {isAr ? 'فتح ملخص الشركة من Odoo 17 (/erp)' : 'Open Odoo 17 Company Summary (/erp)'}
        </Link>
      </div>
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — لوحة التقارير الثابتة القديمة"
        titleEn="Unlinked from Source — Legacy Static Dashboard"
        reasonAr="تم إيقاف عرض كافة المؤشرات والتوصيات الثابتة القديمة في هذا المسار. جميع أرقام المبيعات ودفتر الأستاذ والذمم من Odoo 17 متاحة في صفحة ملخص الشركة (/erp)."
        reasonEn="All legacy static KPIs and estimates on this route have been retired. Odoo 17 POS, GL, and receivable figures are served on /erp."
        requiredSourceAr="انتقل إلى /erp لعرض بيانات Odoo 17 الفعلية."
        requiredSourceEn="Navigate to /erp for Odoo 17 figures."
      />
    </div>
  )
}

function AetherBiExecutiveDashboardI18n() {
  const { locale } = useI18n()
  return <AetherBiExecutiveDashboardBody isAr={locale !== 'en'} />
}

export function AetherBiExecutiveDashboard({ locale: explicitLocale }: { locale?: string }) {
  if (explicitLocale !== undefined) {
    return <AetherBiExecutiveDashboardBody isAr={explicitLocale !== 'en'} />
  }
  return <AetherBiExecutiveDashboardI18n />
}
