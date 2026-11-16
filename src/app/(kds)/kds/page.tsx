import { Suspense } from 'react'
import { connection } from 'next/server'
import { getLocale } from '@/lib/i18n/server'
import { VentureKdsHub } from '@/components/kds/VentureKdsHub'

export const metadata = {
  title: 'شاشة تحضير المطبخ الذكية ومراقبة زمن التجهيز | شركة فنتشر فودز ذ.م.م.',
  description: 'شاشة تشغيل محطات المطبخ الذكية، تفادي تأخير الطلبات، والخصم اللحظي للمخزون لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

async function KdsContent() {
  await connection()
  const locale = await getLocale().catch(() => 'ar' as const)
  return <VentureKdsHub locale={locale === 'en' ? 'en' : 'ar'} />
}

export default function KdsPage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-busy="true"
          className="mx-auto max-w-7xl p-6"
        >
          <div className="ds-surface-subtle space-y-3 rounded-2xl p-6">
            <div className="ds-skeleton h-5 w-48 rounded-md" />
            <div className="ds-skeleton h-4 w-full rounded-md" />
            <div className="ds-skeleton h-4 w-3/4 rounded-md" />
            <span className="sr-only">جارٍ تحميل شاشة المطبخ… / Loading Kitchen Display System…</span>
          </div>
        </div>
      }
    >
      <KdsContent />
    </Suspense>
  )
}
