import { requirePageUser } from '@/lib/auth/context'
import { StrategicPlanningStudio } from '@/components/erp/StrategicPlanningStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'التخطيط والتوقعات والامتثال | فنتشر فودز',
  description: 'التخطيط الاستراتيجي، سيناريوهات التوقعات المالية، تعميم القرارات، ومراقبة امتثال أودو 17.',
}

export default async function StrategicPlanningPage() {
  await requirePageUser('/erp/planning')
  return (
    <div className="w-full">
      <StrategicPlanningStudio />
    </div>
  )
}
