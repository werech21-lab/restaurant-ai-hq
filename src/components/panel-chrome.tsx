'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { openCommandPalette } from '@/components/aether/BiFilterContext'
import { LanguageSwitch, useI18n } from '@/lib/i18n'

const TOP_STATIONS = [
  { href: '/erp', ar: 'الملخص', en: 'Summary' },
  { href: '/erp/feryal-ai', ar: 'فريال', en: 'Feryal AI' },
  { href: '/erp/events-intelligence', ar: 'الفعاليات', en: 'Events' },
  { href: '/erp/sales-analysis', ar: 'المبيعات', en: 'Sales' },
  { href: '/erp/delivery-control', ar: 'التوصيل', en: 'Delivery' },
  { href: '/erp/alerts', ar: 'التنبيهات', en: 'Alerts' },
]

export function PanelHeaderBar({
  companyNameAr: _companyNameAr,
  notifications,
}: {
  companyNameAr: string
  notifications: React.ReactNode
}) {
  const { locale } = useI18n()
  const pathname = usePathname()
  const isAr = locale === 'ar'
  const title = isAr ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م' : 'Venture Foods Restaurants Management Co. W.L.L.'

  return (
    <div className="relative z-40 flex w-full max-w-none items-center justify-between gap-3 overflow-visible px-3 py-2.5 sm:px-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Brand title + six stations */}
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <p className="ae-top-title truncate text-[13px] font-semibold tracking-tight" title={title}>
            {title}
          </p>
        </div>
        <nav className="hidden items-center gap-0.5 text-xs font-medium xl:flex" aria-label={isAr ? 'المحطات الرئيسية' : 'Primary stations'}>
          {TOP_STATIONS.map((item) => {
            const active = pathname === item.href || (item.href !== '/erp' && pathname.startsWith(`${item.href}/`))
            return (
              <Link key={item.href} href={item.href} data-active={active} className="ae-top-link px-3 py-1.5">
                {isAr ? item.ar : item.en}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Capsule search + controls */}
      <div className="relative z-[60] flex shrink-0 items-center gap-2 overflow-visible">
        <button
          type="button"
          onClick={openCommandPalette}
          className="ae-capsule hidden items-center gap-2 px-3.5 py-1.5 text-xs sm:inline-flex"
          title={isAr ? 'لوحة الأوامر التنفيذية' : 'Executive command palette (Ctrl+K)'}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{isAr ? 'ابحث أو اسأل فريال…' : 'Search or ask Feryal…'}</span>
          {isAr ? null : <kbd className="rounded-md px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>}
        </button>
        {notifications}
        <ThemeToggle />
        <LanguageSwitch />
      </div>
    </div>
  )
}
