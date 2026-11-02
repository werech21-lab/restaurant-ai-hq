import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/erp-auth'
import { PageHeader, PageSkeleton, cardClass, StatusBadge } from '@/components/erp-ui'
import { StatCard } from '@/components/ui/stat-card'
import { formatQty } from '@/lib/format'
import { can, firstAllowedHref } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { costOfGoods, purchaseSummary, salesSummary } from '@/lib/reports'
import { getActiveScope, purchaseOrderNumbersForScope, salesWhereForScope } from '@/lib/scope'
import { countLowStock, listLowStock } from '@/lib/stock'
import { dateFor, getLocale, moneyFor, monthFor, tx } from '@/lib/i18n/server'
import { monthRange } from '@/lib/format'

export const metadata = { title: 'Dashboard | AetherBI ERP' }
export const dynamic = 'force-dynamic'

async function DashboardContent() {
  await connection()
  const user = await requireUser()
  if (!can(user, 'dashboard', 'view')) redirect(firstAllowedHref(user))

  const locale = await getLocale()
  const scope = await getActiveScope()
  const now = new Date()
  const { start, end } = monthRange(now)
  const purchaseNumbers = await purchaseOrderNumbersForScope(scope.warehouseIds)
  const [sales, purchases, lowCount, lowItems, recentSales, recentPurchases] = await Promise.all([
    salesSummary(start, end, scope.warehouseIds),
    purchaseSummary(start, end, purchaseNumbers),
    countLowStock(scope.warehouseIds),
    listLowStock(5, scope.warehouseIds),
    prisma.salesInvoice.findMany({
      where: salesWhereForScope(scope.warehouseIds),
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
    prisma.purchaseOrder.findMany({
      where: purchaseNumbers ? { orderNumber: { in: purchaseNumbers.length ? purchaseNumbers : ['__none__'] } } : {},
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { supplier: { select: { name: true } } },
    }),
  ])
  const monthCogs = await costOfGoods(start, end, scope.warehouseIds)
  const monthLabel = monthFor(locale, now)
  const scopeLabel = locale === 'en' ? scope.labelEn : scope.labelAr

  const cards = [
    {
      href: '/sales',
      label: tx(locale, `مبيعات ${monthLabel}`, `Sales · ${monthLabel}`),
      value: moneyFor(locale, sales.total),
      danger: false,
    },
    {
      href: '/purchases',
      label: tx(locale, `مشتريات ${monthLabel}`, `Purchases · ${monthLabel}`),
      value: moneyFor(locale, purchases.total),
      danger: false,
    },
    {
      href: '/sales',
      label: tx(locale, 'عدد فواتير الشهر', 'Invoices this month'),
      value: String(sales.count),
      danger: false,
    },
    {
      href: '/inventory?filter=low_stock',
      label: tx(locale, 'أصناف تحت حد الطلب', 'Low-stock items'),
      value: String(lowCount),
      danger: true,
    },
  ]

  return (
    <div>
      <PageHeader
        title={tx(locale, `مرحباً ${user.name}`, `Welcome, ${user.name}`)}
        description={tx(
          locale,
          `ملخص ${monthLabel} · ${scopeLabel} · AetherBI Enterprise ERP`,
          `${monthLabel} summary · ${scopeLabel} · AetherBI Enterprise ERP`,
        )}
      />
      <a
        href="/erp/smart-dropzone"
        className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-gold-300/30 bg-gradient-to-l from-[#8cc63f]/15 to-[#00a99d]/10 px-4 py-3 text-sm font-bold text-mist-100 hover:border-gold-300/60"
      >
        <span>
          {tx(
            locale,
            '🧠 بوابة الفرز والأرشفة الذكية الشاملة (AI Auto-Router)',
            '🧠 AI Smart Dropzone & Auto-Router',
          )}
        </span>
        <span className="text-gold-300">{tx(locale, 'افتح الآن', 'Open now')}</span>
      </a>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} href={card.href} label={card.label} value={card.value} danger={card.danger} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className={`${cardClass} p-5`}>
          <h2 className="font-bold text-mist-100">{tx(locale, 'مجمل ربح الشهر', 'Gross profit this month')}</h2>
          <p className="mt-3 text-2xl font-bold text-[#8cc63f]">{moneyFor(locale, sales.total - monthCogs)}</p>
          <p className="mt-2 text-sm text-mist-400">
            {tx(locale, 'المبيعات', 'Sales')} {moneyFor(locale, sales.total)} − {tx(locale, 'التكلفة', 'COGS')}{' '}
            {moneyFor(locale, monthCogs)}
          </p>
        </section>
        <section className={`${cardClass} p-5 lg:col-span-2`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-mist-100">{tx(locale, 'أشد الأصناف نقصاً', 'Most critical stockouts')}</h2>
            <a href="/inventory?filter=low_stock" className="text-sm font-semibold text-[#8cc63f]">
              {tx(locale, 'عرض الكل', 'View all')}
            </a>
          </div>
          {lowItems.length === 0 ? (
            <p className="text-sm text-mist-400">{tx(locale, 'لا توجد أصناف تحت حد الطلب.', 'No items below reorder level.')}</p>
          ) : (
            <ul className="space-y-2">
              {lowItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                  <span>
                    <span className="font-semibold">{item.name}</span>
                    <span className="ms-2 text-xs text-mist-400">{item.code}</span>
                  </span>
                  <span className="text-sm font-bold text-red-600">
                    {formatQty(item.currentStock)} / {tx(locale, 'حد', 'ROP')} {formatQty(item.reorderLevel)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PreviewTable
          locale={locale}
          title={tx(locale, 'آخر فواتير البيع', 'Latest sales invoices')}
          href="/sales"
          empty={tx(locale, 'لا توجد مستندات بعد.', 'No documents yet.')}
          full={tx(locale, 'السجل الكامل', 'Full ledger')}
          rows={recentSales.map((row) => ({
            id: row.id,
            primary: row.invoiceNumber,
            secondary: row.customer.name,
            amount: moneyFor(locale, row.totalAmount),
            date: dateFor(locale, row.createdAt),
            status: row.status,
          }))}
        />
        <PreviewTable
          locale={locale}
          title={tx(locale, 'آخر أوامر الشراء', 'Latest purchase orders')}
          href="/purchases"
          empty={tx(locale, 'لا توجد مستندات بعد.', 'No documents yet.')}
          full={tx(locale, 'السجل الكامل', 'Full ledger')}
          rows={recentPurchases.map((row) => ({
            id: row.id,
            primary: row.orderNumber,
            secondary: row.supplier.name,
            amount: moneyFor(locale, row.totalAmount),
            date: dateFor(locale, row.createdAt),
            status: row.status,
          }))}
        />
      </div>
    </div>
  )
}

function PreviewTable({
  title,
  href,
  rows,
  empty,
  full,
}: {
  locale: 'ar' | 'en'
  title: string
  href: string
  empty: string
  full: string
  rows: Array<{ id: string; primary: string; secondary: string; amount: string; date: string; status: string }>
}) {
  return (
    <section className={`${cardClass} overflow-hidden`}>
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="font-bold">{title}</h2>
        <a href={href} className="text-sm font-semibold text-[#8cc63f]">
          {full}
        </a>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-5 py-6 text-mist-400">{empty}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                <td className="px-5 py-3">
                  <p className="font-semibold">{row.primary}</p>
                  <p className="text-xs text-mist-400">{row.secondary}</p>
                </td>
                <td className="px-3 py-3 text-mist-400">{row.date}</td>
                <td className="px-3 py-3 font-semibold">{row.amount}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Dashboard" />}>
      <DashboardContent />
    </Suspense>
  )
}
