import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/context'
import { getLocale } from '@/lib/i18n/server'
import { VentureRecipesHub } from '@/components/recipes/VentureRecipesHub'
import { StateBlock } from '@/components/ui/state-block'

const IS_DATA_SOURCE_CONNECTED = false

export const metadata = {
  title: 'الوصفات وهندسة تكلفة الغذاء المعيارية | فنتشر فودز · AetherBI',
  description: 'محاسبة تكاليف الوصفات وهندسة المنيو لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

export default async function ErpRecipesPage() {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  await requirePageUser('/erp/recipes')
  const rawLocale = await getLocale().catch(() => 'ar')
  const locale = rawLocale === 'en' ? 'en' : 'ar'

  return (
    <div className="mx-auto w-full max-w-[1920px] min-w-0 overflow-x-hidden px-4 py-5 sm:px-6">
      <Suspense
        fallback={
          <StateBlock
            state="loading"
            locale={locale}
            title={locale === 'en' ? 'Loading recipes…' : 'جارٍ تحميل الوصفات…'}
          />
        }
      >
        <VentureRecipesHub locale={locale} />
      </Suspense>
    </div>
  )
}
