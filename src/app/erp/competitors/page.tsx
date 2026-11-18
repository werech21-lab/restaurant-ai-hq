import { redirect } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/context'
import { CompetitorsIntelligenceStudio } from '@/components/erp/CompetitorsIntelligenceStudio'

const IS_DATA_SOURCE_CONNECTED = false

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'رادار المنافسين والسوق الكويتي | فنتشر فودز · AetherBI',
  description: 'مقارنة الأسعار والتقييمات وزمن التوصيل وتغطية المناطق مقابل المنافسين في السوق الكويتي.',
}

export default async function CompetitorsPage() {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  await requirePageUser('/erp/competitors')
  return (
    <div className="w-full max-w-[1920px] mx-auto px-3 py-5 sm:px-6 min-w-0">
      <CompetitorsIntelligenceStudio />
    </div>
  )
}
