'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, MessageCircle, Printer } from 'lucide-react'
import { StateBlock } from '@/components/ui/state-block'
import { cx } from '@/components/ui/primitives'
import {
  UNAVAILABLE_DASH,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'

export type InvoiceSheetSummaryRow = {
  label: string
  labelEn?: string
  value: string
  numeric?: boolean
  emphasize?: boolean
  accent?: boolean
}

export type InvoiceSheetData = {
  title: string
  titleEn?: string
  number: string
  dateLabel: string
  partyLabel: string
  partyLabelEn?: string
  partyName: string
  partyPhone: string
  partyEmail: string
  statusLabel: string
  lines: Array<{
    id: string
    name: string
    code: string
    quantity: string
    price: string
    total: string
  }>
  subtotalLabel: string
  discountLabel: string
  totalLabel: string
  paidLabel: string
  dueLabel: string
  summaryRows?: InvoiceSheetSummaryRow[]
  qrDataUrl: string
  backHref: string
  companyName?: string
  companyNameEn?: string
  companyMeta?: string
  whatsappHref?: string
  whatsappLabel?: string
}

function UnavailableCell({ locale }: { locale: FormatLocale }) {
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

export function InvoiceSheet({
  data,
  initialMode = 'a4',
  locale: localeProp,
}: {
  data: InvoiceSheetData
  initialMode?: 'a4' | 'thermal'
  locale?: FormatLocale
}) {
  const [mode, setMode] = useState<'a4' | 'thermal'>(initialMode)
  const thermal = mode === 'thermal'
  const { t, locale: ctxLocale, companyName } = useI18n()
  const locale: FormatLocale = localeProp ?? (ctxLocale === 'en' ? 'en' : 'ar')
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const unavailableTip = getUnavailableTooltip(locale)
  const BackIcon = isAr ? ArrowRight : ArrowLeft

  const backLabel = isAr ? 'رجوع' : 'Back'
  const printLabel = isAr ? 'طباعة المستند' : 'Print document'
  const a4Label = isAr ? 'ورق A4' : 'A4 Sheet'
  const thermalLabel = isAr ? 'حراري 80مم · POS' : 'Thermal POS (80mm)'
  const whatsappBtnLabel =
    data.whatsappLabel || (isAr ? 'إرسال عبر واتساب' : 'Send via WhatsApp')

  const defaultSummaryRows: InvoiceSheetSummaryRow[] = [
    {
      label: 'المجموع الفرعي',
      labelEn: 'Subtotal',
      value: data.subtotalLabel,
      numeric: true,
    },
    {
      label: 'الخصم',
      labelEn: 'Discount',
      value: data.discountLabel,
      numeric: true,
    },
    {
      label: 'الصافي',
      labelEn: 'Net Total',
      value: data.totalLabel,
      numeric: true,
      emphasize: true,
    },
    {
      label: 'المدفوع',
      labelEn: 'Paid',
      value: data.paidLabel,
      numeric: true,
    },
    {
      label: 'المتبقي',
      labelEn: 'Balance Due',
      value: data.dueLabel,
      numeric: true,
      accent: true,
    },
  ]

  const summaryRows = data.summaryRows ?? defaultSummaryRows
  const resolvedTitle = data.titleEn
    ? `${data.title} · ${data.titleEn}`
    : data.title
  const resolvedPartyLabel = data.partyLabelEn
    ? `${data.partyLabel} · ${data.partyLabelEn}`
    : data.partyLabel
  const resolvedCompanyAr = data.companyName || companyName
  const resolvedCompanyEn = data.companyNameEn || t('panel.company.en')

  return (
    <div dir={dir} className="space-y-4">
      <style>{`
        ${thermal ? '@page { size: 80mm auto; margin: 4mm; }' : '@page { size: A4; margin: 12mm; }'}
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

      <div className="no-print print:hidden flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm dark:border-white/10 dark:bg-[#101815]">
        <div
          role="group"
          aria-label={isAr ? 'تنسيق الطباعة' : 'Print layout'}
          className="flex flex-wrap gap-2"
        >
          <button
            type="button"
            aria-pressed={!thermal}
            aria-label={a4Label}
            onClick={() => setMode('a4')}
            className={cx(
              'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center rounded-xl px-3.5 py-2 text-xs font-semibold',
              !thermal
                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-[#04130D]'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-200 dark:hover:bg-[#1C2A24]',
            )}
          >
            {a4Label}
          </button>
          <button
            type="button"
            aria-pressed={thermal}
            aria-label={thermalLabel}
            onClick={() => setMode('thermal')}
            className={cx(
              'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center rounded-xl px-3.5 py-2 text-xs font-semibold',
              thermal
                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-[#04130D]'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-200 dark:hover:bg-[#1C2A24]',
            )}
          >
            {thermalLabel}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={data.backHref}
            aria-label={backLabel}
            className="ds-motion ds-focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:bg-[#1C2A24]"
          >
            <BackIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{backLabel}</span>
          </a>

          {data.whatsappHref ? (
            <a
              href={data.whatsappHref}
              target="_blank"
              rel="noreferrer"
              aria-label={whatsappBtnLabel}
              className="ds-motion ds-focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{whatsappBtnLabel}</span>
            </a>
          ) : null}

          <button
            type="button"
            aria-label={printLabel}
            onClick={() => window.print()}
            className="ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
          >
            <Printer className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{printLabel}</span>
          </button>
        </div>
      </div>

      <article
        data-print-sheet="true"
        className={cx(
          'print-sheet mx-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#101815] dark:text-slate-100 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-slate-950 print:shadow-none print:ring-0',
          thermal ? 'print-thermal max-w-[80mm]' : 'print-a4 max-w-[210mm]',
        )}
      >
        <header
          className={cx(
            'flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4 dark:border-white/20 print:border-slate-950',
            thermal && 'flex-col',
          )}
        >
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
                {resolvedCompanyAr}
              </p>
              <p
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-slate-800"
                dir="ltr"
              >
                {resolvedCompanyEn}
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 print:text-slate-700">
                {data.companyMeta || 'AetherBI Enterprise ERP · KWD / د.ك'}
              </p>
            </div>
          </div>

          <div className={cx('min-w-0', thermal ? 'w-full' : 'text-start')}>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 print:text-slate-800">
              {resolvedTitle}
            </p>
            <p
              className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
              dir="ltr"
            >
              {data.number || <UnavailableCell locale={locale} />}
            </p>
            <p
              className="mt-0.5 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300 print:text-slate-700"
              dir="ltr"
            >
              {data.dateLabel || <UnavailableCell locale={locale} />}
            </p>
          </div>
        </header>

        <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm dark:border-white/10 dark:bg-[#141F1B] print:border-slate-300 print:bg-white">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 print:text-slate-700">
            {resolvedPartyLabel}
          </p>
          <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100 print:text-slate-950">
            {data.partyName || <UnavailableCell locale={locale} />}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300 print:text-slate-800">
            <span>
              <span className="font-semibold">
                {isAr ? 'الهاتف / Phone: ' : 'Phone / الهاتف: '}
              </span>
              {data.partyPhone ? (
                <span dir="ltr" className="tabular-nums">
                  {data.partyPhone}
                </span>
              ) : (
                <UnavailableCell locale={locale} />
              )}
            </span>
            <span>
              <span className="font-semibold">
                {isAr ? 'البريد / Email: ' : 'Email / البريد: '}
              </span>
              {data.partyEmail ? (
                <span dir="ltr" className="break-all">
                  {data.partyEmail}
                </span>
              ) : (
                <UnavailableCell locale={locale} />
              )}
            </span>
          </div>
          <p className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-slate-800">
            {isAr ? 'الحالة · Status' : 'Status · الحالة'}:{' '}
            <span>{data.statusLabel || <UnavailableCell locale={locale} />}</span>
          </p>
        </section>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900 text-xs text-slate-700 dark:border-white/20 dark:text-slate-300 print:border-slate-950 print:text-slate-800">
                <th className="py-2.5 pe-2 text-start font-bold">
                  الصنف · Item
                </th>
                {thermal ? null : (
                  <th className="px-2 py-2.5 text-start font-bold">
                    الرمز · Code
                  </th>
                )}
                <th className="px-2 py-2.5 text-start font-bold">
                  الكمية · Qty
                </th>
                <th className="px-2 py-2.5 text-start font-bold">
                  السعر · Price
                </th>
                <th className="py-2.5 ps-2 text-start font-bold">
                  الإجمالي · Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.lines.length === 0 ? (
                <tr>
                  <td colSpan={thermal ? 4 : 5} className="py-4">
                    <StateBlock
                      state="empty"
                      compact
                      locale={locale}
                      title={
                        isAr
                          ? 'لا توجد بنود في هذا المستند'
                          : 'No line items in this document'
                      }
                      description={
                        isAr
                          ? 'لم تُسجَّل أي أصناف ضمن هذه الوثيقة.'
                          : 'No line items were recorded for this document.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                data.lines.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-slate-200 dark:border-white/10 print:border-slate-300"
                  >
                    <td className="py-2.5 pe-2 font-semibold text-slate-900 dark:text-slate-100 print:text-slate-950">
                      {line.name}
                      {thermal ? (
                        <span
                          className="mt-0.5 block text-xs tabular-nums text-slate-500 dark:text-slate-400 print:text-slate-700"
                          dir="ltr"
                        >
                          {line.code || UNAVAILABLE_DASH}
                        </span>
                      ) : null}
                    </td>
                    {thermal ? null : (
                      <td
                        className="px-2 py-2.5 tabular-nums text-slate-700 dark:text-slate-300 print:text-slate-800"
                        dir="ltr"
                      >
                        {line.code ? (
                          line.code
                        ) : (
                          <UnavailableCell locale={locale} />
                        )}
                      </td>
                    )}
                    <td
                      className="px-2 py-2.5 tabular-nums text-slate-800 dark:text-slate-200 print:text-slate-950"
                      dir="ltr"
                    >
                      {line.quantity || <UnavailableCell locale={locale} />}
                    </td>
                    <td
                      className="px-2 py-2.5 tabular-nums text-slate-800 dark:text-slate-200 print:text-slate-950"
                      dir="ltr"
                    >
                      {line.price || <UnavailableCell locale={locale} />}
                    </td>
                    <td
                      className="py-2.5 ps-2 font-semibold tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-950"
                      dir="ltr"
                    >
                      {line.total || <UnavailableCell locale={locale} />}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          className={cx(
            'mt-5 flex gap-5',
            thermal ? 'flex-col' : 'flex-wrap items-end justify-between',
          )}
        >
          <div className="text-center">
            {data.qrDataUrl ? (
              <div
                className="mx-auto inline-block rounded-xl border border-slate-200 p-1.5 print:border-slate-300"
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
              <span
                title={unavailableTip}
                aria-label={unavailableTip}
                data-unavailable="true"
                className="inline-flex h-28 w-28 items-center justify-center rounded-xl border border-slate-200 text-lg font-bold text-slate-400"
              >
                {UNAVAILABLE_DASH}
              </span>
            )}
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 print:text-slate-700">
              رمز QR · QR Code
            </p>
          </div>

          <dl className="min-w-[230px] flex-1 space-y-1.5 text-sm sm:max-w-xs">
            {summaryRows.map((row) => {
              const rowLabel = row.labelEn
                ? `${row.label} · ${row.labelEn}`
                : row.label
              return (
                <div
                  key={rowLabel}
                  className={cx(
                    'flex items-baseline justify-between gap-4',
                    row.emphasize &&
                      'border-t-2 border-slate-900 pt-2 text-base dark:border-white/20 print:border-slate-950',
                  )}
                >
                  <dt
                    className={cx(
                      'text-slate-700 dark:text-slate-300 print:text-slate-800',
                      row.emphasize &&
                        'font-bold text-slate-900 dark:text-slate-100 print:text-slate-950',
                    )}
                  >
                    {rowLabel}
                  </dt>
                  <dd
                    dir={row.numeric !== false ? 'ltr' : undefined}
                    className={cx(
                      row.numeric !== false && 'tabular-nums',
                      row.emphasize
                        ? 'font-bold text-slate-900 dark:text-slate-100 print:text-slate-950'
                        : row.accent
                          ? 'font-bold text-emerald-700 dark:text-emerald-400 print:text-slate-950'
                          : 'font-semibold text-slate-900 dark:text-slate-100 print:text-slate-950',
                    )}
                  >
                    {row.value || <UnavailableCell locale={locale} />}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>

        <footer className="mt-6 border-t border-slate-200 pt-3 text-center text-xs text-slate-600 dark:border-white/10 dark:text-slate-400 print:border-slate-300 print:text-slate-700">
          شكراً لتعاملكم · Thank you for your business
        </footer>
      </article>
    </div>
  )
}
