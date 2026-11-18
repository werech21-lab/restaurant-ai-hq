import { redirect } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/context'
import { getLocale } from '@/lib/i18n/server'
import { RegulationsComplianceStudio } from '@/components/erp/RegulationsComplianceStudio'

const IS_DATA_SOURCE_CONNECTED = false

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'التشريعات والتراخيص | فنتشر فودز',
  description:
    'تشريعات البلدية وهيئة الغذاء والقوى العاملة والتجارة وخطط الامتثال للفروع السبعة ومطبخ العارضية.',
}

export default async function RegulationsCompliancePage() {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  await requirePageUser('/erp/regulations')
  const rawLocale = await getLocale().catch(() => 'ar')
  const locale = rawLocale === 'en' ? 'en' : 'ar'
  return (
    <div className="mx-auto w-full max-w-[1920px] min-w-0 overflow-x-hidden">
      <RegulationsComplianceStudio locale={locale} />
    </div>
  )
}
