'use client'

import React from 'react'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import { useLang } from '@/components/aether/ui'
import type { FindingDomain } from '@/lib/aether-proprietary-brain'

export function GrowthPlaybookV5({
  embedded = false,
}: {
  embedded?: boolean
  initialDomain?: FindingDomain | 'all'
  onlyIds?: string[] | null
  onClearOnly?: () => void
} = {}) {
  const { isAr } = useLang()

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className={embedded ? '' : 'space-y-4'}>
      <UnlinkedSourceNotice
        isAr={isAr}
        compact={embedded}
        titleAr="غير مربوط بمصدر — خطط النمو التقديرية"
        titleEn="غير مربوط بمصدر — Growth Playbook Estimates"
        reasonAr="تم حذف كافة تقديرات العائد الثابتة وتوصيات التوفير غير المربوطة بقيود فعلية من Odoo 17."
        reasonEn="All static ROI estimates and unlinked savings playbooks have been removed."
        requiredSourceAr="تفعيل نموذج الميزانيات التقديرية وتكاليف الوصفات (mrp.bom) في Odoo 17."
        requiredSourceEn="Enable budget targets and mrp.bom recipe costs in Odoo 17."
      />
    </div>
  )
}
