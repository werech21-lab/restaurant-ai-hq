import { Suspense } from 'react'
import { requirePageUser } from '@/lib/auth/context'
import { FeryalGovernanceStudio } from '@/components/erp/feryal-governance-studio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المستشارة فريال | فنتشر فودز',
  description:
    'الاستوديو التنفيذي الموحد للمستشارة فريال: تحليل استراتيجي معمّق، إجابة تنفيذية سريعة، فحص الصور والفيديو، ابتكار الحلول الكبرى 🚀، ذاكرة وتطور فريال 🧠، وأرقام أودو 17 وجرس الاعتماد.',
}

export default async function FeryalAiCommandPage() {
  await requirePageUser('/erp/feryal-ai')
  return (
    <div className="mx-auto w-full max-w-[1920px] min-w-0 overflow-x-hidden">
      <div className="w-full max-w-full min-w-0 overflow-x-hidden">
        <Suspense
          fallback={
            <div className="min-h-[280px] w-full max-w-full animate-pulse rounded-2xl bg-white/80 dark:bg-[#111A22]/80" />
          }
        >
          <FeryalGovernanceStudio />
        </Suspense>
      </div>
    </div>
  )
}
