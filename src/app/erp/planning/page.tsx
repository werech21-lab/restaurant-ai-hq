import { requirePageUser } from '@/lib/auth/context'
import { StrategicPlanningStudio } from '@/components/erp/StrategicPlanningStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'التخطيط والتوقعات | فنتشر فودز',
  description: 'التخطيط الاستراتيجي، سيناريوهات التوقعات المالية، واعتماد التعاميم الرسمية من بيانات أودو 17.',
}

export default async function StrategicPlanningPage() {
  await requirePageUser('/erp/planning')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <StrategicPlanningStudio />
    </div>
  )
}
