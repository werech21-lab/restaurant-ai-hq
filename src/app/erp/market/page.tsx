import { requirePageUser } from '@/lib/auth/context'
import { CompetitorsIntelligenceStudio } from '@/components/erp/CompetitorsIntelligenceStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ذكاء السوق والمنافسين | فنتشر فودز · AetherBI',
  description: 'مقارنة الأسعار والتقييمات وتغطية المناطق الجغرافية في الكويت.',
}

export default async function MarketIntelligencePage() {
  await requirePageUser('/erp/market')
  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 py-5 sm:px-6 min-w-0">
      <CompetitorsIntelligenceStudio />
    </div>
  )
}
