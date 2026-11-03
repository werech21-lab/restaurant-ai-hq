import { Suspense } from 'react'
import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden } from '@/components/erp-ui'
import { isModuleEnabled } from '@/lib/modules-db'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getLocale } from '@/lib/i18n/server'
import { VentureKdsHub } from '@/components/kds/VentureKdsHub'

export const metadata = {
  title: 'شاشة المطبخ والخصم اللحظي KDS | Venture Foods W.L.L. · AetherBI',
  description: 'لوحة محطات المطبخ الذكية، حماية SLA المنصات 15m/20m، والخصم اللحظي لمخزون الوصفات لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}
export const dynamic = 'force-dynamic'

async function KdsContent() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'kds', 'view') && !can(user, 'pos', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  if (!(await isModuleEnabled('kds')) && !(await isModuleEnabled('pos'))) {
    return <div className="p-8 text-center font-bold text-mist-100">شاشة المطبخ معطلة</div>
  }
  return <VentureKdsHub locale={locale === 'en' ? 'en' : 'ar'} />
}

export default function KdsPage() {
  return (
    <Suspense fallback={<div className="p-8 font-bold text-mist-100">جارٍ تحميل شاشة المطبخ الذكية وحماية SLA...</div>}>
      <KdsContent />
    </Suspense>
  )
}
