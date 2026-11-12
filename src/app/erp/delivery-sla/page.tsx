import { requirePageUser } from '@/lib/auth/context'
import { DeliverySlaStudio } from '@/components/erp/ops-expansion/DeliverySlaStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'مراقبة مدة توصيل الطلبات | فنتشر فودز',
  description:
    'مراقبة مدة توصيل الطلبات من لحظة استلام السائق للطلب ولغاية توصيله للزبون بتقييم أخضر جيد وأصفر متوسط وأحمر سيء للغاية.',
}

export default async function DeliverySlaPage() {
  await requirePageUser('/erp/delivery-sla')
  return (
    <div className="w-full">
      <DeliverySlaStudio />
    </div>
  )
}
