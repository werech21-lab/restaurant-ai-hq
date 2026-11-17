import { Suspense } from 'react'
import { connection } from 'next/server'
import { Forbidden, PageSkeleton } from '@/components/erp-ui'
import { StateBlock } from '@/components/ui/state-block'
import { getCompany } from '@/lib/company'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/erp-auth'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { qrDataUrl } from '@/lib/qr'
import { PayrollSheet } from './payroll-sheet'

export const metadata = { title: 'طباعة مسير راتب | نظام ERP' }

async function PrintContent({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const [user, locale] = await Promise.all([requireUser(), getLocale()])
  if (!can(user, 'hr', 'view')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  const { id } = await params
  const row = await prisma.payroll.findUnique({
    where: { id },
    include: { employee: true },
  })
  if (!row) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <StateBlock
          state="empty"
          locale={locale}
          title={tx(locale, 'مسير الراتب غير موجود', 'Payroll slip not found')}
          description={tx(
            locale,
            'تعذّر العثور على قسيمة الراتب المطلوبة في قاعدة البيانات.',
            'The requested payroll slip could not be found in the database.',
          )}
          action={
            <a
              href="/hr?tab=payroll"
              className="ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
            >
              {tx(locale, 'العودة لمسيرات الرواتب', 'Back to payroll')}
            </a>
          }
        />
      </div>
    )
  }

  const company = await getCompany()
  const qr = await qrDataUrl(
    `ERP|PAY|${row.employee.code}|${row.netSalary}|${row.year}-${row.month}`,
  )

  return (
    <PayrollSheet
      locale={locale}
      data={{
        id: row.id,
        month: row.month,
        year: row.year,
        basicSalary: row.basicSalary,
        totalAllowances: row.totalAllowances,
        totalDeductions: row.totalDeductions,
        netSalary: row.netSalary,
        absentDays: row.absentDays,
        lateDays: row.lateDays,
        status: row.status,
        paidAt: row.paidAt,
        employee: {
          name: row.employee.name,
          jobTitle: row.employee.jobTitle,
          department: row.employee.department,
          code: row.employee.code,
        },
        companyName: company.name,
        companyTaxNumber: company.taxNumber,
        companyFooter: company.invoiceFooter,
        qrDataUrl: qr,
      }}
    />
  )
}

export default function PayrollPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={<PageSkeleton title="Payroll Slip" />}>
      <PrintContent params={params} />
    </Suspense>
  )
}
