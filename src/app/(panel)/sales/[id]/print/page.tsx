import { Suspense } from 'react'
import { connection } from 'next/server'
import { Forbidden, PageSkeleton } from '@/components/erp-ui'
import { InvoiceSheet } from '@/components/invoice-sheet'
import { StateBlock } from '@/components/ui/state-block'
import { getCompany } from '@/lib/company'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/erp-auth'
import {
  STATUS_LABEL,
  formatDateTime,
  formatKwd,
  formatQty,
} from '@/lib/format'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { qrDataUrl } from '@/lib/qr'
import { invoiceText, payUrl, waLink } from '@/lib/whatsapp'

export const metadata = { title: 'طباعة فاتورة بيع | نظام ERP' }

const STATUS_LABEL_EN: Record<string, string> = {
  DRAFT: 'Draft',
  PAID: 'Paid',
  PARTIAL: 'Partially Paid',
  UNPAID: 'Unpaid',
  PENDING: 'Pending',
  CANCELLED: 'Cancelled',
}

async function PrintContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ layout?: string }>
}) {
  await connection()
  const [{ id }, query, user, locale] = await Promise.all([
    params,
    searchParams,
    requireUser(),
    getLocale(),
  ])
  if (!can(user, 'sales', 'view') && !can(user, 'pos', 'view')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }

  const invoice = await prisma.salesInvoice.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } } },
  })
  if (!invoice) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <StateBlock
          state="empty"
          locale={locale}
          title={tx(locale, 'الفاتورة غير موجودة', 'Sales invoice not found')}
          description={tx(
            locale,
            'تعذّر العثور على الفاتورة المطلوبة في قاعدة البيانات.',
            'The requested sales invoice could not be found in the database.',
          )}
          action={
            <a
              href="/erp/cores"
              className="ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
            >
              {tx(locale, 'العودة للمبيعات والمنيو', 'Back to sales & menu')}
            </a>
          }
        />
      </div>
    )
  }

  const [pendingPay, qr, company] = await Promise.all([
    prisma.paymentLink.findFirst({
      where: { invoiceId: invoice.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    }),
    qrDataUrl(
      `ERP|${invoice.invoiceNumber}|${invoice.totalAmount}|${invoice.createdAt.toISOString()}`,
    ),
    getCompany(),
  ])

  const statusLabel =
    locale === 'en'
      ? (STATUS_LABEL_EN[invoice.status] ?? invoice.status)
      : (STATUS_LABEL[invoice.status] ?? invoice.status)

  return (
    <InvoiceSheet
      locale={locale}
      initialMode={query.layout === 'thermal' ? 'thermal' : 'a4'}
      data={{
        title: 'فاتورة مبيعات',
        titleEn: 'Sales Invoice',
        number: invoice.invoiceNumber,
        dateLabel: formatDateTime(invoice.createdAt, { locale, showZone: true }),
        partyLabel: 'العميل',
        partyLabelEn: 'Customer',
        partyName: invoice.customer.name,
        partyPhone: invoice.customer.phone ?? '',
        partyEmail: invoice.customer.email ?? '',
        statusLabel,
        lines: invoice.items.map((item) => ({
          id: item.id,
          name: item.product.name,
          code: item.product.code,
          quantity: formatQty(item.quantity),
          price: formatKwd(item.unitPrice, locale),
          total: formatKwd(item.totalPrice, locale),
        })),
        subtotalLabel: formatKwd(invoice.subtotal, locale),
        discountLabel: formatKwd(invoice.discount, locale),
        totalLabel: formatKwd(invoice.totalAmount, locale),
        paidLabel: formatKwd(invoice.paidAmount, locale),
        dueLabel: formatKwd(invoice.totalAmount - invoice.paidAmount, locale),
        qrDataUrl: qr,
        backHref: '/erp/cores',
        companyName: company.name,
        companyMeta:
          [
            company.taxNumber
              ? `${tx(locale, 'الرقم الضريبي', 'Tax ID')} ${company.taxNumber}`
              : '',
            company.taxRate
              ? `${tx(locale, 'ضريبة', 'Tax')} ${company.taxRate}%`
              : '',
            company.address,
          ]
            .filter(Boolean)
            .join(' · ') || 'AetherBI Enterprise ERP',
        whatsappLabel: tx(
          locale,
          'إرسال الفاتورة عبر واتساب',
          'Send Invoice via WhatsApp',
        ),
        whatsappHref: waLink(
          invoice.customer.phone ?? '',
          invoiceText({
            customerName: invoice.customer.name,
            number: invoice.invoiceNumber,
            lines: invoice.items.map((item) => ({
              name: item.product.name,
              quantity: formatQty(item.quantity),
              total: formatKwd(item.totalPrice, locale),
            })),
            total: formatKwd(invoice.totalAmount, locale),
            payUrl: pendingPay ? payUrl(pendingPay.token) : undefined,
          }),
        ),
      }}
    />
  )
}

export default function SalesPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ layout?: string }>
}) {
  return (
    <Suspense fallback={<PageSkeleton title="Sales Invoice" />}>
      <PrintContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}
