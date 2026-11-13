import { requirePageUser } from '@/lib/auth/context'
import { SocialReviewsStudio } from '@/components/erp/ops-expansion/SocialReviewsStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'التقييمات ومنصات التواصل | فنتشر فودز',
  description:
    'مراقبة كافة مواقع التواصل الاجتماعي وتطبيقات التوصيل مثل طلبات وكيتا وجاهز وديليفرو وكاري وسنونو وخرائط جوجل لكل الفروع والبراندات.',
}

export default async function SocialReviewsPage() {
  await requirePageUser('/erp/social-reviews')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <SocialReviewsStudio />
    </div>
  )
}
