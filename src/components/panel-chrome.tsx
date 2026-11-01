'use client'

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
    <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {notifications}
        <LanguageSwitch />
      </div>
      <p className="max-w-[50%] truncate text-sm font-bold text-gold-300" title={title}>
        {title}
      </p>
    </div>
  )
}
