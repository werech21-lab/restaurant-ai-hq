import { Suspense, type ReactNode } from 'react'
import CommandPalette from '@/components/erp/CommandPalette'
import DepartmentTree from '@/components/erp/DepartmentTree'
import ErpNav from '@/components/erp/ErpNav'
import GovernancePulse from '@/components/erp/GovernancePulse'
import { Shell } from '@/components/shell'
import { getPanelSessionUser } from '@/lib/auth/panel-bridge'

export const dynamic = 'force-dynamic'

export default async function ErpLayout({ children }: { children: ReactNode }) {
  const panelUser = await getPanelSessionUser()

  // Panel session → same Dark Obsidian shell (sidebar + brand/branch filter + header language).
  if (panelUser) {
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

  // Supabase-only ERP session → original department tree (unchanged).
  return (
    <div className="min-h-screen bg-ink-950 text-mist-100 md:flex" suppressHydrationWarning>
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
        <CommandPalette />
      </div>
    </div>
  )
}
