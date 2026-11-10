import { requirePageUser } from '@/lib/auth/context'
import { AlertsCenterV2 } from '@/components/aether/AlertsCenterV2'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'التنبيهات المالية الآلية | فنتشر فودز',
  description: 'مركز قيادة الانحرافات المالية اللحظي مرتباً حسب الأثر الشهري بالدينار الكويتي.',
}

export default async function Page() {
  await requirePageUser('/erp/alerts')
  return (
    <div className="w-full">
      <AlertsCenterV2 />
    </div>
  )
}