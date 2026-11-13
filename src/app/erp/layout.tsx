import type { Metadata } from 'next'
import { Suspense, type ReactNode } from 'react'
import GovernancePulse from '@/components/erp/GovernancePulse'
import { ErpShell } from '@/components/erp/shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

/**
 * ERP root layout powered by first-class <ErpShell /> (`src/components/erp/shell.tsx`)
 * with full-width fluid viewport (`w-full max-w-[1920px] mx-auto px-5 sm:px-7 xl:px-10`)
 * and unified Ctrl/⌘+K Executive Command Palette.
 */
export default async function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F7F8] dark:bg-[#09110E]" />}>
      <ErpShell>
        <div className="relative w-full max-w-none min-w-0 text-[14.5px]">
          <GovernancePulse />
          {children}
        </div>
      </ErpShell>
    </Suspense>
  )
}
