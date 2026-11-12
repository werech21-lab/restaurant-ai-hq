import { Suspense } from 'react'
import { requirePageUser } from '@/lib/auth/context'
import { OrderPrepSlaStudio } from '@/components/erp/OrderPrepSlaStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'مدة تجهيز الطلبات — KDS SLA | فنتشر فودز',
  description:
    'مراقبة مدة تجهيز الطلب حسب البراند والفرع من لحظة وصول الطلب ولغاية جاهزيته مع التصنيف الثلاثي (أخضر / أصفر / أحمر) وحساب المعدل الوسطي لكل فرع.',
}

export default async function KitchenOrderPrepSlaPage() {
  await requirePageUser('/erp/prep-sla')
  return (
    <div className="w-full">
      <Suspense
        fallback={
          <div className="h-[600px] w-full animate-pulse rounded-3xl bg-white/60 dark:bg-neutral-900/60" />
        }
      >
        <OrderPrepSlaStudio />
      </Suspense>
    </div>
  )
}
