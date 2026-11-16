'use client'

import Image from 'next/image'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { PrintButton } from '@/components/print-button'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'

export type PayrollPrintData = {
  id: string
  month: number
  year: number
  basicSalary: number | null
  totalAllowances: number | null
  totalDeductions: number | null
  netSalary: number | null
  absentDays: number | null
  lateDays: number | null
  status: string
  paidAt: Date | string | null
  employee: {
    name: string
    jobTitle: string | null
    department: string | null
    code: string | null
  }
  companyName: string
  companyTaxNumber: string
  companyFooter: string
  qrDataUrl: string
}

function MissingCell({ locale }: { locale: FormatLocale }) {
  const tip = getUnavailableTooltip(locale)
  return (
    <span
      dir="ltr"
      title={tip}
      aria-label={tip}
      data-unavailable="true"
      className="tabular-nums text-slate-500 dark:text-slate-400 print:text-slate-700"
    >
      {UNAVAILABLE_DASH}
    </span>
  )
}

export function PayrollSheet({
  data,
  locale = 'ar',
}: {
  data: PayrollPrintData
  locale?: FormatLocale
}) {
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const BackIcon = isAr ? ArrowRight : ArrowLeft

  const backLabel = isAr ? 'رجوع' : 'Back'
  const printLabel = isAr ? 'طباعة القسيمة' : 'Print Payslip'
  const paidDateText = data.paidAt ? formatDate(data.paidAt, locale) : ''
  const isPaid = data.status === 'PAID'

  return (
    <div dir={dir} className="space-y-4">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .print-sheet,
          .print-sheet * {
            color: #020617 !important;
          }
          .print-sheet {
            background-color: #ffffff !important;
            border-color: #cbd5e1 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="no-print print:hidden mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm dark:border-white/10 dark:bg-[#101815]">
        <a
          href="/hr?tab=payroll"
          aria-label={backLabel}
          className="ds-motion ds-focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:bg-[#1C2A24]"
        >
          <BackIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{backLabel}</span>
        </a>
        <PrintButton label={printLabel} />
      </div>

      <article
        data-print-sheet="true"
        className="print-sheet mx-auto max-w-[210mm] rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#101815] dark:text-slate-100 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-slate-950 print:shadow-none print:ring-0"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-4 dark:border-white/20 print:border-slate-950">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="shrink-0 rounded-xl border border-slate-200 p-1.5 print:border-slate-300"
              style={{ backgroundColor: '#FFFFFF' }}
            >
              <Image
                unoptimized
                src="/venture-foods-logo.svg"
                alt={isAr ? 'شعار فنتشر فودز' : 'Venture Foods logo'}
                width={140}
                height={48}
                className="h-11 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 print:text-slate-950 sm:text-lg">
                {data.companyName}
              </p>
              <p
                dir="ltr"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-slate-800"
              >
                VENTURE FOODS RESTAURANTS MANAGEMENT CO. W.L.L.
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 print:text-slate-700">
                {data.companyTaxNumber
                  ? `${isAr ? 'الرقم الضريبي' : 'Tax ID'}: ${data.companyTaxNumber}`
                  : 'مسير رواتب · Payroll Register'}
              </p>
            </div>
          </div>

          <div className="text-start">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 print:text-slate-800">
              قسيمة راتب · Payroll Slip
            </p>
            <p
              dir="ltr"
              className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
            >
              {String(data.month).padStart(2, '0')}/{data.year}
            </p>
          </div>
        </header>

        <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm dark:border-white/10 dark:bg-[#141F1B] print:border-slate-300 print:bg-white">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 print:text-slate-700">
            الموظف · Employee
          </p>
          <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100 print:text-slate-950">
            {data.employee.name || <MissingCell locale={locale} />}
          </p>
          <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300 print:text-slate-800">
            {data.employee.jobTitle || UNAVAILABLE_DASH} ·{' '}
            {data.employee.department || UNAVAILABLE_DASH}
          </p>
          <p
            dir="ltr"
            className="mt-1 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300 print:text-slate-800"
          >
            {data.employee.code ? (
              `#${data.employee.code}`
            ) : (
              <MissingCell locale={locale} />
            )}
          </p>
        </section>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900 text-xs text-slate-700 dark:border-white/20 dark:text-slate-300 print:border-slate-950 print:text-slate-800">
                <th className="py-2.5 text-start font-bold">البند · Item</th>
                <th className="py-2.5 text-end font-bold">القيمة · Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200 dark:border-white/10 print:border-slate-300">
                <td className="py-2.5 text-slate-800 dark:text-slate-200 print:text-slate-950">
                  الراتب الأساسي · Basic Salary
                </td>
                <td
                  dir="ltr"
                  className="py-2.5 text-end font-semibold tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
                >
                  {typeof data.basicSalary === 'number' &&
                  Number.isFinite(data.basicSalary) ? (
                    formatKwd(data.basicSalary, locale)
                  ) : (
                    <MissingCell locale={locale} />
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-white/10 print:border-slate-300">
                <td className="py-2.5 text-slate-800 dark:text-slate-200 print:text-slate-950">
                  البدلات · Allowances
                </td>
                <td
                  dir="ltr"
                  className="py-2.5 text-end font-semibold tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
                >
                  {typeof data.totalAllowances === 'number' &&
                  Number.isFinite(data.totalAllowances) ? (
                    formatKwd(data.totalAllowances, locale)
                  ) : (
                    <MissingCell locale={locale} />
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-white/10 print:border-slate-300">
                <td className="py-2.5 text-slate-800 dark:text-slate-200 print:text-slate-950">
                  الاستقطاعات (شامل الغياب والتأخير) · Deductions
                </td>
                <td
                  dir="ltr"
                  className="py-2.5 text-end font-semibold tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
                >
                  {typeof data.totalDeductions === 'number' &&
                  Number.isFinite(data.totalDeductions) ? (
                    formatKwd(data.totalDeductions, locale)
                  ) : (
                    <MissingCell locale={locale} />
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-white/10 print:border-slate-300">
                <td className="py-2.5 text-slate-800 dark:text-slate-200 print:text-slate-950">
                  أيام الغياب / التأخير · Absent / Late Days
                </td>
                <td
                  dir="ltr"
                  className="py-2.5 text-end font-semibold tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
                >
                  {formatInt(data.absentDays, locale)} /{' '}
                  {formatInt(data.lateDays, locale)}
                </td>
              </tr>
              <tr className="border-t-2 border-slate-900 dark:border-white/20 print:border-slate-950">
                <td className="py-3 font-bold text-slate-900 dark:text-slate-100 print:text-slate-950">
                  صافي الراتب · Net Salary
                </td>
                <td
                  dir="ltr"
                  className="py-3 text-end text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400 print:text-slate-950"
                >
                  {typeof data.netSalary === 'number' &&
                  Number.isFinite(data.netSalary) ? (
                    formatKwd(data.netSalary, locale)
                  ) : (
                    <MissingCell locale={locale} />
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-slate-800 dark:text-slate-200 print:text-slate-950">
              {isPaid ? (
                <>
                  <span>
                    {isAr ? 'حالة الصرف: مصروف' : 'Disbursement Status: Paid'}
                  </span>{' '}
                  <span dir="ltr" className="tabular-nums">
                    {paidDateText && paidDateText !== UNAVAILABLE_DASH ? (
                      paidDateText
                    ) : (
                      <MissingCell locale={locale} />
                    )}
                  </span>
                </>
              ) : isAr ? (
                'حالة الصرف: مسودة لم تُصرف'
              ) : (
                'Disbursement Status: Draft (Unpaid)'
              )}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 print:text-slate-700">
              {data.companyFooter ||
                'شكراً لتعاملكم · Venture Foods Restaurants Management Co.'}
            </p>
          </div>

          <div className="text-center">
            {data.qrDataUrl ? (
              <div
                className="inline-block rounded-xl border border-slate-200 p-1.5 print:border-slate-300"
                style={{ backgroundColor: '#FFFFFF' }}
              >
                <Image
                  unoptimized
                  src={data.qrDataUrl}
                  alt={isAr ? 'رمز QR للتحقق' : 'Verification QR code'}
                  width={112}
                  height={112}
                  className="h-28 w-28"
                />
              </div>
            ) : (
              <MissingCell locale={locale} />
            )}
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 print:text-slate-700">
              رمز QR · QR Code
            </p>
          </div>
        </div>
      </article>
    </div>
  )
}
