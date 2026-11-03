import { Suspense, type ReactNode } from 'react'
import CommandPalette from '@/components/erp/CommandPalette'
import GovernancePulse from '@/components/erp/GovernancePulse'
import { Shell } from '@/components/shell'

export const dynamic = 'force-dynamic'

export default async function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
      <Shell>
        <div className="relative">
          <GovernancePulse />
          {children}
          <CommandPalette />
        </div>
      </Shell>
    </Suspense>
  )
}
