import { Suspense } from 'react'
import { connection } from 'next/server'
import { RecipesPanel } from '@/app/(panel)/recipes/recipes-panel'
import { requireUser } from '@/lib/erp-auth'
import { DisabledModule, Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { prisma } from '@/lib/db'
import { isModuleEnabled } from '@/lib/modules-db'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getLocale, tx } from '@/lib/i18n/server'
import { getActiveScope } from '@/lib/scope'
import { VENTURE_BRANDS } from '@/lib/venture-hierarchy'
import { listRecipeCosts } from '@/services/recipe.service'
import { SmartIngestLaunchButton } from '@/components/SmartIngestLaunchButton'
import { VentureRecipesHub } from '@/components/recipes/VentureRecipesHub'

export const metadata = {
  title: 'الوصفات وتكلفة الغذاء BOM | Venture Foods W.L.L. · AetherBI',
  description: 'محاسبة تكاليف الوصفات متعددة المستويات، تحليل الانحراف النظري مقابل الفعلي، ومحاكي ربحية القنوات لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}
export const dynamic = 'force-dynamic'

async function RecipesContent() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'recipes', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  if (!(await isModuleEnabled('recipes'))) {
    return <DisabledModule title={tx(locale, 'الوصفات وتكلفة الغذاء', 'Recipes & food cost')} />
  }
  const scope = await getActiveScope()
  const scopeLabel = locale === 'en' ? scope.labelEn : scope.labelAr
  const [rows, products] = await Promise.all([
    listRecipeCosts({ brandCode: scope.brandId }),
    prisma.product.findMany({
      orderBy: { name: 'asc' },
      take: 400,
      select: { id: true, code: true, name: true, sellingPrice: true, costPrice: true },
    }),
  ])

  const legacyChildren = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
        <h4 className="text-sm font-bold text-emerald-400">
          {tx(locale, "إدارة وصفات قاعدة البيانات الحية (Prisma DB)", "Prisma Database Recipes & BOM Setup")}
        </h4>
        <SmartIngestLaunchButton module="inventory" locale={locale} />
      </div>
      <RecipesPanel
        rows={rows}
        products={products}
        brands={VENTURE_BRANDS.map((b) => ({ id: b.id, nameAr: b.nameAr, nameEn: b.nameEn }))}
        canCreate={can(user, 'recipes', 'create')}
        canEdit={can(user, 'recipes', 'edit')}
        canDelete={can(user, 'recipes', 'delete')}
      />
    </div>
  )

  return <VentureRecipesHub locale={locale === 'en' ? 'en' : 'ar'} liveChildren={legacyChildren} />
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Recipes" />}>
      <RecipesContent />
    </Suspense>
  )
}
