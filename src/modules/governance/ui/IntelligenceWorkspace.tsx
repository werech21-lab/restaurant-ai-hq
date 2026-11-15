'use client'

import React from 'react'
import Link from 'next/link'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import { useI18n } from '@/lib/i18n'

interface IntelligenceWorkspaceProps {
  permissions?: readonly string[]
  initialTab?: string
  isAuditor?: boolean
}

export default function IntelligenceWorkspace(_props: IntelligenceWorkspaceProps) {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isAr ? 'تنبيهات العهد والمصروفات' : 'Expense & Custody Alerts'}
        </h1>
        <Link
          href="/erp"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
        >
          {isAr ? 'فتح ملخص الشركة (/erp)' : 'Open Company Summary (/erp)'}
        </Link>
      </div>
      <UnlinkedSourceNotice
        isAr={isAr}
        titleAr="غير مربوط بمصدر — تنبيهات العهد النقدية التفصيلية"
        titleEn="غير مربوط بمصدر — Petty Cash & Custody Anomaly Alerts"
        reasonAr="نموذج العهد النقدية التفصيلي (hr.expense) غير مربوط بمصدر قراءة مباشر في هذه الشاشة، وتم حذف جميع مبالغ ونسب التنبيهات الثابتة."
        reasonEn="Detailed petty-cash custody sheets (hr.expense) are not linked on this screen, and all static alert amounts and ratios have been removed."
        requiredSourceAr="ربط نموذج hr.expense و hr.expense.sheet من Odoo 17."
        requiredSourceEn="Link Odoo 17 hr.expense and hr.expense.sheet models."
      />
    </div>
  )
}
