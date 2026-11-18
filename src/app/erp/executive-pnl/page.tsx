import { requirePageUser } from '@/lib/auth/context'
import { ExecutivePnlStudio } from '@/components/erp/ExecutivePnlStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'قائمة الدخل ومطابقة نقاط البيع مع الأستاذ العام | فنتشر فودز · AetherBI',
  description: 'قائمة الدخل التنفيذية ومطابقة مبيعات نقاط البيع مع قيود الأستاذ العام في أودو 17.',
}

export default async function ExecutivePnlPage() {
  await requirePageUser('/erp/executive-pnl')
  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 py-5 sm:px-6 min-w-0">
      <ExecutivePnlStudio />
    </div>
  )
}
