import { requirePageUser } from '@/lib/auth/context'
import { CoresHubStudio } from '@/components/aether/CoresHubStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'تحليل المبيعات والقنوات | فنتشر فودز · AetherBI',
  description: 'التحليل التفصيلي للمبيعات اليومية والقنوات والساعات الهادئة من أودو 17.',
}

export default async function SalesAnalysisPage() {
  await requirePageUser('/erp/sales-analysis')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0 overflow-visible">
      <CoresHubStudio initialTab="sales" />
    </div>
  )
}
