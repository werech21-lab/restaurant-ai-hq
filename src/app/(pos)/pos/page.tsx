import { Suspense } from 'react'
import { connection } from 'next/server'
import { PosTerminal } from '@/app/(pos)/pos/pos-terminal'
import { requireUser } from '@/lib/erp-auth'
import { prisma } from '@/lib/db'
import { isModuleEnabled } from '@/lib/modules-db'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getActiveScope } from '@/lib/scope'
import { ORDER_TYPES, ventureBranchOptions } from '@/lib/venture-branches'
import { VENTURE_BRANDS } from '@/lib/venture-hierarchy'
import { getLocale } from '@/lib/i18n/server'
import { VenturePosHub } from '@/components/pos/VenturePosHub'

export const metadata = {
  title: 'كاشير ونقاط البيع الميدانية | Venture Foods W.L.L. · AetherBI',
  description: 'نظام نقاط البيع، إغلاق الوردية الأعمى Z-Report، وتسوية K-Net وNBK لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}
export const dynamic = 'force-dynamic'

async function PosContent() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'pos', 'view') && !can(user, 'pos', 'create')) {
    return (
      <div className="p-8 text-center text-mist-100">
        <p className="text-xl font-bold">ليست لديك صلاحية نقطة البيع</p>
        <a href={firstAllowedHref(user)} className="mt-4 inline-block font-semibold text-[#8cc63f]">
          الانتقال إلى صفحتك
        </a>
      </div>
    )
  }
  if (!(await isModuleEnabled('pos'))) {
    return (
      <div className="p-8 text-center text-mist-100">
        <p className="text-xl font-bold">نقطة البيع معطلة</p>
        <a href="/app-builder" className="mt-4 inline-block font-semibold text-[#8cc63f]">
          مدير التطبيقات
        </a>
      </div>
    )
  }

  const scope = await getActiveScope()
  const [products, customers, walkIn] = await Promise.all([
    prisma.product.findMany({
      take: 500,
      orderBy: { name: 'asc' },
      include: { category: { select: { name: true } } },
    }),
    prisma.customer.findMany({ orderBy: { name: 'asc' }, take: 200, select: { id: true, name: true } }),
    prisma.customer.findFirst({ where: { name: 'عميل نقدي - الصندوق' }, select: { id: true } }),
  ])

  const initialBrand = scope.brandId ?? VENTURE_BRANDS[0].id
  const initialBranch =
    scope.branchId ??
    ventureBranchOptions().find((b) => b.brandCode === initialBrand)?.id ??
    ventureBranchOptions()[0]?.id ??
    ''

  const legacyTerminal = (
    <PosTerminal
      walkInId={walkIn?.id ?? ''}
      customers={customers}
      brands={VENTURE_BRANDS.map((b) => ({ code: b.code, nameAr: b.nameAr, nameEn: b.nameEn }))}
      branches={ventureBranchOptions()}
      orderTypes={[...ORDER_TYPES]}
      initialBrandCode={initialBrand}
      initialBranchId={initialBranch}
      warehouseId={scope.warehouseIds[0] ?? ''}
      products={products.map((product) => {
        let imageUrl: string | null = null
        try {
          const custom = JSON.parse(product.customData || '{}') as { imageUrl?: string }
          imageUrl = typeof custom.imageUrl === 'string' ? custom.imageUrl : null
        } catch {
          imageUrl = null
        }
        return {
          id: product.id,
          code: product.code,
          name: product.name,
          category: product.category.name,
          price: product.sellingPrice,
          stock: product.currentStock,
          imageUrl,
        }
      })}
    />
  )

  return <VenturePosHub locale={locale === 'en' ? 'en' : 'ar'} liveChildren={legacyTerminal} />
}

export default function PosPage() {
  return (
    <Suspense fallback={<div className="p-8 font-bold text-mist-100">جارٍ فتح مركز نقاط البيع والرقابة المالية...</div>}>
      <PosContent />
    </Suspense>
  )
}
