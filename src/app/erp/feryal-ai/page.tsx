import { Suspense } from 'react'
import { requirePageUser, resolveServerExecSessionRole } from '@/lib/auth/context'
import { FeryalGovernanceStudio } from '@/components/erp/feryal-governance-studio'
import { StateBlock } from '@/components/ui/state-block'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المستشارة فريال | فنتشر فودز',
  description:
    'الاستوديو التنفيذي الموحد للمستشارة فريال (6 علامات تجارية • 7 فروع • 8 قنوات): دقيق (تحليل دقيق)، سريع (إجابة سريعة)، إرفاق صورة / فيديو، ابتكار الحلول الكبرى 🚀، ذاكرة وتطور فريال 🧠، وأرقام أودو 17 وجرس الاعتماد.',
}

export default async function FeryalAiCommandPage() {
  await requirePageUser('/erp/feryal-ai')
  const sessionRole = await resolveServerExecSessionRole()
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0 overflow-x-hidden pt-0">
      <div className="w-full max-w-full min-w-0 overflow-x-hidden">
        <Suspense
          fallback={
            <StateBlock
              state="loading"
              locale="ar"
              skeletonRows={5}
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
