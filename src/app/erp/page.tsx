import { requirePageUser } from '@/lib/auth/context'
import { FullJourney360 } from '@/components/aether/FullJourney360'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المركز الشامل للمختصرات وقرارات الرحلة الكاملة | فنتشر فودز',
  description: 'مختصرات تنفيذية وقرارات جراحية عبر رحلة المطعم الكاملة من المشتريات والمطبخ المركزي حتى التسويات البنكية وولاء العملاء — شركة فنتشر فودز لإدارة المطاعم ذ.م.م، ترخيص رقم 2021/22838.',
}

export default async function ExecutiveCenterPage() {
  await requirePageUser('/erp')

  return (
    <div className="w-full">
      <FullJourney360 />
    </div>
  )
}
