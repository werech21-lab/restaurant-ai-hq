import { requirePageUser } from '@/lib/auth/context'
import { FullJourney360 } from '@/components/aether/FullJourney360'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ملخص الشركة | فنتشر فودز',
  description: 'المركز المالي التنفيذي الموحد وأهم المؤشرات والتوجيهات المباشرة من أودو 17.',
}

export default async function ExecutiveCenterPage() {
  await requirePageUser('/erp')

  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <FullJourney360 />
    </div>
  )
}
