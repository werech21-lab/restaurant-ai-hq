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
    <div className="relative z-40 flex w-full max-w-none items-center justify-between gap-4 overflow-visible px-4 py-3 sm:px-6 md:px-8 bg-white border-b border-gray-200">
      {/* Brand title on the sidebar side */}
      <div className="flex items-center gap-6 min-w-0">
        <p className="truncate text-sm font-bold text-slate-900 tracking-tight" title={title}>
          {title}
        </p>

        {/* Minimalist Editorial Nav Links */}
        <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-600">
          <Link href="/dashboard" className="text-blue-600 font-semibold hover:underline">
            {isAr ? 'لوحة المبيعات والتشغيل' : 'Dashboard'}
          </Link>
          <Link href="/sales" className="hover:text-slate-900">
            {isAr ? 'المبيعات والقنوات' : 'Sales & Channels'}
          </Link>
          <Link href="/inventory" className="hover:text-slate-900">
            {isAr ? 'المخزون والقرين' : 'Inventory & Kitchen'}
          </Link>
          <Link href="/accounting" className="hover:text-slate-900">
            {isAr ? 'المصاريف والعهد' : 'Expenses & Custody'}
          </Link>
          <Link href="/reports" className="hover:text-slate-900">
            {isAr ? 'التقارير الإحصائية' : 'BI Reports'}
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
