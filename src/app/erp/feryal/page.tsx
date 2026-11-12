import { Suspense } from 'react'
import { requirePageUser } from '@/lib/auth/context'
import { FeryalGovernanceStudio } from '@/components/erp/feryal-governance-studio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المستشارة فريال — الذكاء والحوكمة | فنتشر فودز',
  description:
    'استوديو المستشارة فريال المتصل لحظياً بأودو 17 وسجل المخالفات والتخطيط والتشريعات وجرس اعتماد المدير.',
}

export default async function FeryalCentralGovernancePage() {
  await requirePageUser('/erp/feryal')
  return (
    <div className="w-full">
      <Suspense fallback={<div className="h-[600px] w-full animate-pulse rounded-3xl bg-white/60 dark:bg-neutral-900/60" />}>
        <FeryalGovernanceStudio />
      </Suspense>
    </div>
  )
}
