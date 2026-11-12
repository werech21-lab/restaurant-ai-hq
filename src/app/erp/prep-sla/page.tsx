import { Suspense } from 'react'
import { requirePageUser } from '@/lib/auth/context'
import { OrderPrepSlaStudio } from '@/components/erp/OrderPrepSlaStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'زمن تجهيز المطبخ — KDS SLA | فنتشر فودز',
  description:
    'مراقبة مدة تجهيز الطلب حسب البراند والفرع من لحظة وصول الطلب ولغاية جاهزيته مع التصنيف الثلاثي (أخضر / أصفر / أحمر) وحساب المعدل الوسطي لكل فرع.',
}

export default async function KitchenOrderPrepSlaPage() {
  await requirePageUser('/erp/prep-sla')
  return (
    <div className="w-full max-w-[1920px] mx-auto">
      <Suspense
        fallback={
          <div className="h-[600px] w-full animate-pulse rounded-3xl bg-white/60 dark:bg-[#0D1614]/60" />
        }
      >
        <OrderPrepSlaStudio />
      </Suspense>
    </div>
  )
}
