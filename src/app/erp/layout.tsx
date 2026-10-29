import type { ReactNode } from 'react'
import ErpNav from '@/components/erp/ErpNav'
import GovernancePulse from '@/components/erp/GovernancePulse'

export default function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <ErpNav />
      <GovernancePulse />
      {children}
    </div>
  )
}
