import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/erp-auth'
import { PageSkeleton } from '@/components/erp-ui'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getLocale } from '@/lib/i18n/server'
import { OrdableDashboardHub } from '@/components/dashboard/OrdableDashboardHub'

export const metadata = {
  title: 'لوحة القيادة والمبيعات التنفيذية | فنتشر فودز · AetherBI',
  description: 'لوحة القيادة التنفيذية الذكية بأسلوب Ordable لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}
export const dynamic = 'force-dynamic'

async function DashboardContent() {
  await connection()
  const user = await requireUser()
  if (!can(user, 'dashboard', 'view')) redirect(firstAllowedHref(user))

  const locale = await getLocale()
  return <OrdableDashboardHub locale={locale === 'en' ? 'en' : 'ar'} />
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Dashboard" />}>
      <DashboardContent />
    </Suspense>
  )
}
