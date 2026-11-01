import { Suspense } from 'react'
import { connection } from 'next/server'
import { RecipesPanel } from '@/app/(panel)/recipes/recipes-panel'
import { requireUser } from '@/lib/erp-auth'
import { DisabledModule, Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { prisma } from '@/lib/db'
import { isModuleEnabled } from '@/lib/modules-db'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getActiveScope } from '@/lib/scope'
import { VENTURE_BRANDS } from '@/lib/venture-hierarchy'
import { listRecipeCosts } from '@/services/recipe.service'

export const metadata = { title: 'الوصفات وتكلفة الغذاء | AetherBI' }
export const dynamic = 'force-dynamic'

async function RecipesContent() {
  await connection()
  const user = await requireUser()
  if (!can(user, 'recipes', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  if (!(await isModuleEnabled('recipes'))) return <DisabledModule title="الوصفات وتكلفة الغذاء" />

  const scope = await getActiveScope()
  const [rows, products] = await Promise.all([
    listRecipeCosts({ brandCode: scope.brandId }),
    prisma.product.findMany({
      orderBy: { name: 'asc' },
      take: 400,
      select: { id: true, code: true, name: true, sellingPrice: true, costPrice: true },
    }),
  ])

  return (
    <div>
      <PageHeader
        title="الوصفات وتكلفة الغذاء · Recipes & Food Cost"
        description={`${scope.labelAr} · BOM + Food Cost % + خصم ذري عند البيع`}
      />
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
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<PageSkeleton title="الوصفات" />}>
      <RecipesContent />
    </Suspense>
  )
}
