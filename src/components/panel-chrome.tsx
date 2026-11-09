'use client'

import React from 'react'
import Link from 'next/link'
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
  const isAr = locale === 'ar'
  const title = locale === 'en' ? companyName : 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.'

  return (
    <div className="relative z-40 flex w-full max-w-none items-center justify-between gap-4 overflow-visible px-4 py-2.5 sm:px-6 md:px-8">
      {/* Brand title on the sidebar side */}
      <div className="flex items-center gap-6 min-w-0">
        <p className="truncate text-sm font-extrabold !text-white tracking-tight" title={title} style={{ color: '#FFFFFF' }}>
          {title}
        </p>

        {/* Five stations including Feryal AI */}
        <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold !text-slate-200">
          {[
            { href: '/dashboard', ar: 'الملخص والتوصيات', en: 'Summary' },
            { href: '/erp/feryal-ai', ar: 'المستشارة فريال ✨', en: 'Feryal AI ✨' },
            { href: '/erp/sales-scorecard', ar: 'تحليل المبيعات', en: 'Sales analysis' },
            { href: '/erp/aggregator-radar', ar: 'تطبيقات التوصيل', en: 'Delivery apps' },
            { href: '/automations', ar: 'التنبيهات', en: 'Alerts' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-1 hover:!text-[#38BDF8] transition-colors" style={{ color: '#E2E8F0' }}>
              <span>{isAr ? item.ar : item.en}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Right controls */}
      <div className="relative z-[60] flex shrink-0 items-center gap-2 overflow-visible sm:gap-3">
        {notifications}
        <PanelSpotlight />
        <ThemeToggle />
        <LanguageSwitch />
      </div>
    </div>
  )
}
