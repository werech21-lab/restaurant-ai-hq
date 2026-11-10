import { requirePageUser } from '@/lib/auth/context'
import { CostIntelligenceV2 } from '@/components/aether/CostIntelligenceV2'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ذكاء التكلفة وأسعار الموردين | فنتشر فودز',
  description: 'رادار ارتفاع أسعار الموردين ومحاكي تآكل هامش الوصفات ومصفوفة انحراف التكلفة النظرية مقابل الفعلية.',
}

export default async function Page() {
  await requirePageUser('/erp/cost-intelligence')
  return (
    <div className="w-full">
      <CostIntelligenceV2 />
    </div>
  )
}
