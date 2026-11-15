import { requirePageUser } from '@/lib/auth/context'
import { CompetitorsIntelligenceStudio } from '@/components/erp/CompetitorsIntelligenceStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'رادار المنافسين والسوق الكويتي | فنتشر فودز · AetherBI',
  description: 'مقارنة الأسعار والتقييمات وزمن التوصيل وتغطية المناطق مقابل المنافسين في السوق الكويتي.',
}

export default async function CompetitorsPage() {
  await requirePageUser('/erp/competitors')
  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 py-5 sm:px-6 min-w-0">
      <CompetitorsIntelligenceStudio />
    </div>
  )
}
