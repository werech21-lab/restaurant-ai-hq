import { Suspense, type ReactNode } from 'react'
import DepartmentTree from '@/components/erp/DepartmentTree'
import ErpNav from '@/components/erp/ErpNav'
import GovernancePulse from '@/components/erp/GovernancePulse'

export default function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950 text-mist-100 md:flex">
      <aside className="w-full border-b border-gold-300/10 bg-ink-900 md:sticky md:top-0 md:h-screen md:w-72 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-e">
        <div className="px-3 py-4">
          <Suspense fallback={null}>
            <DepartmentTree />
          </Suspense>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <Suspense fallback={null}>
          <ErpNav />
        </Suspense>
        <GovernancePulse />
        {children}
      </div>
    </div>
  )
}
