'use client'

import React, { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Store,
  Zap,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { useI18n } from '@/lib/i18n'
import type { AccessUser } from '@/lib/permissions'
import { can } from '@/lib/permissions'
import { displayRoleName, displayTeamName } from '@/lib/venture-foods-team'
import { SALES_TABS, parseSalesTab, salesTabHref, type SalesTabId } from '@/lib/analytics/sales-tabs'

interface NavItem {
  key: string
  href: string
  labelAr: string
  labelEn: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** Collapsible sub-menu entries (accordion) */
  children?: { id: SalesTabId; href: string; labelAr: string; labelEn: string }[]
}

interface NavSection {
  id: string
  titleAr: string
  titleEn: string
  items: NavItem[]
}

const SIDEBAR_SECTIONS: NavSection[] = [
  {
    id: 'main',
    titleAr: 'القوائم الرئيسية',
    titleEn: 'Main menu',
    items: [
      { key: 'dashboard', href: '/dashboard', labelAr: 'الملخص المالي والتوصيات', labelEn: 'Financial Summary & Recommendations', icon: LayoutDashboard },
      // permission follows the existing "reports" module so non-admin roles that can see reports can open it
      {
        key: 'reports',
        href: '/erp/sales-scorecard',
        labelAr: 'تحليل المبيعات والأصناف',
        labelEn: 'Sales & items analyses',
        icon: FileText,
        children: SALES_TABS.map((t) => ({ id: t.id, href: salesTabHref(t.id), labelAr: t.ar, labelEn: t.en })),
      },
      { key: 'erp-radar', href: '/erp/aggregator-radar', labelAr: 'متابعة تطبيقات التوصيل', labelEn: 'Delivery Aggregator Control', icon: Store },
      { key: 'automations', href: '/automations', labelAr: 'التنبيهات التلقائية', labelEn: 'Automated Notifications', icon: Zap },
    ],
  },
]

function NavAccordion({ item, isAr }: { item: NavItem; isAr: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const onBase = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const currentTab = parseSalesTab(searchParams.get('tab'))
  const [open, setOpen] = useState(onBase)
  useEffect(() => {
    if (onBase) setOpen(true)
  }, [onBase])
  const Icon = item.icon
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`group flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
          onBase
            ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/80 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <Icon size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
          <span className="text-start">{isAr ? item.labelAr : item.labelEn}</span>
        </span>
        <ChevronDown size={14} className={`shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && item.children && (
        <ul className="ms-4 mt-0.5 space-y-0.5 border-s border-slate-200 dark:border-slate-700 ps-2">
          {item.children.map((c) => {
            const active = onBase && currentTab === c.id
            return (
              <li key={c.id}>
                <Link
                  href={c.href}
                  scroll={false}
                  aria-current={active ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    active ? 'font-bold' : 'font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  style={active ? { backgroundColor: '#2563EB', color: '#FFFFFF' } : undefined}
                >
                  {isAr ? c.labelAr : c.labelEn}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function Sidebar({ user }: { user: AccessUser; enabledKeys?: string[] | null }) {
  const pathname = usePathname()
  const { t, locale } = useI18n()
  const isAr = locale === 'ar'

  return (
    <aside className="app-sidebar fixed inset-y-0 start-0 z-30 hidden w-64 shrink-0 flex-col overflow-hidden border-e border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017] text-slate-800 dark:text-slate-200 md:flex">
      {/* Brand Header */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800/80 px-4 pt-5 pb-4 bg-slate-50/50 dark:bg-[#080b10]">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-black tracking-wide"
            style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
            aria-hidden
          >
            VF
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black leading-tight text-slate-900 dark:text-white">{isAr ? 'فنتشر فودز' : 'Venture Foods'}</p>
            <p className="text-[11px] font-semibold leading-tight text-slate-500 dark:text-slate-400" dir="ltr">
              Venture Foods W.L.L.
            </p>
          </div>
        </div>

        <p className="mt-3 flex items-center text-[13px] font-black leading-snug text-slate-900 dark:text-white">
          <span className="mr-1 ml-2 inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>
          <span>{isAr ? 'نظام الإدارة المالية والتشغيلية' : 'Financial & Operations Management System'}</span>
        </p>

        {/* Company info: three independent centred lines, nothing truncated */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="mt-2.5 space-y-1.5 rounded-xl border border-slate-300/80 bg-[#F1F5F9] px-4 py-3 text-center leading-relaxed shadow-sm dark:border-slate-700/80 dark:bg-slate-800/80"
        >
          <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100" style={{ color: '#0F172A' }}>
            {isAr ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.' : 'Venture Foods Restaurant Management W.L.L.'}
          </p>
          <p>
            <span className="inline-block whitespace-nowrap rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-bold text-[#0F172A]" style={{ color: '#0F172A' }}>
              {isAr ? 'ترخيص رقم: ' : 'Licence No: '}
              <span dir="ltr" className="inline-block tabular-nums">2021/22838</span>
            </span>
          </p>
          <p className="text-xs font-bold text-[#1E3A8A] dark:text-sky-400" style={{ color: '#1E3A8A' }}>
            {isAr ? '6 علامات تجارية · 9 فروع نشطة' : '6 Brands · 9 Active Branches'}
          </p>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 py-3 pb-6">
        {SIDEBAR_SECTIONS.map((section, idx) => {
          const visibleItems = section.items.filter((item) => {
            if (user.role.isAdmin) return true
            return can(user, item.key, 'view')
          })

          if (visibleItems.length === 0) return null

          return (
            <div key={section.id} className={idx > 0 ? 'border-t border-slate-200 dark:border-slate-800/60 pt-3' : ''}>
              <div className="px-3 pb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isAr ? section.titleAr : section.titleEn}
                </span>
              </div>

              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  if (item.children) {
                    return (
                      <Suspense key={item.key} fallback={null}>
                        <NavAccordion item={item} isAr={isAr} />
                      </Suspense>
                    )
                  }
                  const Icon = item.icon
                  const active =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`group flex shrink-0 items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                        active
                          ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-black shadow-sm font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/80 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2.5">
                        <Icon
                          size={16}
                          className={`shrink-0 transition-colors ${
                            active
                              ? 'text-white dark:text-black'
                              : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                          }`}
                        />
                        <span className="truncate">{isAr ? item.labelAr : item.labelEn}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#080b10] px-4 py-3">
        <div className="flex items-center gap-2.5 py-1">
          <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white flex items-center justify-center font-bold text-xs shrink-0 border border-slate-300 dark:border-slate-700">
            {user.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs leading-snug text-slate-900 dark:text-white break-words">{displayTeamName(user.name, locale)}</p>
            <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 break-words">{displayRoleName(user.role.name, locale)}</p>
          </div>
        </div>
        <form action={logout} className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
          >
            <LogOut size={13} />
            <span>{t('nav.logout')}</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
