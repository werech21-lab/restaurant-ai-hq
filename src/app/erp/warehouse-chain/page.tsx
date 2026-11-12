import { Suspense } from 'react'
import { requirePageUser } from '@/lib/auth/context'
import { WarehouseDailyChainStudio } from '@/components/erp/WarehouseDailyChainStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'سلسلة المخزن والفروع | فنتشر فودز',
  description:
    'مراقبة السلسلة اليومية المتصلة: الموجود في المخزن كل يوم، الصادر من المخزن، المستلم بكل فرع، والمباع بكل فرع من الأفرع السبعة.',
}

export default async function WarehouseDailyChainPage() {
  await requirePageUser('/erp/warehouse-chain')
  return (
    <div className="w-full max-w-[1920px] mx-auto">
      <Suspense
        fallback={
          <div className="h-[600px] w-full animate-pulse rounded-3xl bg-white/60 dark:bg-[#0D1614]/60" />
        }
      >
        <WarehouseDailyChainStudio />
      </Suspense>
    </div>
  )
}
