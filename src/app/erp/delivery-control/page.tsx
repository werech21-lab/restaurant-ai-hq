import { requirePageUser } from '@/lib/auth/context'
import { DeliveryControlV2 } from '@/components/aether/DeliveryControlV2'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'رقابة منصات التوصيل والتسويات | فنتشر فودز',
  description: 'عمولات وخصومات وصافي تسويات طلبات جو وسوق طلبات وكيتا وديليفرو وجاهز وكاري مطابقة مع أودو.',
}

export default async function Page() {
  await requirePageUser('/erp/delivery-control')
  return (
    <div className="w-full">
      <DeliveryControlV2 />
    </div>
  )
}