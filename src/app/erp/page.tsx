import { requirePageUser } from '@/lib/auth/context'
import { ExecutiveShortcutsV6 } from '@/components/aether/ExecutiveShortcutsV6'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'لوحة المختصرات الذكية | فنتشر فودز',
  description: 'المختصرات التي لا يحسبها أودو، والحلول ومقترحات التطوير لشركة فنتشر فودز لإدارة المطاعم ذ.م.م — ترخيص رقم 2021/22838.',
}

export default async function ExecutiveCenterPage() {
  await requirePageUser('/erp')

  return (
    <div className="w-full">
      <ExecutiveShortcutsV6 />
    </div>
  )
}
