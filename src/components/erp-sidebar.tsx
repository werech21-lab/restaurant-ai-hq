'use client'

import React, { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Radar,
  Sparkles,
  Truck,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { useI18n } from '@/lib/i18n'
import type { AccessUser } from '@/lib/permissions'
import { can } from '@/lib/permissions'
import { displayRoleName, displayTeamName } from '@/lib/venture-foods-team'
import { SALES_TABS, parseSalesTab, salesTabHref } from '@/lib/analytics/sales-tabs'

interface NavChild {
  id: string
  href: string
  labelAr: string
  labelEn: string
}

interface NavItem {
  key: string
  href: string
  labelAr: string
  labelEn: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** Shown to every signed-in user, regardless of module permissions */
  alwaysVisible?: boolean
  /** Collapsible sub-menu entries (accordion) */
  children?: NavChild[]
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
      { key: 'executive', href: '/erp', labelAr: 'الملخص المالي والتوصيات', labelEn: 'Financial Summary & Recommendations', icon: LayoutDashboard, alwaysVisible: true },
      {
        key: 'feryal-ai',
        href: '/erp/feryal-ai',
        labelAr: 'المستشارة الذكية فريال',
        labelEn: 'Feryal AI Executive Copilot',
        icon: Sparkles,
        alwaysVisible: true,
      },
      {
        key: 'events-intelligence',
        href: '/erp/events-intelligence',
        labelAr: 'تحليل الفعاليات والعقود ومنيو المعارض',
        labelEn: 'Events, Contracts & EXB Hub',
        icon: Calendar,
        alwaysVisible: true,
      },
      // visible to every signed-in user who can open the control panel (no per-module permission needed)
      {
        key: 'reports',
        alwaysVisible: true,
        href: '/erp/sales-analysis',
        labelAr: 'تحليل المبيعات والأصناف',
        labelEn: 'Sales & items analysis',
        icon: BarChart3,
        children: [
          { id: 'matrix-v2', href: '/erp/sales-analysis', labelAr: 'مصفوفة هندسة المنيو (364 صنفاً)', labelEn: 'Menu engineering matrix (364 items)' },
          ...SALES_TABS.map((t) => ({ id: t.id, href: salesTabHref(t.id), labelAr: t.ar, labelEn: t.en })),
        ],
      },
      { key: 'delivery-control', href: '/erp/delivery-control', labelAr: 'رقابة منصات التوصيل', labelEn: 'Delivery Aggregators Control', icon: Truck, alwaysVisible: true },
      { key: 'alerts', href: '/erp/alerts', labelAr: 'التنبيهات المالية الآلية', labelEn: 'Automated Financial Alerts', icon: AlertTriangle, alwaysVisible: true },
    ],
  },
  {
    id: 'workspaces',
    titleAr: 'مساحات العمل التفصيلية',
    titleEn: 'Detailed workspaces',
    items: [
      { key: 'dashboard', href: '/dashboard', labelAr: 'التقرير المالي التفصيلي', labelEn: 'Detailed financial report', icon: FileText },
      { key: 'erp-radar', href: '/erp/aggregator-radar', labelAr: 'رادار عمولات التوصيل', labelEn: 'Aggregator commission radar', icon: Radar },
      { key: 'menu-engineering', href: '/erp/menu-engineering', labelAr: 'منصة هندسة المنيو', labelEn: 'Menu engineering workbench', icon: UtensilsCrossed, alwaysVisible: true },
      { key: 'automations', href: '/automations', labelAr: 'قواعد التنبيهات التلقائية', labelEn: 'Automated notification rules', icon: Zap },
    ],
  },
]

function childActive(child: NavChild, pathname: string, currentTab: string) {
  const [path, qs] = child.href.split('?')
  if (!qs) return pathname === path
  const tab = new URLSearchParams(qs).get('tab')
  return pathname === path && tab === currentTab
}

