import { requirePageUser } from '@/lib/auth/context'
import { SalesScorecardStudio } from '@/components/erp/SalesScorecardStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'سجل وبطاقة أداء المبيعات | فنتشر فودز · AetherBI',
  description: 'ترتيب وسجل أداء المبيعات الفعلي عبر 6 علامات تجارية و7 فروع و8 قنوات.',
}

export default async function SalesScorecardPage() {
  await requirePageUser('/erp/sales-scorecard')
  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 py-5 sm:px-6 min-w-0">
      <SalesScorecardStudio />
    </div>
  )
}
