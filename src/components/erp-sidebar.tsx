'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Radar,
  Sparkles,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { useI18n } from '@/lib/i18n'
import type { AccessUser } from '@/lib/permissions'
import { can } from '@/lib/permissions'
import { displayRoleName, displayTeamName } from '@/lib/venture-foods-team'

const RAIL_STORAGE_KEY = 'aetherbi_rail_collapsed_v1'
export const RAIL_TOGGLE_EVENT = 'aetherbi:toggle-rail'

interface NavItem {
  key: string
  href: string
  labelAr: string
  labelEn: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  alwaysVisible?: boolean
}

/** The 6 ultra-simple executive pillars of Aether BI. */
const SIDEBAR_ITEMS: NavItem[] = [
  { key: 'playbook', href: '/erp', labelAr: 'الرئيسية', labelEn: 'Overview', icon: LayoutDashboard, alwaysVisible: true },
  { key: 'cores', href: '/erp/cores', labelAr: 'المبيعات والتسويق والمنتجات', labelEn: 'Sales, Marketing & Menu', icon: BarChart3, alwaysVisible: true },
  { key: 'before-after', href: '/erp/before-after', labelAr: 'مقارنة قبل وبعد', labelEn: 'Before & After', icon: ArrowLeftRight, alwaysVisible: true },
  { key: 'feryal-ai', href: '/erp/feryal-ai', labelAr: 'المستشارة فريال', labelEn: 'Ask Feryal', icon: Sparkles, alwaysVisible: true },
  { key: 'aggregator-radar', href: '/erp/aggregator-radar', labelAr: 'مراقبة التوصيل', labelEn: 'Delivery Radar', icon: Radar, alwaysVisible: true },
  { key: 'events-intelligence', href: '/erp/events-intelligence', labelAr: 'حاسبة المعارض', labelEn: 'Booth Calculator', icon: Calendar, alwaysVisible: true },
]

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function Sidebar({ user }: { user: AccessUser; enabledKeys?: string[] | null }) {
  const pathname = usePathname()
  const { t, locale } = useI18n()
  const isAr = locale === 'ar'

  const [collapsed, setCollapsed] = useState(false)
  const navListRef = useRef<HTMLDivElement>(null)
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map())
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null)
  const [animateIndicator, setAnimateIndicator] = useState(false)

  const syncDomCollapsed = useCallback((next: boolean) => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.railCollapsed = next ? 'true' : 'false'
    }
    try {
      window.localStorage.setItem(RAIL_STORAGE_KEY, next ? 'true' : 'false')
    } catch {}
  }, [])

  const toggleRail = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      syncDomCollapsed(next)
      return next
    })
  }, [syncDomCollapsed])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RAIL_STORAGE_KEY) === 'true'
      setCollapsed(saved)
      document.documentElement.dataset.railCollapsed = saved ? 'true' : 'false'
    } catch {}

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) {
          return
        }
        e.preventDefault()
        toggleRail()
      }
    }
    const onCustomToggle = () => toggleRail()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(RAIL_TOGGLE_EVENT, onCustomToggle)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(RAIL_TOGGLE_EVENT, onCustomToggle)
    }
  }, [toggleRail])

  const visibleItems = SIDEBAR_ITEMS.filter((item) => {
    if (user.role.isAdmin) return true
    if (item.alwaysVisible) return true
    return can(user, item.key, 'view')
  })

  const activeKey =
    visibleItems.find(
      (item) =>
        pathname === item.href ||
        (item.href !== '/erp' && item.href !== '/dashboard' && pathname?.startsWith(`${item.href}/`)),
    )?.key ?? null

  const measureIndicator = useCallback(() => {
    if (!activeKey) {
      setIndicator(null)
      return
    }
    const el = linkRefs.current.get(activeKey)
    if (!el) return
    setIndicator({ top: el.offsetTop, height: el.offsetHeight })
  }, [activeKey])

  useIsomorphicLayoutEffect(() => {
    measureIndicator()
    const raf = window.requestAnimationFrame(() => {
      measureIndicator()
      setAnimateIndicator(true)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [measureIndicator, collapsed, locale])

  const CollapseIcon = isAr
    ? collapsed
      ? PanelRightOpen
      : PanelRightClose
    : collapsed
      ? PanelLeftOpen
      : PanelLeftClose

  const toggleTitle = collapsed
    ? isAr
      ? 'توسيع القائمة الجانبية (Ctrl+B)'
      : 'Expand sidebar rail (Ctrl+B)'
    : isAr
      ? 'طي القائمة لتوسيع الشاشة (Ctrl+B)'
      : 'Collapse sidebar rail (Ctrl+B)'

  return (
    <aside
      id="ae-sidebar"
      data-collapsed={collapsed}
      className={`no-print fixed inset-y-0 start-0 z-30 hidden shrink-0 flex-col md:flex ${
        collapsed ? 'overflow-visible' : 'overflow-hidden'
      }`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Brand Header + Skerry Tactile Collapse/Expand Trigger */}
      <div className={`shrink-0 pt-5 pb-3 ${collapsed ? 'px-2.5' : 'px-4'}`}>
        <div className={`flex items-center ${collapsed ? 'flex-col gap-2.5' : 'justify-between gap-2'}`}>
          <Link
            href="/erp"
            className="flex min-w-0 items-center gap-3 rounded-2xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            aria-label={isAr ? 'العودة إلى الرئيسية' : 'Back to Overview'}
          >
            <div
              className="ae-side-logo flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black tracking-wide"
              aria-hidden
            >
              VF
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="ae-side-strong truncate text-sm font-bold leading-tight tracking-tight">
                  {isAr ? 'فنتشر فودز' : 'Venture Foods'}
                </p>
                <p className="ae-side-muted truncate text-[11px] font-medium leading-tight">
                  {isAr ? 'منصة إيثر' : 'Aether BI'}
                </p>
              </div>
            ) : null}
          </Link>

          <div className="group relative shrink-0">
            <button
              type="button"
              onClick={toggleRail}
              aria-label={toggleTitle}
              title={toggleTitle}
              className="ae-side-toggle flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl transition-all duration-150 active:scale-95"
            >
              <CollapseIcon size={16} />
            </button>
            {collapsed ? (
              <span
                role="tooltip"
                className="pointer-events-none invisible absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-slate-950 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100"
              >
                {isAr ? 'توسيع القائمة (Ctrl+B)' : 'Expand Rail (Ctrl+B)'}
              </span>
            ) : null}
          </div>
        </div>

        {/* Company badge card — cleanly hidden in 76px icon rail mode */}
        {!collapsed ? (
          <div className="ae-side-card mt-4 space-y-1.5 px-3 py-2.5 text-center leading-relaxed">
            <p className="ae-side-strong text-[11.5px] font-semibold">
              {isAr ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م' : 'Venture Foods Restaurants Co. W.L.L.'}
            </p>
            <p className="ae-side-muted inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {isAr ? '6 مطاعم · 7 فروع · 8 قنوات' : '6 Brands · 7 Branches · 8 Channels'}
            </p>
          </div>
        ) : null}
      </div>

      {/* Navigation Sections with Verdelo Sliding Emerald Active Pill */}
      <nav
        aria-label={isAr ? 'القائمة الرئيسية' : 'Main Navigation'}
        className={`min-h-0 flex-1 pt-2 pb-6 ${
          collapsed ? 'overflow-visible px-2.5' : 'overflow-y-auto px-3'
        }`}
      >
        {!collapsed ? (
          <div className="px-3 pb-2">
            <span className="ae-side-muted text-[10.5px] font-bold uppercase tracking-wider">
              {isAr ? 'القائمة' : 'Menu'}
            </span>
          </div>
        ) : null}

        <div ref={navListRef} className="relative space-y-1">
          {indicator ? (
            <div
              aria-hidden
              style={{
                top: 0,
                height: `${indicator.height}px`,
                transform: `translate3d(0, ${indicator.top}px, 0)`,
                transition: animateIndicator
                  ? 'transform 200ms cubic-bezier(0.22, 1.18, 0.36, 1), height 180ms ease'
                  : 'none',
              }}
              className="ae-side-pill-indicator pointer-events-none absolute inset-x-0 z-0 rounded-2xl"
            >
              <span className="absolute inset-y-2.5 start-1 w-1 rounded-full bg-[#10B981]" />
            </div>
          ) : null}

          {visibleItems.map((item) => {
            const Icon = item.icon
            const active = item.key === activeKey
            const label = isAr ? item.labelAr : item.labelEn

            return (
              <div key={item.key} className="group relative">
                <Link
                  ref={(el) => {
                    if (el) linkRefs.current.set(item.key, el)
                    else linkRefs.current.delete(item.key)
                  }}
                  href={item.href}
                  data-active={active}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={`ae-side-link relative z-10 flex items-center rounded-2xl py-2.5 text-[13px] font-medium ${
                    collapsed ? 'justify-center px-0' : 'gap-3 px-3.5'
                  }`}
                >
                  <Icon size={18} className="ae-side-icon shrink-0" />
                  {!collapsed ? <span className="leading-snug">{label}</span> : null}
                </Link>

                {collapsed ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none invisible absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-slate-950 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100"
                  >
                    {label}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </nav>

      {/* User Footer */}
      <div className={`ae-side-divider shrink-0 py-3 ${collapsed ? 'px-2.5' : 'px-4'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="ae-side-chip flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
              title={displayTeamName(user.name, locale)}
            >
              {user.name.slice(0, 1)}
            </div>
            <form action={logout} className="group relative">
              <button
                type="submit"
                aria-label={t('nav.logout')}
                className="ae-side-logout flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl transition-all"
              >
                <LogOut size={14} />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none invisible absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-slate-950 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100"
              >
                {t('nav.logout')}
              </span>
            </form>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 py-1">
              <div className="ae-side-chip flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {user.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="ae-side-strong break-words text-xs font-semibold leading-snug">
                  {user.name.includes('الإدارة التنفيذية') || user.name.includes('Executive')
                    ? isAr
                      ? 'الإدارة التنفيذية · فنتشر فودز'
                      : 'Executive Management - Venture Foods'
                    : displayTeamName(user.name, locale)}
                </p>
                <p className="ae-side-muted break-words text-[11px] leading-snug">
                  {displayRoleName(user.role.name, locale)}
                </p>
              </div>
            </div>
            <form action={logout} className="mt-2">
              <button
                type="submit"
                className="ae-side-logout flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              >
                <LogOut size={13} />
                <span>{t('nav.logout')}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </aside>
  )
}
