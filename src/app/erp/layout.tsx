import { Suspense, type ReactNode } from 'react'
import GovernancePulse from '@/components/erp/GovernancePulse'
import { Shell } from '@/components/shell'

export const dynamic = 'force-dynamic'

/**
 * ERP layout. The Ctrl/⌘+K Executive Command Palette (pages, branches, brands, channels, menu items,
 * Feryal queries and live record search) is mounted once by <Shell />, replacing the legacy
 * CommandPalette + PanelSpotlight pair that both listened to the same shortcut.
 */
export default async function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
      <Shell>
        <div className="relative w-full max-w-none">
          <GovernancePulse />
          {children}
        </div>
      </Shell>
    </Suspense>
  )
}
