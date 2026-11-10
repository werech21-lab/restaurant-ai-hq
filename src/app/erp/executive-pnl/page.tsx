import { requirePageUser } from '@/lib/auth/context'
import { ExecutivePnlV2 } from '@/components/aether/ExecutivePnlV2'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'قائمة الدخل التنفيذية وانحراف الموازنة | فنتشر فودز',
  description: 'قائمة دخل موحدة جاهزة للمجلس مقابل الموازنة المعتمدة والتوقع المتجدد للربع والنصف والسنة.',
}

export default async function Page() {
  await requirePageUser('/erp/executive-pnl')
  return (
    <div className="w-full">
      <ExecutivePnlV2 />
    </div>
  )
}
