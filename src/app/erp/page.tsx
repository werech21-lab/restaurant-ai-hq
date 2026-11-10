import { requirePageUser } from '@/lib/auth/context'
import { GrowthPlaybookV5 } from '@/components/aether/GrowthPlaybookV5'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'الحلول ومقترحات التطوير والنمو | فنتشر فودز',
  description: 'الخلل المكتشف والحلول الفورية ومقترحات النمو والنتيجة المتوقعة لشركة فنتشر فودز لإدارة المطاعم ذ.م.م — ترخيص رقم 2021/22838.',
}

export default async function ExecutiveCenterPage() {
  await requirePageUser('/erp')

  return (
    <div className="w-full">
      <GrowthPlaybookV5 />
    </div>
  )
}
