import { Suspense } from 'react'
import { requirePageUser } from '@/lib/auth/context'
import { FeryalGovernanceStudio } from '@/components/erp/feryal-governance-studio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'المستشارة فريال (صور وفيديو) | فنتشر فودز',
  description:
    'الاستوديو التنفيذي الموحد للمستشارة فريال لتحليل الصور والفيديو بالذكاء البصري، ابتكار الحلول الكبرى 🚀، ذاكرة وتطور فريال 🧠، وأرقام أودو 17 وجرس الاعتماد.',
}

export default async function FeryalAiCommandPage() {
  await requirePageUser('/erp/feryal-ai')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <Suspense
        fallback={
          <div className="h-[640px] w-full animate-pulse rounded-3xl bg-white/80 dark:bg-[#111A22]/80" />
        }
      >
        <FeryalGovernanceStudio />
      </Suspense>
    </div>
  )
}
