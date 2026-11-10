import { requirePageUser } from '@/lib/auth/context'
import { BoothStudyV5 } from '@/components/aether/BoothStudyV5'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'جدوى المعارض والبوثات الموسمية | فنتشر فودز',
  description: 'الحكم الاستثماري وأفخاخ العقد ونقطة التعادل اليومية وثلاثة سيناريوهات للربح قبل توقيع عقد المعرض أو البوث الموسمي.',
}

export default async function EventsIntelligencePage() {
  await requirePageUser('/erp/events-intelligence')
  return (
    <div className="w-full">
      <BoothStudyV5 />
    </div>
  )
}