function NavAccordion({ item, isAr }: { item: NavItem; isAr: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = parseSalesTab(searchParams.get('tab'))
  const onBase = (item.children ?? []).some((c) => pathname === c.href.split('?')[0])
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
        data-active={onBase}
        className="ae-side-link group flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium"
      >
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <Icon size={16} className="shrink-0" />
          <span className="text-start leading-snug">{isAr ? item.labelAr : item.labelEn}</span>
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && item.children && (
        <ul className="ae-pop ms-4 mt-1 space-y-0.5 ps-2" style={{ borderInlineStart: '1px solid rgba(255,255,255,0.12)' }}>
          {item.children.map((c) => {
            const active = childActive(c, pathname, currentTab)
            return (
              <li key={c.id}>
                <Link
                  href={c.href}
                  scroll={false}
                  aria-current={active ? 'page' : undefined}
                  data-active={active}
                  className="ae-side-link block rounded-lg px-3 py-1.5 text-[12.5px] font-medium leading-snug"
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
    <aside
      id="ae-sidebar"
      className="no-print fixed inset-y-0 start-0 z-30 hidden w-64 shrink-0 flex-col overflow-hidden md:flex"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Brand Header */}
      <div className="shrink-0 px-4 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="ae-side-logo flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-black tracking-wide shadow-sm" aria-hidden>
            VF
          </div>
          <div className="min-w-0">
            <p className="ae-side-strong text-sm font-semibold leading-tight tracking-tight">{isAr ? 'فنتشر فودز' : 'Venture Foods'}</p>
            <p className="ae-side-muted text-[11px] font-medium leading-tight">{isAr ? 'منصة إيثر للتحليلات' : 'Aether BI · aetherbi.com'}</p>
          </div>
        </div>

        {/* Company info: three independent centred lines, nothing truncated */}
        <div className="ae-side-card mt-4 space-y-1.5 px-3 py-3 text-center leading-relaxed">
          <p className="ae-side-strong text-xs font-semibold">
            {isAr ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م' : 'Venture Foods Restaurants Management Co. W.L.L.'}
          </p>
          <p>
            <span className="ae-side-chip inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
              {isAr ? 'ترخيص رقم: ' : 'Licence No: '}
              <span dir="ltr" className="inline-block tabular-nums">2021/22838</span>
            </span>
          </p>
          <p className="ae-side-muted inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#34D399' }} />
            {isAr ? '6 علامات تجارية · 9 فروع نشطة · 11 قناة' : '6 Brands · 9 Active Branches · 11 Channels'}
          </p>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-1">
        {SIDEBAR_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (user.role.isAdmin) return true
            if (item.alwaysVisible) return true
            return can(user, item.key, 'view')
          })

          if (visibleItems.length === 0) return null

          return (
            <div key={section.id}>
              <div className="px-3 pb-1.5">
                <span className="ae-side-muted text-[10.5px] font-semibold uppercase tracking-wider">{isAr ? section.titleAr : section.titleEn}</span>
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
                  const active = pathname === item.href || (item.href !== '/erp' && item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      data-active={active}
                      aria-current={active ? 'page' : undefined}
                      className="ae-side-link group flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium"
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="leading-snug">{isAr ? item.labelAr : item.labelEn}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2.5 py-1">
          <div className="ae-side-chip flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">{user.name.slice(0, 1)}</div>
          <div className="min-w-0 flex-1">
            <p className="ae-side-strong break-words text-xs font-semibold leading-snug">
              {user.name.includes('الإدارة التنفيذية') || user.name.includes('Executive')
                ? isAr
                  ? 'الإدارة التنفيذية · فنتشر فودز'
                  : 'Executive Management - Venture Foods'
                : displayTeamName(user.name, locale)}
            </p>
            <p className="ae-side-muted break-words text-[11px] leading-snug">{displayRoleName(user.role.name, locale)}</p>
          </div>
        </div>
        <form action={logout} className="mt-2">
          <button type="submit" className="ae-side-logout flex w-full items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all">
            <LogOut size={13} />
            <span>{t('nav.logout')}</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
