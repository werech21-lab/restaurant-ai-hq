import { requirePageUser } from '@/lib/auth/context'
import { SalesAnalysisV2 } from '@/components/aether/SalesAnalysisV2'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'تحليل المبيعات والأصناف وهندسة المنيو | فنتشر فودز',
  description: 'مصفوفة هندسة المنيو الرباعية لـ 364 صنفاً عبر العلامات السبع لشركة فنتشر فودز.',
}

export default async function Page() {
  await requirePageUser('/erp/sales-analysis')
  return (
    <div className="w-full">
      <SalesAnalysisV2 />
    </div>
  )
}