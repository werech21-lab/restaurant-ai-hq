import { Suspense } from 'react'
import { requirePageUser } from '@/lib/auth/context'
import { WarehouseDailyChainStudio } from '@/components/erp/WarehouseDailyChainStudio'
import { StateBlock } from '@/components/ui/state-block'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'سلسلة المخزن والفروع | فنتشر فودز',
  description:
    'مراقبة السلسلة اليومية المتصلة: الموجود في المخزن كل يوم، الصادر من المخزن، المستلم بكل فرع، والمباع بكل فرع من الأفرع السبعة.',
}

export default async function WarehouseDailyChainPage() {
  await requirePageUser('/erp/warehouse-chain')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0 overflow-x-hidden">
      <Suspense
        fallback={
          <StateBlock
            state="loading"
            locale="ar"
            skeletonRows={5}
            minHeightClass="min-h-[320px]"
          />
        }
      >
        <WarehouseDailyChainStudio />
      </Suspense>
    </div>
  )
}
