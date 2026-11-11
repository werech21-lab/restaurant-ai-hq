import { requirePageUser } from '@/lib/auth/context'
import { CoresHubStudio } from '@/components/aether/CoresHubStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المبيعات والتسويق والمنتجات | فنتشر فودز',
  description:
    'مركز المبيعات والتسويق وحاسبة إعلانات السوشيال والمشاهير وهندسة الأصناف والجودة.',
}

export default async function CoresHubPage() {
  await requirePageUser('/erp/cores')

  return (
    <div className="w-full min-w-0">
      <CoresHubStudio />
    </div>
  )
}
