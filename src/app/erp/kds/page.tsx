import { Suspense } from 'react'
import { VentureKdsHub } from '@/components/kds/VentureKdsHub'

export const metadata = {
  title: 'شاشة المطبخ الذكية KDS | فنتشر فودز · AetherBI',
  description: 'شاشة تشغيل المطبخ الذكية ومحطات التحضير لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

export default function ErpKdsPage() {
  return (
    <Suspense fallback={<div className="p-8 font-bold text-mist-100">جاري تحميل شاشة المطبخ KDS...</div>}>
      <VentureKdsHub locale="ar" />
    </Suspense>
  )
}
