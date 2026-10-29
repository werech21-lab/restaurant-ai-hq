import { Suspense, type ReactNode } from 'react'
import ErpNav from '@/components/erp/ErpNav'
import GovernancePulse from '@/components/erp/GovernancePulse'

export default function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={null}>
        <ErpNav />
      </Suspense>
      <GovernancePulse />
      {children}
    </div>
  )
}
