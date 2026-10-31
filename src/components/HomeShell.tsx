'use client'

import { useState } from 'react'
import type { SectionId } from '@/lib/nav'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { CommandCenterMetrics } from '@/lib/command-center'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import CEORoom from '@/components/CEORoom'
import Intelligence from '@/components/Intelligence'
import Finance from '@/components/Finance'
import Branches from '@/components/Branches'
import Kitchen from '@/components/Kitchen'
import Delivery from '@/components/Delivery'
import Inventory from '@/components/Inventory'
import Quality from '@/components/Quality'
import Recommendations from '@/components/Recommendations'
import Reports from '@/components/Reports'
import Agents from '@/components/Agents'
import Settings from '@/components/Settings'
import Assistant from '@/components/Assistant'
import ErpHub from '@/components/ErpHub'

export default function HomeShell({ metrics, signedIn, devEntry }: { metrics: CommandCenterMetrics; signedIn: boolean; devEntry: boolean }) {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState<SectionId>('ceo')
  const [menuOpen, setMenuOpen] = useState(false)

  function navigate(id: SectionId) {
    setActiveSection(id)
    setMenuOpen(false)
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'ceo':
        return <CEORoom metrics={metrics} />
      case 'intelligence':
        return <Intelligence />
      case 'finance':
        return <Finance />
      case 'branches':
        return <Branches />
      case 'kitchen':
        return <Kitchen metrics={metrics} />
      case 'delivery':
        return <Delivery metrics={metrics} />
      case 'inventory':
        return <Inventory />
      case 'quality':
        return <Quality />
      case 'recommendations':
        return <Recommendations />
      case 'reports':
        return <Reports />
      case 'agents':
        return <Agents />
      case 'settings':
        return <Settings />
      default:
        return <p className="mt-20 text-center text-mist-400">{t('unavailable')}</p>
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-mist-100">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={t(`nav.${activeSection}` as MessageKey)} onNavigate={navigate} onMenu={() => setMenuOpen(true)} />
        <main className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(201,161,90,0.11),transparent_38%),radial-gradient(ellipse_at_0%_100%,rgba(70,86,112,0.08),transparent_42%)]" />
          <div key={activeSection} className="relative mx-auto w-full max-w-6xl animate-fade-up px-3.5 pb-24 pt-5 sm:px-5 sm:pb-28 sm:pt-8 md:px-10 md:pb-28 md:pt-10">
            <p role="note" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {t('cc.banner')}
            </p>
            <ErpHub signedIn={signedIn} devEntry={devEntry} metrics={metrics} />
            {renderSection()}
          </div>
        </main>
      </div>
      <Assistant onOpen={navigate} />
    </div>
  )
}
