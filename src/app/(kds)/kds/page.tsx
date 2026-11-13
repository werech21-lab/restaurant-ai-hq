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
  const locale = await getLocale().catch(() => 'en')
  return <VentureKdsHub locale={locale === 'ar' ? 'ar' : 'en'} />
}

export default function KdsPage() {
  return (
    <Suspense fallback={<div className="p-8 font-bold text-mist-100">Loading Kitchen Display System...</div>}>
      <KdsContent />
    </Suspense>
  )
}
