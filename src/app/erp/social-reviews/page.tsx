import { redirect } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/context'
import { SocialReviewsStudio } from '@/components/erp/ops-expansion/SocialReviewsStudio'

const IS_DATA_SOURCE_CONNECTED = false

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'التقييمات ومنصات التواصل | فنتشر فودز',
  description:
    'مراقبة كافة مواقع التواصل الاجتماعي وتطبيقات التوصيل مثل طلبات وكيتا وجاهز وديليفرو وكاري وسنونو وخرائط جوجل لكل الفروع والبراندات.',
}

export default async function SocialReviewsPage() {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  await requirePageUser('/erp/social-reviews')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <SocialReviewsStudio />
    </div>
  )
}
