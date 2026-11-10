'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { openCommandPalette } from '@/components/aether/BiFilterContext'
import { ROOT_TITLE, routeTitle } from '@/lib/aether/route-titles'
import { LanguageSwitch, useI18n } from '@/lib/i18n'

/** Keeps the browser tab title in the active language (EN → English, عربي → Arabic). */
function useDocumentTitle(pathname: string, isAr: boolean) {
  useEffect(() => {
    const t = routeTitle(pathname)
    const label = t ? `${isAr ? t.ar : t.en} | Aether BI` : 'Aether BI'
    const apply = () => {
      if (document.title !== label) document.title = label
    }
    apply()
    // Next.js metadata and the legacy DOM translator may write the title after navigation; re-assert.
    const timers = [60, 300, 900].map((ms) => window.setTimeout(apply, ms))
    const head = document.querySelector('head')
    const observer = new MutationObserver(() => apply())
    if (head) observer.observe(head, { subtree: true, childList: true, characterData: true })
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      observer.disconnect()
    }
  }, [pathname, isAr])
}

export function PanelHeaderBar({
  companyNameAr: _companyNameAr,
  notifications,
}: {
  companyNameAr: string
  notifications: React.ReactNode
}) {
  const { locale } = useI18n()
  const pathname = usePathname() ?? ''
  const isAr = locale === 'ar'
  const page = routeTitle(pathname)
  useDocumentTitle(pathname, isAr)
  const Sep = isAr ? ChevronLeft : ChevronRight

  return (
    <div className="relative z-40 flex w-full max-w-none items-center justify-between gap-3 overflow-visible px-3 py-2.5 sm:px-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Breadcrumb + live sync status */}
      <nav className="flex min-w-0 items-center gap-2" aria-label={isAr ? 'مسار الصفحة' : 'Breadcrumb'}>
        <Link href="/erp" className="ae-top-link shrink-0 px-2 py-1 text-[13px] font-semibold">
          {isAr ? ROOT_TITLE.ar : ROOT_TITLE.en}
        </Link>
        {page ? (
          <>
            <Sep className="ae-top-sep h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="ae-top-title truncate text-[13px] font-semibold tracking-tight" aria-current="page">
              {isAr ? page.ar : page.en}
            </span>
          </>
        ) : null}
        <span className="ae-top-live ms-1 hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold md:inline-flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: '#34D399' }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: '#10B981' }} />
          </span>
          {isAr ? 'مزامنة أودو مباشرة' : 'Live Odoo Sync'}
        </span>
      </nav>

      {/* Search, notifications, theme, language */}
      <div className="relative z-[60] flex shrink-0 items-center gap-2.5 overflow-visible">
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
