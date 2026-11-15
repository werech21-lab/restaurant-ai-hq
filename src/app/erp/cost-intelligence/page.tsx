import { requirePageUser } from '@/lib/auth/context'
import { CostIntelligenceV2 } from '@/components/aether/CostIntelligenceV2'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ذكاء التكلفة وأسعار الموردين | فنتشر فودز · AetherBI',
  description: 'تحليل انحراف تكلفة البضاعة المباعة وتغير أسعار الموردين وهوامش الوصفات.',
}

export default async function CostIntelligencePage() {
  await requirePageUser('/erp/cost-intelligence')
  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 py-5 sm:px-6 min-w-0">
      <CostIntelligenceV2 />
    </div>
  )
}
