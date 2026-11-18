import { redirect } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/context'
import { DeliveryControlV2 } from '@/components/aether/DeliveryControlV2'

const IS_DATA_SOURCE_CONNECTED = false

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'رقابة منصات التوصيل والتسويات | فنتشر فودز',
  description: 'عمولات وخصومات وصافي تسويات طلبات جو وسوق طلبات وكيتا وديليفرو وجاهز وكاري مطابقة مع أودو.',
}

export default async function Page() {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  await requirePageUser('/erp/delivery-control')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <DeliveryControlV2 />
    </div>
  )
}