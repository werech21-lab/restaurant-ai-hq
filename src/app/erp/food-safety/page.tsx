import { redirect } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/context'
import { getLocale } from '@/lib/i18n/server'
import FoodSafetyHub from '@/modules/food-safety/ui/FoodSafetyHub'

const IS_DATA_SOURCE_CONNECTED = false

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'منظومة سلامة الغذاء ومراقبة درجات التبريد والرقابة الصحية | فنتشر فودز · AetherBI',
  description:
    'الرصد اللحظي لثلاجات وغرف تبريد مواقع المطاعم والمطبخ المركزي، سجلات الفحص اليومي لبلدية الكويت والهيئة العامة للغذاء، وصيانة معدات التبريد.',
}

export default async function FoodSafetyPage() {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  await requirePageUser('/erp/food-safety')
  const rawLocale = await getLocale().catch(() => 'ar')
  const locale = rawLocale === 'en' ? 'en' : 'ar'
  return (
    <div
      className="mx-auto w-full max-w-[1920px] min-w-0 overflow-x-hidden px-4 py-5 sm:px-6"
      suppressHydrationWarning
    >
      <h1 className="sr-only">
        {locale === 'en'
          ? 'Food Safety, Cold-Chain Monitoring & Health Inspection Compliance'
          : 'منظومة سلامة الغذاء ومراقبة درجات التبريد والرقابة الصحية'}
      </h1>
      <FoodSafetyHub locale={locale} />
    </div>
  )
}
