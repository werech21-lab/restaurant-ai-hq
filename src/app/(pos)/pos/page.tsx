import { Suspense } from 'react'
import { connection } from 'next/server'
import { PosTerminal } from '@/app/(pos)/pos/pos-terminal'
import { requireUser } from '@/lib/erp-auth'
import { prisma } from '@/lib/db'
import { isModuleEnabled } from '@/lib/modules-db'
import { can, firstAllowedHref } from '@/lib/permissions'
import { ORDER_TYPES, ventureBranchOptions } from '@/lib/venture-branches'
import { ventureBrands } from '@/modules/governance/domain/venture-brands'

export const metadata = { title: 'كاشير المطاعم | فنتشر فودز · AetherBI' }
export const dynamic = 'force-dynamic'

async function PosContent() {
  await connection()
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

  const [products, customers, walkIn] = await Promise.all([
    prisma.product.findMany({
      take: 500,
      orderBy: { name: 'asc' },
      include: { category: { select: { name: true } } },
    }),
    prisma.customer.findMany({ orderBy: { name: 'asc' }, take: 200, select: { id: true, name: true } }),
    prisma.customer.findFirst({ where: { name: 'عميل نقدي - الصندوق' }, select: { id: true } }),
  ])

  return (
    <PosTerminal
      walkInId={walkIn?.id ?? ''}
      customers={customers}
      brands={ventureBrands.map((b) => ({ code: b.code, nameAr: b.nameAr }))}
      branches={ventureBranchOptions()}
      orderTypes={[...ORDER_TYPES]}
      products={products.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category.name,
        price: product.sellingPrice,
        stock: product.currentStock,
      }))}
    />
  )
}

export default function PosPage() {
  return (
    <Suspense fallback={<div className="p-8 font-bold text-mist-100">جارٍ فتح كاشير المطاعم...</div>}>
      <PosContent />
    </Suspense>
  )
}
