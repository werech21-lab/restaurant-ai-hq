import type { ReactNode } from 'react'
import ErpNav from '@/components/erp/ErpNav'

export default function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <ErpNav />
      {children}
    </div>
  )
}
