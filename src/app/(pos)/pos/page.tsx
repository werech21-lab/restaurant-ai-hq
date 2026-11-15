import { requireUser } from '@/lib/erp-auth'
import { getLocale } from '@/lib/i18n/server'
import { VenturePosHub } from '@/components/pos/VenturePosHub'

export default async function PosPage() {
  await requireUser()
  const locale = await getLocale()

  return <VenturePosHub locale={locale === 'en' ? 'en' : 'ar'} />
}
