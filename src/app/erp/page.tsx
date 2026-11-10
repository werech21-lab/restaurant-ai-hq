import { requirePageUser } from '@/lib/auth/context'
import { ExecutiveHome } from '@/components/aether/ExecutiveHome'
import { kuwaitTodayISO } from '@/lib/enterprise-giants-engine'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'الملخص المالي التنفيذي | فنتشر فودز',
  description: 'الملخص المالي التنفيذي والتوصيات لشركة فنتشر فودز لإدارة المطاعم ذ.م.م — ترخيص رقم 2021/22838.',
}

export default async function ExecutiveCenterPage() {
  await requirePageUser('/erp')

  return (
    <div className="w-full">
      <ExecutiveHome anchor={kuwaitTodayISO()} />
    </div>
  )
}
