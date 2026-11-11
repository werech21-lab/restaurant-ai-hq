import { requirePageUser } from '@/lib/auth/context'
import { BeforeAfterStudio } from '@/components/aether/BeforeAfterStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'مقارنة قبل وبعد | فنتشر فودز',
  description: 'مقارنة المبيعات والصافي بالجيب والطلبات قبل وبعد لكل مطعم وفرع وقناة.',
}

export default async function BeforeAfterPage() {
  await requirePageUser('/erp/before-after')

  return (
    <div className="w-full min-w-0">
      <BeforeAfterStudio />
    </div>
  )
}
