import { requirePageUser } from '@/lib/auth/context'
import { AlertsCenterV2 } from '@/components/aether/AlertsCenterV2'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'مركز التنبيهات المالية والتشغيلية | فنتشر فودز · AetherBI',
  description: 'تنبيهات انحرافات المبيعات والهدر والعمولات الآلية لشركة فنتشر فودز.',
}

export default async function AlertsPage() {
  await requirePageUser('/erp/alerts')
  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 py-5 sm:px-6 min-w-0">
      <AlertsCenterV2 />
    </div>
  )
}
