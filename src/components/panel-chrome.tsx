'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { openCommandPalette } from '@/components/aether/BiFilterContext'
import { OdooSyncPill } from '@/components/aether/OdooSyncPill'
import { ROOT_TITLE, routeTitle } from '@/lib/aether/route-titles'
import { LanguageSwitch, useI18n } from '@/lib/i18n'

/** Keeps the browser tab <title> strictly in the active language and never allows legacy fallback titles. */
function useDocumentTitle(pathname: string, isAr: boolean) {
  useEffect(() => {
    const t = routeTitle(pathname)
    const label = t
      ? isAr
        ? `${t.ar} | فنتشر فودز · إيثر`
        : `${t.en} | Venture Foods · Aether BI`
      : isAr
        ? 'المركز الشامل للمختصرات وقرارات الرحلة الكاملة | فنتشر فودز'
        : '360° Shortcuts & Journey Playbook | Venture Foods'
    const apply = () => {
      if (document.title !== label) document.title = label
    }
    apply()
    const timers = [60, 280, 850].map((ms) => window.setTimeout(apply, ms))
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
    <div
      className="relative z-40 flex w-full max-w-none items-center justify-between gap-3 overflow-visible px-4 py-2.5 sm:px-5"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Single-row Executive Breadcrumb + Live Odoo 17 Heartbeat */}
      <nav className="flex min-w-0 items-center gap-2" aria-label={isAr ? 'مسار الصفحة' : 'Breadcrumb'}>
        <Link href="/erp" className="ae-top-link shrink-0 px-2.5 py-1 text-[13px] font-semibold">
          {isAr ? ROOT_TITLE.ar : ROOT_TITLE.en}
        </Link>
        {page ? (
          <>
            <Sep className="ae-top-sep h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="ae-top-title truncate text-[13px] font-bold tracking-tight" aria-current="page">
              {isAr ? page.ar : page.en}
            </span>
          </>
        ) : null}
        <OdooSyncPill isAr={isAr} />
      </nav>

      {/* Fast ⌘K Quick Palette, Notifications, Theme & Pure RTL/LTR Language Switch */}
      <div className="relative z-[60] flex shrink-0 items-center gap-2 overflow-visible">
        <button
          type="button"
          onClick={openCommandPalette}
          className="ae-capsule hidden items-center gap-2 px-3.5 py-1.5 text-xs font-semibold sm:inline-flex"
          title={isAr ? 'بحث سريع في القرارات والفروع (⌘K)' : 'Quick jump to decisions & branches (⌘K)'}
        >
          <Search className="h-3.5 w-3.5 opacity-70" />
          <span className="hidden md:inline">
            {isAr ? 'بحث سريع في القرارات والفروع' : 'Quick search decisions & branches'}
          </span>
          <kbd dir="ltr" className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold">
            ⌘K
          </kbd>
        </button>
        {notifications}
        <ThemeToggle />
        <LanguageSwitch />
      </div>
    </div>
  )
}
