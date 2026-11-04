'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
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
        <p className="truncate text-sm font-extrabold text-white tracking-tight" title={title}>
          {title}
        </p>

        {/* Diyar Style Quick Nav Links with Chevron Down */}
        <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-slate-200">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-[#38BDF8] transition-colors">
            <span>{isAr ? 'لوحة التحكم' : 'Dashboard'}</span>
          </Link>
          <div className="relative group flex items-center gap-1 cursor-pointer hover:text-[#38BDF8] transition-colors">
            <span>{isAr ? 'الخدمات والعمليات' : 'Services & Ops'}</span>
            <ChevronDown size={12} className="opacity-70 group-hover:translate-y-0.5 transition-transform" />
          </div>
          <div className="relative group flex items-center gap-1 cursor-pointer hover:text-[#38BDF8] transition-colors">
            <span>{isAr ? 'المخزون والتشغيل' : 'Supply Chain'}</span>
            <ChevronDown size={12} className="opacity-70 group-hover:translate-y-0.5 transition-transform" />
          </div>
          <Link href="/reports" className="flex items-center gap-1 hover:text-[#38BDF8] transition-colors">
            <span>{isAr ? 'التقارير المالية' : 'Financials'}</span>
          </Link>
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
