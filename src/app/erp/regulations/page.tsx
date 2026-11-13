import { requirePageUser } from '@/lib/auth/context'
import { RegulationsComplianceStudio } from '@/components/erp/RegulationsComplianceStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'التشريعات والتراخيص | فنتشر فودز',
  description: 'تشريعات البلدية وهيئة الغذاء والقوى العاملة والتجارة وخطط الامتثال للفروع السبعة ومطبخ العارضية.',
}

export default async function RegulationsCompliancePage() {
  await requirePageUser('/erp/regulations')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <RegulationsComplianceStudio />
    </div>
  )
}
