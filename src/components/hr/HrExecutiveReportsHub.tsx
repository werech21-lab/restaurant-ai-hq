'use client'

import React from 'react'
import UnlinkedSourceNotice from '@/components/erp/UnlinkedSourceNotice'

export type HrEmployeeSummary = {
  id: string
  code: string
  name: string
  jobTitle: string
  department: string
  phone: string | null
  basicSalary: number
  allowances: number
  deductions: number
  status: string
  hireDate: string
  civilId: string | null
  iban: string | null
  bankName: string | null
  civilIdExpiry: string | null
  passportExpiry: string | null
  healthCardExpiry: string | null
  workPermitExpiry: string | null
  drivingLicenseExpiry: string | null
}

type Props = {
  en: boolean
  employees: HrEmployeeSummary[]
}

export function HrExecutiveReportsHub({ en }: Props) {
  return (
    <div dir={en ? 'ltr' : 'rtl'} className="mx-auto max-w-5xl p-4 sm:p-6">
      <UnlinkedSourceNotice
        isAr={!en}
        titleAr="تقارير الموارد البشرية التفصيلية"
        titleEn="HR Departmental Reports"
        reasonAr="التقارير التفصيلية للمسيرات والإقامات غير مربوطة بمصدر بيانات في Odoo."
        reasonEn="Detailed payroll and residency reports are not linked to an Odoo data source."
      />
    </div>
  )
}
