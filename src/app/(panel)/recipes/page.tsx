import { Suspense } from 'react'
import { connection } from 'next/server'
import { RecipesPanel } from '@/app/(panel)/recipes/recipes-panel'
import { PageSkeleton } from '@/components/erp-ui'
import { prisma } from '@/lib/db'
import { getLocale, tx } from '@/lib/i18n/server'
import { getActiveScope } from '@/lib/scope'
import { VENTURE_BRANDS } from '@/lib/venture-hierarchy'
import { listRecipeCosts } from '@/services/recipe.service'
import { SmartIngestLaunchButton } from '@/components/SmartIngestLaunchButton'
import { VentureRecipesHub } from '@/components/recipes/VentureRecipesHub'

export const metadata = {
  title: 'الوصفات وهندسة تكلفة الغذاء المعيارية | Venture Foods W.L.L. · AetherBI',
  description: 'محاسبة تكاليف الوصفات وهندسة المنيو لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

async function RecipesContent() {
  await connection()
  const rawLocale = await getLocale().catch(() => 'ar')
  const locale: 'ar' | 'en' = rawLocale === 'en' ? 'en' : 'ar'
  let rows: any[] = []
  let products: any[] = []

  try {
    const scope = await getActiveScope()
    const [fetchedRows, fetchedProducts] = await Promise.all([
      listRecipeCosts({ brandCode: scope.brandId }).catch(() => []),
      prisma.product.findMany({
        orderBy: { name: 'asc' },
        take: 400,
        select: { id: true, code: true, name: true, sellingPrice: true, costPrice: true },
      }).catch(() => []),
    ])
    rows = fetchedRows
    products = fetchedProducts
  } catch {
    // Graceful fallback to static recipes hub
  }

  const legacyChildren = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
        <h4 className="text-sm font-bold text-emerald-400">
          {tx(locale, 'تكويد وربط الوصفات وقوائم المواد في قاعدة البيانات', 'Database Recipes & Material Setup')}
        </h4>
        <SmartIngestLaunchButton module="inventory" locale={locale} />
      </div>
      <RecipesPanel
        rows={rows}
        products={products}
        brands={VENTURE_BRANDS.map((b) => ({ id: b.id, nameAr: b.nameAr, nameEn: b.nameEn }))}
        canCreate={true}
        canEdit={true}
        canDelete={true}
      />
    </div>
  )

  return <VentureRecipesHub locale={locale} liveChildren={legacyChildren} />
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Recipes" />}>
      <RecipesContent />
    </Suspense>
  )
}
