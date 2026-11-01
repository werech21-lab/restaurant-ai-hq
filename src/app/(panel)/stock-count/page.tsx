import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton, btnPrimary, btnGhost, cardClass } from '@/components/erp-ui'
import { getLocale, moneyFor, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getActiveScope } from '@/lib/scope'
import { countLowStock, listLowStock } from '@/lib/stock'
import { formatQty } from '@/lib/format'

export const metadata = { title: 'Stock Count | AetherBI' }
export const dynamic = 'force-dynamic'

async function StockCountContent() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'inventory', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  const scope = await getActiveScope()
  const scopeLabel = locale === 'en' ? scope.labelEn : scope.labelAr
  const [lowCount, lowItems] = await Promise.all([
    countLowStock(scope.warehouseIds),
    listLowStock(12, scope.warehouseIds),
  ])

  return (
    <div>
      <PageHeader
        title={tx(locale, 'الجرد والهدر', 'Stock count & waste')}
        description={tx(
          locale,
          `${scopeLabel} · متابعة النواقص والهدر التشغيلي بالدينار الكويتي`,
          `${scopeLabel} · Track shortages and operational waste in KWD`,
        )}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory?tab=movements" className={btnPrimary}>
              {tx(locale, 'حركات المخزون', 'Stock movements')}
            </Link>
            <Link href="/inventory?tab=products&filter=low_stock" className={btnGhost}>
              {tx(locale, 'تحت حد الطلب', 'Below reorder')}
            </Link>
          </div>
        }
      />
      <div className={`${cardClass} mb-4 grid gap-3 p-5 sm:grid-cols-3`}>
        <div>
          <p className="text-xs text-mist-400">{tx(locale, 'أصناف تحت حد الطلب', 'Items below reorder')}</p>
          <p className="mt-1 text-2xl font-black text-mist-100">{lowCount}</p>
        </div>
        <div>
          <p className="text-xs text-mist-400">{tx(locale, 'نطاق الجرد', 'Count scope')}</p>
          <p className="mt-1 text-sm font-semibold text-mist-100">{scopeLabel}</p>
        </div>
        <div>
          <p className="text-xs text-mist-400">{tx(locale, 'مسار المطبخ المركزي', 'Central kitchen')}</p>
          <Link href="/central-kitchen" className="mt-1 inline-block text-sm font-bold text-[#8cc63f]">
            {tx(locale, 'فتح المطبخ المركزي', 'Open central kitchen')}
          </Link>
        </div>
      </div>
      <div className={`${cardClass} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-mist-400">
              <th className="px-4 py-3 text-start">{tx(locale, 'الصنف', 'Item')}</th>
              <th className="px-4 py-3 text-start">{tx(locale, 'الرصيد', 'On hand')}</th>
              <th className="px-4 py-3 text-start">{tx(locale, 'حد الطلب', 'Reorder')}</th>
              <th className="px-4 py-3 text-start">{tx(locale, 'التكلفة التقديرية', 'Est. cost')}</th>
            </tr>
          </thead>
          <tbody>
            {lowItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-mist-400">
                  {tx(locale, 'لا أصناف تحت حد الطلب في هذا النطاق.', 'No items below reorder in this scope.')}
                </td>
              </tr>
            ) : (
              lowItems.map((item) => (
                <tr key={item.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-semibold text-mist-100">
                    {item.name}
                    <p className="text-xs text-mist-500" dir="ltr">
                      {item.code}
                    </p>
                  </td>
                  <td className="px-4 py-3">{formatQty(item.currentStock)}</td>
                  <td className="px-4 py-3">{formatQty(item.reorderLevel)}</td>
                  <td className="px-4 py-3">{moneyFor(locale, item.currentStock * item.costPrice)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function StockCountPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Stock count" />}>
      <StockCountContent />
    </Suspense>
  )
}
