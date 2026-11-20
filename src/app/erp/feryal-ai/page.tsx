import { Suspense } from 'react'
import { requirePageUser, resolveServerExecSessionRole } from '@/lib/auth/context'
import { FeryalGovernanceStudio } from '@/components/erp/feryal-governance-studio'
import { StateBlock } from '@/components/ui/state-block'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المستشارة فريال | فنتشر فودز',
  description:
    'مساحة المحادثة التنفيذية للمستشارة فريال: استعلامات Odoo 17 المباشرة، محاكاة جداول الأسعار، والفحص البصري للصور والفيديو.',
}

export default async function FeryalAiCommandPage() {
  await requirePageUser('/erp/feryal-ai')
  const sessionRole = await resolveServerExecSessionRole()
  return (
    <div className="mx-auto w-full max-w-[1920px] min-w-0 overflow-x-clip pt-0">
      <div className="w-full max-w-full min-w-0 overflow-x-clip">
        <Suspense
          fallback={
            <StateBlock
              state="loading"
              locale="ar"
              skeletonRows={4}
              minHeightClass="min-h-[320px]"
            />
          }
        >
          <FeryalGovernanceStudio sessionRole={sessionRole ?? undefined} />
        </Suspense>
      </div>
    </div>
  )
}
