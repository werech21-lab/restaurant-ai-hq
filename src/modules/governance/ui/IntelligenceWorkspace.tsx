'use client'

import React from 'react'
import Link from 'next/link'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import { SectionCard } from '@/components/ui/section-card'
import { useI18n } from '@/lib/i18n'

interface IntelligenceWorkspaceProps {
  permissions?: readonly string[]
  initialTab?: string
  isAuditor?: boolean
}

export default function IntelligenceWorkspace(_props: IntelligenceWorkspaceProps) {
  void _props
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-6xl space-y-6">
      <SectionCard
        locale={isAr ? 'ar' : 'en'}
        title={isAr ? 'تنبيهات العهد والمصروفات' : 'Expense & Custody Alerts'}
        subtitle={
          isAr
            ? 'متابعة تنبيهات عهد النثرية والمصروفات التشغيلية المرتبطة بنظام Odoo 17.'
            : 'Monitor petty-cash custody sheets and operational expense alerts linked to Odoo 17.'
        }
        actions={
          <Link
            href="/erp"
            className="ds-focus-ring inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
          >
            {isAr ? 'فتح ملخص الشركة (/erp)' : 'Open Company Summary (/erp)'}
          </Link>
        }
      >
        <UnlinkedSourceNotice
          isAr={isAr}
          titleAr="غير مربوط بمصدر — تنبيهات العهد النقدية التفصيلية"
          titleEn="Unlinked Source — Petty Cash & Custody Anomaly Alerts"
          reasonAr="نموذج العهد النقدية التفصيلي (hr.expense) غير مربوط بمصدر قراءة مباشر في هذه الشاشة، وتم حذف جميع مبالغ ونسب التنبيهات الثابتة."
          reasonEn="Detailed petty-cash custody sheets (hr.expense) are not linked on this screen, and all static alert amounts and ratios have been removed."
          requiredSourceAr="ربط نموذج hr.expense و hr.expense.sheet من Odoo 17."
          requiredSourceEn="Link Odoo 17 hr.expense and hr.expense.sheet models."
        />
      </SectionCard>
    </div>
  )
}
