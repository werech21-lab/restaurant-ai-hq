import { Suspense } from 'react'
import { connection } from 'next/server'
import { getLocale } from '@/lib/i18n/server'
import { VentureKdsHub } from '@/components/kds/VentureKdsHub'

export const metadata = {
  title: 'شاشة المطبخ الذكية ومحطات التحضير KDS | Venture Foods W.L.L. · AetherBI',
  description: 'شاشة تشغيل المطبخ الذكية ومحطات SLA والمطبخ المركزي بالقرين لفنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

async function KdsContent() {
  await connection()
  const locale = await getLocale().catch(() => 'ar')
  return <VentureKdsHub locale={locale === 'en' ? 'en' : 'ar'} />
}

export default function KdsPage() {
  return (
    <Suspense fallback={<div className="p-8 font-bold text-mist-100">جاري تحميل شاشة المطبخ الذكية KDS...</div>}>
      <KdsContent />
    </Suspense>
  )
}
