import { requirePageUser } from '@/lib/auth/context'
import { CoresHubStudio } from '@/components/aether/CoresHubStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المبيعات والتسويق والمينيو | فنتشر فودز',
  description:
    'مركز المبيعات والقنوات وحاسبة إعلانات المشاهير وهندسة المينيو المباشرة من أودو ١٧.',
}

export default async function CoresHubPage() {
  await requirePageUser('/erp/cores')

  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <CoresHubStudio />
    </div>
  )
}
