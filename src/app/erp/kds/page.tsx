import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/context'
import { getLocale } from '@/lib/i18n/server'
import { VentureKdsHub } from '@/components/kds/VentureKdsHub'
import { StateBlock } from '@/components/ui/state-block'

const IS_DATA_SOURCE_CONNECTED = false

export const metadata = {
  title: 'شاشة تحضير المطبخ الذكية ومراقبة زمن التجهيز | فنتشر فودز · AetherBI',
  description:
    'شاشة تشغيل محطات المطبخ الذكية والخصم اللحظي للمخزون لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

export default async function ErpKdsPage() {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  await requirePageUser('/erp/kds')
  const rawLocale = await getLocale().catch(() => 'ar')
  const locale = rawLocale === 'en' ? 'en' : 'ar'
  const isAr = locale !== 'en'

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="mx-auto w-full max-w-[1920px] min-w-0 space-y-4 overflow-x-hidden px-3 py-4 sm:px-6 [&_a]:min-h-11 [&_button]:min-h-11"
    >
      <div className="ds-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3.5 sm:p-4">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
          {isAr
            ? 'وضع شاشة المطبخ — أهداف لمس كبيرة وتباين عالٍ'
            : 'Kitchen Display Mode — Large Touch Targets & High Contrast'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/erp/kitchen"
            className="ds-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            {isAr ? 'المطبخ المركزي' : 'Central Kitchen'}
          </Link>
          <Link
            href="/erp/prep-sla"
            className="ds-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50 dark:border-white/20 dark:bg-[#141F1B] dark:text-slate-50 dark:hover:bg-white/[0.06]"
          >
            {isAr ? 'التزام زمن التحضير' : 'Order Prep SLA'}
          </Link>
        </div>
      </div>

      <Suspense
        fallback={
          <StateBlock
            state="loading"
            locale={locale}
            title={
              isAr
                ? 'جارٍ تحميل شاشة تحضير المطبخ…'
                : 'Loading Kitchen Display System…'
            }
          />
        }
      >
        <VentureKdsHub locale={locale} />
      </Suspense>
    </div>
  )
}
