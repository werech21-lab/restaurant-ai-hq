import { Suspense } from 'react'
import { VentureKdsHub } from '@/components/kds/VentureKdsHub'

export const metadata = {
  title: 'شاشة تحضير المطبخ الذكية ومراقبة زمن التجهيز | فنتشر فودز · AetherBI',
  description: 'شاشة تشغيل محطات المطبخ الذكية والخصم اللحظي للمخزون لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

export default function ErpKdsPage() {
  return (
    <Suspense fallback={<div className="p-8 font-bold text-mist-100">جاري تحميل شاشة تحضير المطبخ...</div>}>
      <VentureKdsHub locale="ar" />
    </Suspense>
  )
}
