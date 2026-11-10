import { requirePageUser } from '@/lib/auth/context'
import { FullJourney360 } from '@/components/aether/FullJourney360'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ملخص أداء الشركة وفرص زيادة الربح | فنتشر فودز',
  description: 'ملخص واضح لأداء الفروع وخطوات عملية لزيادة الربح وتقليل الهدر من بيانات أودو المباشرة — شركة فنتشر فودز لإدارة المطاعم ذ.م.م، ترخيص رقم 2021/22838.',
}

export default async function ExecutiveCenterPage() {
  await requirePageUser('/erp')

  return (
    <div className="w-full">
      <FullJourney360 />
    </div>
  )
}
