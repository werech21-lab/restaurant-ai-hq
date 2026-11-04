'use client'

import { PanelSpotlight } from '@/components/PanelSpotlight'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageSwitch, useI18n } from '@/lib/i18n'

export function PanelHeaderBar({
  companyNameAr,
  notifications,
}: {
  companyNameAr: string
  notifications: React.ReactNode
}) {
  const { locale, companyName } = useI18n()
  const title = locale === 'en' ? companyName : 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.'
  return (
    <div className="relative z-40 flex w-full max-w-none items-center justify-between gap-3 overflow-visible px-4 py-3 sm:px-6 md:px-8">
      {/*
        Brand title on the sidebar side (inline-start) and tools on the free edge (inline-end)
        Clean single-row top bar: Company Name, Notifications, Spotlight Search, Theme Toggle, Language Switch.
      */}
      <p className="min-w-0 max-w-[50%] truncate text-sm font-bold text-gold-300" title={title}>
        {title}
      </p>
      <div className="relative z-[60] flex shrink-0 items-center gap-2 overflow-visible sm:gap-3">
        {notifications}
        <PanelSpotlight />
        <ThemeToggle />
        <LanguageSwitch />
      </div>
    </div>
  )
}
