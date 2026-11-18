import { redirect } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/context'
import { CompetitorsIntelligenceStudio } from '@/components/erp/CompetitorsIntelligenceStudio'

const IS_DATA_SOURCE_CONNECTED = false

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ذكاء السوق والمنافسين | فنتشر فودز · AetherBI',
  description: 'مقارنة الأسعار والتقييمات وتغطية المناطق الجغرافية في الكويت.',
}

export default async function MarketIntelligencePage() {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  await requirePageUser('/erp/market')
  return (
    <div className="w-full max-w-[1920px] mx-auto px-3 py-5 sm:px-6 min-w-0">
      <h1 className="sr-only">ذكاء السوق والمنافسين | Market &amp; Competitors Intelligence</h1>
      <CompetitorsIntelligenceStudio />
    </div>
  )
}
