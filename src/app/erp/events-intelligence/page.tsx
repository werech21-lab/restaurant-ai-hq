import { requirePageUser } from '@/lib/auth/context'
import { BoothStudyV5 } from '@/components/aether/BoothStudyV5'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'حاسبة المعارض | فنتشر فودز',
  description: 'حاسبة المعارض والبوثات لمعرفة الربح والإيجار المناسب قبل التعاقد.',
}

export default async function EventsIntelligencePage() {
  await requirePageUser('/erp/events-intelligence')
  return (
    <div className="w-full">
      <BoothStudyV5 />
    </div>
  )
}
