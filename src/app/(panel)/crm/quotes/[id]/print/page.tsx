import { Suspense } from 'react'
import { connection } from 'next/server'
import { Forbidden, PageSkeleton } from '@/components/erp-ui'
import { InvoiceSheet } from '@/components/invoice-sheet'
import { StateBlock } from '@/components/ui/state-block'
import { getCompany } from '@/lib/company'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/erp-auth'
import { formatDate, formatDateTime, formatKwd, formatQty } from '@/lib/format'
import { getLocale, tx } from '@/lib/i18n/server'
import { isModuleEnabled } from '@/lib/modules-db'
import { can, firstAllowedHref } from '@/lib/permissions'
import { qrDataUrl } from '@/lib/qr'
import { quoteText, waLink } from '@/lib/whatsapp'

export const metadata = {
  title: 'طباعة عرض سعر كاترينج | شركة فنتشر فودز ذ.م.م.',
}

const QUOTE_STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  SENT: 'مُرسل',
  ACCEPTED: 'مقبول',
  CONVERTED: 'محوّل لفاتورة',
}

const QUOTE_STATUS_EN: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  CONVERTED: 'Converted to Invoice',
}

async function PrintContent({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const [user, locale] = await Promise.all([requireUser(), getLocale()])
  if (!can(user, 'crm', 'view') && !can(user, 'sales', 'view')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  if (!(await isModuleEnabled('crm'))) return <Forbidden href="/crm" />

  const { id } = await params
  const quote = await prisma.quotation.findUnique({
    where: { id },
    include: { customer: true, lead: true, items: { include: { product: true } } },
  })
  if (!quote) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <StateBlock
          state="empty"
          locale={locale}
          title={tx(locale, 'عرض السعر غير موجود', 'Quotation not found')}
          description={tx(
            locale,
            'تعذّر العثور على عرض السعر المطلوب في قاعدة البيانات.',
            'The requested quotation could not be found in the database.',
          )}
          action={
            <a
              href="/crm?tab=quotes"
              className="ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
            >
              {tx(locale, 'العودة لعروض الأسعار', 'Back to quotations')}
            </a>
          }
        />
      </div>
    )
  }

  const company = await getCompany()
  const partyName =
    quote.customer?.name ||
    quote.lead?.contactName ||
    tx(locale, 'عميل محتمل', 'Prospective Customer')
  const partyPhone = quote.customer?.phone || quote.lead?.phone || ''
  const partyEmail = quote.customer?.email || quote.lead?.email || ''
  const qr = await qrDataUrl(
    `ERP|${quote.quoteNumber}|${quote.totalAmount}|${quote.createdAt.toISOString()}`,
  )
  const totalFormatted = formatKwd(quote.totalAmount, locale)
  const statusLabel =
    locale === 'en'
      ? (QUOTE_STATUS_EN[quote.status] ?? quote.status)
      : (QUOTE_STATUS_AR[quote.status] ?? quote.status)
  const taxNote = company.taxRate
    ? tx(
        locale,
        `ضريبة ${company.taxRate}% غير مضافة`,
        `Tax ${company.taxRate}% excluded`,
      )
    : formatKwd(0, locale)
  const validityText = quote.validUntil
    ? formatDate(quote.validUntil, locale)
    : tx(locale, 'بدون تاريخ انتهاء', 'No expiry date')

  return (
    <InvoiceSheet
      locale={locale}
      data={{
        title: 'عرض سعر',
        titleEn: 'Price Quotation',
        number: quote.quoteNumber,
        dateLabel: formatDateTime(quote.createdAt, { locale, showZone: true }),
        partyLabel: 'موجه إلى',
        partyLabelEn: 'Prepared For',
        partyName,
        partyPhone,
        partyEmail,
        statusLabel,
        lines: quote.items.map((item) => ({
          id: item.id,
          name: item.product.name,
          code: item.product.code,
          quantity: formatQty(item.quantity),
          price: formatKwd(item.unitPrice, locale),
          total: formatKwd(item.totalPrice, locale),
        })),
        subtotalLabel: totalFormatted,
        discountLabel: formatKwd(0, locale),
        totalLabel: totalFormatted,
        paidLabel: taxNote,
        dueLabel: validityText,
        summaryRows: [
          {
            label: 'المجموع الفرعي',
            labelEn: 'Subtotal',
            value: totalFormatted,
            numeric: true,
          },
          {
            label: 'الخصم',
            labelEn: 'Discount',
            value: formatKwd(0, locale),
            numeric: true,
          },
          {
            label: 'الإجمالي',
            labelEn: 'Total',
            value: totalFormatted,
            numeric: true,
            emphasize: true,
          },
          {
            label: 'الضريبة',
            labelEn: 'Tax',
            value: taxNote,
            numeric: Boolean(!company.taxRate),
          },
          {
            label: 'ساري حتى',
            labelEn: 'Valid Until',
            value: validityText,
            numeric: Boolean(quote.validUntil),
            accent: true,
          },
        ],
        qrDataUrl: qr,
        backHref: '/crm?tab=quotes',
        companyName: company.name,
        companyMeta: [
          company.taxNumber
            ? `${tx(locale, 'الرقم الضريبي', 'Tax ID')} ${company.taxNumber}`
            : '',
          company.invoiceFooter,
        ]
          .filter(Boolean)
          .join(' · '),
        whatsappLabel: tx(
          locale,
          'إرسال العرض عبر واتساب',
          'Send Quotation via WhatsApp',
        ),
        whatsappHref: waLink(
          partyPhone,
          quoteText({
            name: partyName,
            number: quote.quoteNumber,
            lines: quote.items.map((item) => ({
              name: item.product.name,
              quantity: formatQty(item.quantity),
              total: formatKwd(item.totalPrice, locale),
            })),
            total: totalFormatted,
          }),
        ),
      }}
    />
  )
}

export default function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={<PageSkeleton title="Quotation" />}>
      <PrintContent params={params} />
    </Suspense>
  )
}
