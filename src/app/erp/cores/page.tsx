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
    <div className="max-w-[1520px] w-full mx-auto min-w-0">
      <CoresHubStudio />
    </div>
  )
}
