import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/erp-auth'
import { PageHeader, PageSkeleton, cardClass } from '@/components/erp-ui'
import { StatCard } from '@/components/ui/stat-card'
import { formatDate, formatMoney, formatMonth, formatQty, monthRange } from '@/lib/format'
import { can, firstAllowedHref } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { costOfGoods, purchaseSummary, salesSummary } from '@/lib/reports'
import { getActiveScope, purchaseOrderNumbersForScope, salesWhereForScope } from '@/lib/scope'
import { countLowStock, listLowStock } from '@/lib/stock'
import { StatusBadge } from '@/components/erp-ui'

export const metadata = { title: 'لوحة التحكم | نظام ERP' }

async function DashboardContent() {
  await connection()
  const user = await requireUser()
  if (!can(user, 'dashboard', 'view')) redirect(firstAllowedHref(user))

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

  const cards = [
    { href: '/sales', label: `مبيعات ${formatMonth(now)}`, value: formatMoney(sales.total), danger: false },
    { href: '/purchases', label: `مشتريات ${formatMonth(now)}`, value: formatMoney(purchases.total), danger: false },
    { href: '/sales', label: 'عدد فواتير الشهر', value: String(sales.count), danger: false },
    { href: '/inventory?filter=low_stock', label: 'أصناف تحت حد الطلب', value: String(lowCount), danger: true },
  ]

  return (
    <div>
      <PageHeader
        title={`مرحباً ${user.name}`}
        description={`ملخص ${formatMonth(now)} · ${scope.labelAr} · AetherBI Enterprise ERP`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} href={card.href} label={card.label} value={card.value} danger={card.danger} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className={`${cardClass} p-5`}>
          <h2 className="font-bold text-mist-100">مجمل ربح الشهر</h2>
          <p className="mt-3 text-2xl font-bold text-[#8cc63f]">{formatMoney(sales.total - monthCogs)}</p>
          <p className="mt-2 text-sm text-mist-400">
            المبيعات {formatMoney(sales.total)} − التكلفة {formatMoney(monthCogs)}
          </p>
        </section>
        <section className={`${cardClass} p-5 lg:col-span-2`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-mist-100">أشد الأصناف نقصاً</h2>
            <a href="/inventory?filter=low_stock" className="text-sm font-semibold text-[#8cc63f]">
              عرض الكل
            </a>
          </div>
          {lowItems.length === 0 ? (
            <p className="text-sm text-mist-400">لا توجد أصناف تحت حد الطلب.</p>
          ) : (
            <ul className="space-y-2">
              {lowItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                  <span>
                    <span className="font-semibold">{item.name}</span>
                    <span className="mr-2 text-xs text-mist-400">{item.code}</span>
                  </span>
                  <span className="text-sm font-bold text-red-600">
                    {formatQty(item.currentStock)} / حد {formatQty(item.reorderLevel)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PreviewTable
          title="آخر فواتير البيع"
          href="/sales"
          rows={recentSales.map((row) => ({
            id: row.id,
            primary: row.invoiceNumber,
            secondary: row.customer.name,
            amount: formatMoney(row.totalAmount),
            date: formatDate(row.createdAt),
            status: row.status,
          }))}
        />
        <PreviewTable
          title="آخر أوامر الشراء"
          href="/purchases"
          rows={recentPurchases.map((row) => ({
            id: row.id,
            primary: row.orderNumber,
            secondary: row.supplier.name,
            amount: formatMoney(row.totalAmount),
            date: formatDate(row.createdAt),
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
}: {
  title: string
  href: string
  rows: Array<{ id: string; primary: string; secondary: string; amount: string; date: string; status: string }>
}) {
  return (
    <section className={`${cardClass} overflow-hidden`}>
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="font-bold">{title}</h2>
        <a href={href} className="text-sm font-semibold text-[#8cc63f]">
          السجل الكامل
        </a>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-5 py-6 text-mist-400">لا توجد مستندات بعد.</td>
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
    <Suspense fallback={<PageSkeleton title="لوحة التحكم" />}>
      <DashboardContent />
    </Suspense>
  )
}
