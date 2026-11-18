import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { btnGhost, btnPrimary } from '@/components/erp-ui-classes'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getActiveScope } from '@/lib/scope'
import { countLowStock, listLowStock } from '@/lib/stock'
import { SmartIngestLaunchButton } from '@/components/SmartIngestLaunchButton'
import { StockCountView } from './stock-count-view'

export const metadata = { title: 'Stock Count | AetherBI' }
export const dynamic = 'force-dynamic'

async function StockCountContent() {
  await connection()
  const locale = await getLocale()
  const uiLocale = locale === 'en' ? 'en' : 'ar'
  const user = await requireUser()
  if (!can(user, 'inventory', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  const scope = await getActiveScope()
  const scopeLabel = locale === 'en' ? scope.labelEn : scope.labelAr
  const [lowCount, lowItems] = await Promise.all([
    countLowStock(scope.warehouseIds),
    listLowStock(12, scope.warehouseIds),
  ])

  return (
    <div dir={uiLocale === 'en' ? 'ltr' : 'rtl'} className="space-y-4">
      <PageHeader
        title={tx(locale, 'الجرد والهدر', 'Stock count & waste')}
        description={tx(
          locale,
          `${scopeLabel} · متابعة النواقص والهدر التشغيلي بالدينار الكويتي`,
          `${scopeLabel} · Track shortages and operational waste in KWD`,
        )}
        actions={
          <div className="flex flex-wrap gap-2">
            <SmartIngestLaunchButton module="inventory" locale={locale} />
            <Link href="/erp/warehouse-chain" className={`${btnPrimary} ds-focus-ring min-h-10`}>
              {tx(locale, 'حركات المخزون', 'Stock movements')}
            </Link>
            <Link href="/erp/inventory" className={`${btnGhost} ds-focus-ring min-h-10`}>
              {tx(locale, 'أرصدة المخزون', 'Inventory balances')}
            </Link>
          </div>
        }
      />
      <StockCountView
        locale={uiLocale}
        scopeLabel={scopeLabel}
        lowCount={lowCount}
        lowItems={lowItems.map((item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          currentStock: item.currentStock,
          reorderLevel: item.reorderLevel,
          estCostKwd: item.currentStock * item.costPrice,
        }))}
      />
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
