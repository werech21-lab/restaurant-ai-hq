import { requirePageUser } from '@/lib/auth/context'
import { FullJourney360 } from '@/components/aether/FullJourney360'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ملخص الشركة | فنتشر فودز',
  description: 'ملخص الشركة والأرقام المهمة وتوصيات الربح من بيانات أودو المباشرة.',
}

export default async function ExecutiveCenterPage() {
  await requirePageUser('/erp')

  return (
    <div className="w-full">
      <FullJourney360 />
    </div>
  )
}
