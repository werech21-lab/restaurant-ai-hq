import { requirePageUser } from '@/lib/auth/context'
import { CoresHubStudio } from '@/components/aether/CoresHubStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'هندسة المينيو وتسعير الأصناف | فنتشر فودز · AetherBI',
  description: 'مصفوفة ربحية الأصناف ومحاكاة تعديل الأسعار وتكلفة الوصفات.',
}

export default async function MenuEngineeringPage() {
  await requirePageUser('/erp/menu-engineering')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0 overflow-visible">
      <CoresHubStudio initialTab="menu" />
    </div>
  )
}
