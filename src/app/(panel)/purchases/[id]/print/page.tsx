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

export const metadata = { title: 'طباعة أمر شراء | نظام ERP' }

const STATUS_LABEL_EN: Record<string, string> = {
  DRAFT: 'Draft',
  PAID: 'Paid',
  PARTIAL: 'Partially Paid',
  UNPAID: 'Unpaid',
  PENDING: 'Pending',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

async function PrintContent({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  const [user, locale] = await Promise.all([requireUser(), getLocale()])
  if (!can(user, 'purchases', 'view')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { product: true } } },
  })
  if (!order) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <StateBlock
          state="empty"
          locale={locale}
          title={tx(locale, 'أمر الشراء غير موجود', 'Purchase order not found')}
          description={tx(
            locale,
            'تعذّر العثور على أمر الشراء المطلوب في قاعدة البيانات.',
            'The requested purchase order could not be found in the database.',
          )}
          action={
            <a
              href="/erp/warehouse-chain"
              className="ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
            >
              {tx(locale, 'العودة لسلسلة المخازن', 'Back to warehouse chain')}
            </a>
          }
        />
      </div>
    )
  }

  const [qr, company] = await Promise.all([
    qrDataUrl(
      `ERP|${order.orderNumber}|${order.totalAmount}|${order.createdAt.toISOString()}`,
    ),
    getCompany(),
  ])

  const statusLabel =
    locale === 'en'
      ? (STATUS_LABEL_EN[order.status] ?? order.status)
      : (STATUS_LABEL[order.status] ?? order.status)

  return (
    <InvoiceSheet
      locale={locale}
      data={{
        title: 'أمر شراء',
        titleEn: 'Purchase Order',
        number: order.orderNumber,
        dateLabel: formatDateTime(order.createdAt, { locale, showZone: true }),
        partyLabel: 'المورد',
        partyLabelEn: 'Supplier',
        partyName: order.supplier.name,
        partyPhone: order.supplier.phone ?? '',
        partyEmail: order.supplier.email ?? '',
        statusLabel,
        lines: order.items.map((item) => ({
          id: item.id,
          name: item.product.name,
          code: item.product.code,
          quantity: formatQty(item.quantity),
          price: formatKwd(item.unitCost, locale),
          total: formatKwd(item.totalCost, locale),
        })),
        subtotalLabel: formatKwd(order.totalAmount, locale),
        discountLabel: formatKwd(0, locale),
        totalLabel: formatKwd(order.totalAmount, locale),
        paidLabel: formatKwd(order.paidAmount, locale),
        dueLabel: formatKwd(order.totalAmount - order.paidAmount, locale),
        qrDataUrl: qr,
        backHref: '/erp/warehouse-chain',
        companyName: company.name,
        companyMeta:
          [
            company.taxNumber
              ? `${tx(locale, 'الرقم الضريبي', 'Tax ID')} ${company.taxNumber}`
              : '',
            company.address,
          ]
            .filter(Boolean)
            .join(' · ') || 'AetherBI Enterprise ERP',
      }}
    />
  )
}

export default function PurchasePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={<PageSkeleton title="Purchase Order" />}>
      <PrintContent params={params} />
    </Suspense>
  )
}
