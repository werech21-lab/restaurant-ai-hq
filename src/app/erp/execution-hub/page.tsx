import { requirePageUser } from '@/lib/auth/context'
import { ExecutionHubV2 } from '@/components/aether/ExecutionHubV2'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'مركز التنفيذ | فنتشر فودز',
  description: 'خطة تنفيذ مقترحات فريال المبنية على بيانات أودو وجدول مواقع المطاعم.',
}

export default async function Page() {
  await requirePageUser('/erp/execution-hub')
  return (
    <div className="w-full">
      <ExecutionHubV2 />
    </div>
  )
}
