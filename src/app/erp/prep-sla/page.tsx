import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/context'
import { OrderPrepSlaStudio } from '@/components/erp/OrderPrepSlaStudio'
import { StateBlock } from '@/components/ui/state-block'

const IS_DATA_SOURCE_CONNECTED = false

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'زمن تجهيز المطبخ — KDS SLA | فنتشر فودز',
  description:
    'مراقبة مدة تجهيز الطلب حسب البراند والفرع من لحظة وصول الطلب ولغاية جاهزيته مع التصنيف الثلاثي (أخضر / أصفر / أحمر) وحساب المعدل الوسطي لكل فرع.',
}

export default async function KitchenOrderPrepSlaPage() {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  await requirePageUser('/erp/prep-sla')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0 overflow-x-hidden">
      <Suspense
        fallback={
          <StateBlock
            state="loading"
            locale="ar"
            skeletonRows={4}
            minHeightClass="min-h-[260px]"
          />
        }
      >
        <OrderPrepSlaStudio />
      </Suspense>
    </div>
  )
}
