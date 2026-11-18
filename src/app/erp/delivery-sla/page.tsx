import { redirect } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/context'
import { DeliverySlaStudio } from '@/components/erp/ops-expansion/DeliverySlaStudio'

const IS_DATA_SOURCE_CONNECTED = false

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'زمن توصيل السائق | فنتشر فودز',
  description:
    'مراقبة مدة توصيل الطلبات من لحظة استلام السائق للطلب ولغاية توصيله للزبون بتقييم أخضر جيد وأصفر متوسط وأحمر سيء للغاية.',
}

export default async function DeliverySlaPage() {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  await requirePageUser('/erp/delivery-sla')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0 overflow-x-hidden">
      <DeliverySlaStudio />
    </div>
  )
}
