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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {notifications}
          <PanelSpotlight />
          <LanguageSwitch />
        </div>
        <p className="max-w-[45%] truncate text-sm font-bold text-gold-300" title={title}>
          {title}
        </p>
      </div>
      <GlobalScopeFilter />
    </div>
  )
}
