'use client'

import { GlobalScopeFilter } from '@/components/GlobalScopeFilter'
import { PanelSpotlight } from '@/components/PanelSpotlight'
import { LanguageSwitch, useI18n } from '@/lib/i18n'

export function PanelHeaderBar({
  companyNameAr,
  notifications,
}: {
  companyNameAr: string
  notifications: React.ReactNode
}) {
  const { locale, companyName } = useI18n()
  const title = locale === 'en' ? companyName : companyNameAr || companyName
  return (
    <div className="relative z-40 mx-auto flex w-full max-w-7xl flex-col gap-2 overflow-visible px-6 py-3 md:px-8">
      {/*
        Put brand title on the sidebar side (inline-start) and tools on the free edge (inline-end)
        so the notification popover never opens into the fixed sidebar.
      */}
      <div className="flex items-center justify-between gap-3 overflow-visible">
        <p className="min-w-0 max-w-[50%] truncate text-sm font-bold text-gold-300" title={title}>
          {title}
        </p>
        <div className="relative z-[60] flex shrink-0 items-center gap-2 overflow-visible sm:gap-3">
          {notifications}
          <PanelSpotlight />
          <LanguageSwitch />
        </div>
      </div>
      <GlobalScopeFilter />
    </div>
  )
}
