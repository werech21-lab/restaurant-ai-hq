'use client'

import Image from 'next/image'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/erp-ui'
import { PrintButton } from '@/components/print-button'
import { ExportCsvButton } from '@/components/ui/export-button'
import { StateBlock } from '@/components/ui/state-block'
import { WhatsAppButton } from '@/components/whatsapp-button'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatDateTime,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { statementText, waLink } from '@/lib/whatsapp'
import type { Statement } from '@/services/ledger.service'

const KIND_EN_MAP: Record<string, string> = {
  'فاتورة مبيعات': 'Sales Invoice',
  'سند قبض': 'Receipt Voucher',
  'أمر شراء': 'Purchase Order',
  'سند صرف': 'Payment Voucher',
}

function UnavailableValue({ locale }: { locale: FormatLocale }) {
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

export function StatementView({
  statement,
  kind,
  backHref,
  balanceLabel,
  hint,
  locale: localeProp,
}: {
  statement: Statement
  kind: 'customer' | 'supplier'
  backHref: string
  balanceLabel: string
  hint: string
  locale?: FormatLocale
}) {
  const { locale: ctxLocale, t } = useI18n()
  const locale: FormatLocale = localeProp ?? (ctxLocale === 'en' ? 'en' : 'ar')
  const en = locale === 'en'
  const dir = en ? 'ltr' : 'rtl'
  const BackIcon = en ? ArrowLeft : ArrowRight

  const formattedClosingBalance = formatKwd(statement.closingBalance, locale)
  const waHref = waLink(
    statement.phone,
    statementText({ name: statement.name, balance: formattedClosingBalance }),
  )

  const printedAt = formatDateTime(new Date(), { locale, showZone: true })
  const titleText = en
    ? `Account Statement · ${statement.name}`
    : `كشف حساب · ${statement.name}`
  const bilingualKind =
    kind === 'customer'
      ? 'كشف حساب عميل · Customer Account Statement'
      : 'كشف حساب مورد · Supplier Account Statement'

  const translateKind = (raw: string) =>
    en ? (KIND_EN_MAP[raw] ?? raw) : raw

  return (
    <div dir={dir} className="statement-sheet space-y-4">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .statement-sheet,
          .statement-sheet .print-sheet,
          .statement-sheet .print-sheet * {
            color: #020617 !important;
          }
          .statement-sheet .print-sheet {
            background-color: #ffffff !important;
            border-color: #cbd5e1 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="no-print print:hidden">
        <PageHeader
          title={titleText}
          description={hint}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={backHref}
                aria-label={en ? 'Back' : 'رجوع'}
                className="ds-motion ds-focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:bg-[#1C2A24]"
              >
                <BackIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{en ? 'Back' : 'رجوع'}</span>
              </a>
              <ExportCsvButton
                kind={
                  kind === 'customer' ? 'customer-statement' : 'supplier-statement'
                }
                filename={
                  kind === 'customer'
                    ? 'customer-statement.csv'
                    : 'supplier-statement.csv'
                }
                query={`id=${statement.id}`}
              />
              <PrintButton
                label={en ? 'Print statement' : 'طباعة كشف الحساب'}
              />
              {waHref ? (
                <WhatsAppButton
                  label={
                    en
                      ? 'Send statement via WhatsApp'
                      : 'إرسال كشف الحساب عبر واتساب'
                  }
                  href={waHref}
                />
              ) : (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {en
                    ? 'Add international phone to share via WhatsApp'
                    : 'أضف رقم الهاتف بالصيغة الدولية للإرسال عبر واتساب'}
                </span>
              )}
            </div>
          }
        />
      </div>

      <article
        data-print-sheet="true"
        className="print-sheet ds-surface mx-auto max-w-[210mm] space-y-4 rounded-2xl p-5 sm:p-6 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:text-slate-950 print:shadow-none print:ring-0"
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
                alt={en ? 'Venture Foods logo' : 'شعار فنتشر فودز'}
                width={140}
                height={48}
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 print:text-slate-950">
                {t('panel.company.ar')}
              </p>
              <p
                dir="ltr"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 print:text-slate-800"
              >
                {t('panel.company.en')}
              </p>
            </div>
          </div>

          <div className="min-w-0 text-start">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 print:text-slate-800">
              {bilingualKind}
            </p>
            <p
              dir="ltr"
              className="mt-1 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300 print:text-slate-700"
            >
              {printedAt}
            </p>
          </div>
        </header>

        <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-4 dark:border-white/10 dark:bg-[#141F1B] print:border-slate-300 print:bg-white">
          <div className="min-w-0">
            <p className="text-xs text-slate-600 dark:text-slate-400 print:text-slate-700">
              الاسم · Name
            </p>
            <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100 print:text-slate-950">
              {statement.name || <UnavailableValue locale={locale} />}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-600 dark:text-slate-400 print:text-slate-700">
              الهاتف · Phone
            </p>
            <p
              className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
              dir="ltr"
            >
              {statement.phone ? (
                statement.phone
              ) : (
                <UnavailableValue locale={locale} />
              )}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-600 dark:text-slate-400 print:text-slate-700">
              البريد · Email
            </p>
            <p
              className="mt-0.5 break-all font-semibold text-slate-900 dark:text-slate-100 print:text-slate-950"
              dir="ltr"
            >
              {statement.email ? (
                statement.email
              ) : (
                <UnavailableValue locale={locale} />
              )}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-600 dark:text-slate-400 print:text-slate-700">
              {balanceLabel}
            </p>
            <p
              dir="ltr"
              className="mt-0.5 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400 print:text-slate-950"
            >
              {formattedClosingBalance}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 print:border-slate-300">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-white/10 dark:bg-[#141F1B] dark:text-slate-300 print:border-slate-950 print:bg-slate-100 print:text-slate-900">
                  <th className="px-3 py-3 text-start font-bold">
                    التاريخ · Date
                  </th>
                  <th className="px-3 py-3 text-start font-bold">
                    البيان · Description
                  </th>
                  <th className="px-3 py-3 text-start font-bold">
                    المرجع · Reference
                  </th>
                  <th className="px-3 py-3 text-start font-bold">
                    مدين · Debit
                  </th>
                  <th className="px-3 py-3 text-start font-bold">
                    دائن · Credit
                  </th>
                  <th className="px-3 py-3 text-start font-bold">
                    الرصيد · Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4">
                      <StateBlock
                        state="empty"
                        compact
                        locale={locale}
                        title={
                          en
                            ? 'No ledger movements recorded'
                            : 'لا توجد حركات مالية مسجلة'
                        }
                        description={
                          en
                            ? 'Transactions will appear here once invoices or payments are posted.'
                            : 'تظهر الحركات هنا فور ترحيل الفواتير أو سندات القبض والصرف.'
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  statement.lines.map((line) => (
                    <tr
                      key={line.id}
                      className="border-b border-slate-200 last:border-0 dark:border-white/10 print:border-slate-300"
                    >
                      <td
                        dir="ltr"
                        className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-800 dark:text-slate-200 print:text-slate-950"
                      >
                        {formatDate(line.at, locale)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100 print:text-slate-950">
                        {translateKind(line.kind)}
                      </td>
                      <td
                        className="px-3 py-3 tabular-nums text-slate-700 dark:text-slate-300 print:text-slate-800"
                        dir="ltr"
                      >
                        {line.reference ? (
                          line.reference
                        ) : (
                          <UnavailableValue locale={locale} />
                        )}
                      </td>
                      <td
                        dir="ltr"
                        className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-800 dark:text-slate-200 print:text-slate-950"
                      >
                        {line.debit ? (
                          formatKwd(line.debit, locale)
                        ) : (
                          <UnavailableValue locale={locale} />
                        )}
                      </td>
                      <td
                        dir="ltr"
                        className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-800 dark:text-slate-200 print:text-slate-950"
                      >
                        {line.credit ? (
                          formatKwd(line.credit, locale)
                        ) : (
                          <UnavailableValue locale={locale} />
                        )}
                      </td>
                      <td
                        dir="ltr"
                        className="whitespace-nowrap px-3 py-3 font-bold tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
                      >
                        {formatKwd(line.balance, locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold dark:border-white/20 dark:bg-[#141F1B] print:border-slate-950 print:bg-slate-100">
                  <td
                    className="px-3 py-3 text-slate-900 dark:text-slate-100 print:text-slate-950"
                    colSpan={3}
                  >
                    الإجمالي · Total
                  </td>
                  <td
                    dir="ltr"
                    className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
                  >
                    {formatKwd(statement.totalDebit, locale)}
                  </td>
                  <td
                    dir="ltr"
                    className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
                  >
                    {formatKwd(statement.totalCredit, locale)}
                  </td>
                  <td
                    dir="ltr"
                    className="whitespace-nowrap px-3 py-3 tabular-nums text-emerald-700 dark:text-emerald-400 print:text-slate-950"
                  >
                    {formattedClosingBalance}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </article>
    </div>
  )
}
