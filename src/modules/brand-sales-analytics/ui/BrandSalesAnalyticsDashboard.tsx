'use client'

import React from 'react'
import Link from 'next/link'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'

type Props = {
  locale?: string
}

export function BrandSalesAnalyticsDashboard({ locale = 'ar' }: Props) {
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isAr ? 'تحليلات مبيعات العلامات التجارية' : 'Brand Sales Analytics'}
        </h1>
        <Link
          href="/erp/cores"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
        >
          {isAr ? 'فتح مبيعات العلامات من Odoo 17' : 'Open Odoo 17 Brand Sales'}
        </Link>
      </div>
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — لوحة مقارنات أكتوبر الثابتة"
        titleEn="غير مربوط بمصدر — Legacy Static Brand Scorecard"
        reasonAr="تم حذف جميع جداول ونسب أكتوبر الثابتة من هذه الصفحة. لعرض مبيعات العلامات التجارية الست والقنوات والأصناف الفعلية من Odoo 17 انتقل إلى صفحة المبيعات والتسويق والمينيو (/erp/cores)."
        reasonEn="All static October scorecards and ratios have been removed. Open /erp/cores for Odoo 17 brand, channel, and item figures."
        requiredSourceAr="قراءة pos.order و pos.order.line من Odoo 17 عبر /erp/cores."
        requiredSourceEn="Read pos.order and pos.order.line from Odoo 17 via /erp/cores."
      />
    </div>
  )
}
