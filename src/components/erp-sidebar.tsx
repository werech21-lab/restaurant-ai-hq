'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  CalendarDays,
  Compass,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LogOut,
  MessageSquareHeart,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Radar,
  Receipt,
  Scale,
  Sparkles,
  Target,
  Timer,
  Truck,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import {
  resolveExecRoleProfile,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import {
  isErpRouteAllowedForRole,
  resolveRoleDefaultHome,
} from '@/lib/auth/role-access-policy'
import { useI18n } from '@/lib/i18n'
import { formatScopeStripAr, formatScopeStripEn, getRegistryScopeCounts } from '@/lib/odoo/scope-counts'
import type { AccessUser } from '@/lib/permissions'
import { can } from '@/lib/permissions'

const RAIL_STORAGE_KEY = 'aetherbi_rail_collapsed_v1'
export const RAIL_TOGGLE_EVENT = 'aetherbi:toggle-rail'

export type SidebarSectionId =
  | 'executive-sales'
  | 'operations-sla'
  | 'finance-accounting'
  | 'competitors-market'
  | 'reputation-vision'
  | 'governance-strategy'

export interface NavItem {
  key: string
  sectionId: SidebarSectionId
  href: string
  aliases?: readonly string[]
  labelAr: string
  labelEn: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  alwaysVisible?: boolean
  enabled?: boolean
}

export interface SidebarSection {
  id: SidebarSectionId
  labelAr: string
  labelEn: string
  items: readonly NavItem[]
}

/** 4 Clean Executive Sections & 13 Unified ERP Routes (AR & EN). */
export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    id: 'executive-sales',
    labelAr: 'القيادة والمبيعات',
    labelEn: 'Executive & Sales',
    items: [
      {
        key: 'playbook',
        sectionId: 'executive-sales',
        href: '/erp',
        labelAr: 'ملخص الشركة',
        labelEn: 'Company Summary',
        icon: LayoutDashboard,
        alwaysVisible: true,
      },
      {
        key: 'cores',
        sectionId: 'executive-sales',
        href: '/erp/cores',
        labelAr: 'المبيعات والتسويق والمينيو',
        labelEn: 'Sales, Marketing & Menu',
        icon: BarChart3,
        alwaysVisible: true,
      },
      {
        key: 'weekday-comparison',
        sectionId: 'executive-sales',
        href: '/erp/weekday-comparison',
        labelAr: 'مقارنة التواريخ والمبيعات',
        labelEn: 'Date & Sales Comparison',
        icon: CalendarDays,
        alwaysVisible: true,
      },
      {
        key: 'before-after',
        sectionId: 'executive-sales',
        href: '/erp/before-after',
        labelAr: 'أثر القرارات (قبل وبعد)',
        labelEn: 'Decision Impact (Before & After)',
        icon: ArrowLeftRight,
        alwaysVisible: true,
      },
    ],
  },
  {
    id: 'operations-sla',
    labelAr: 'التشغيل وسلسلة الإمداد',
    labelEn: 'Operations & SLA',
    items: [
      {
        key: 'warehouse-chain',
        sectionId: 'operations-sla',
        href: '/erp/warehouse-chain',
        labelAr: 'سلسلة المخزن والفروع',
        labelEn: 'Warehouse-to-Branch Chain',
        icon: PackageCheck,
        alwaysVisible: true,
      },
      // Unlinked: requires Odoo 17 POS Preparation Display / KDS station timestamps (pos_preparation_display).
      {
        key: 'prep-sla',
        sectionId: 'operations-sla',
        href: '/erp/prep-sla',
        labelAr: 'زمن تجهيز المطبخ',
        labelEn: 'Kitchen Prep SLA',
        icon: Timer,
        alwaysVisible: true,
        enabled: false,
      },
      // Unlinked: requires Fleet Dispatch GPS / Aggregator Rider Telemetry API (pickup/handoff/dropoff timestamps).
      {
        key: 'delivery-sla',
        sectionId: 'operations-sla',
        href: '/erp/delivery-sla',
        labelAr: 'زمن توصيل السائق',
        labelEn: 'Rider Delivery SLA',
        icon: Truck,
        alwaysVisible: true,
        enabled: false,
      },
      {
        key: 'aggregator-radar',
        sectionId: 'operations-sla',
        href: '/erp/aggregator-radar',
        aliases: ['/erp/commissions'],
        labelAr: 'عمولات منصات التوصيل',
        labelEn: 'Aggregator Commissions',
        icon: Radar,
        alwaysVisible: true,
      },
    ],
  },
  {
    id: 'finance-accounting',
    labelAr: 'المالية والمحاسبة',
    labelEn: 'Finance & Accounting',
    items: [
      {
        key: 'finance',
        sectionId: 'finance-accounting',
        href: '/erp/finance',
        aliases: ['/accounting'],
        labelAr: 'المركز المالي والمحاسبة',
        labelEn: 'Finance & General Ledger',
        icon: Landmark,
        alwaysVisible: true,
      },
      {
        key: 'receivables',
        sectionId: 'finance-accounting',
        href: '/erp/receivables',
        labelAr: 'الذمم المدينة وأعمار الديون',
        labelEn: 'AR & Receivables Aging',
        icon: Receipt,
        alwaysVisible: true,
      },
      {
        key: 'executive-pnl',
        sectionId: 'finance-accounting',
        href: '/erp/executive-pnl',
        labelAr: 'قائمة الدخل وانحراف الموازنة',
        labelEn: 'Executive P&L & Variance',
        icon: FileSpreadsheet,
        alwaysVisible: true,
      },
    ],
  },
  {
    id: 'competitors-market',
    labelAr: 'المنافسون والسوق',
    labelEn: 'Competitors & Market',
    items: [
      // Unlinked: requires verified Kuwait competitor menu pricing, aggregator rank/ETA & ratings feed.
      {
        key: 'competitors',
        sectionId: 'competitors-market',
        href: '/erp/competitors',
        aliases: ['/erp/market'],
        labelAr: 'رادار المنافسين والسوق',
        labelEn: 'Competitors & Market Radar',
        icon: Target,
        alwaysVisible: true,
        enabled: false,
      },
    ],
  },
  {
    id: 'reputation-vision',
    labelAr: 'السمعة والذكاء المرئي',
    labelEn: 'Reputation & Vision AI',
    items: [
      // Unlinked: requires Google Business Profile API + Talabat/Jahez/Deliveroo Customer Reviews API.
      {
        key: 'social-reviews',
        sectionId: 'reputation-vision',
        href: '/erp/social-reviews',
        aliases: ['/erp/reviews'],
        labelAr: 'التقييمات ومنصات التواصل',
        labelEn: 'Social & Aggregator Reviews',
        icon: MessageSquareHeart,
        alwaysVisible: true,
        enabled: false,
      },
      {
        key: 'feryal-ai',
        sectionId: 'reputation-vision',
        href: '/erp/feryal-ai',
        aliases: ['/erp/feryal'],
        labelAr: 'المستشارة فريال (صور وفيديو)',
        labelEn: 'Ask Feryal (Vision & Video)',
        icon: Sparkles,
        alwaysVisible: true,
      },
    ],
  },
  {
    id: 'governance-strategy',
    labelAr: 'الحوكمة والتخطيط',
    labelEn: 'Governance & Strategy',
    items: [
      {
        key: 'planning',
        sectionId: 'governance-strategy',
        href: '/erp/planning',
        labelAr: 'التخطيط والتوقعات',
        labelEn: 'Strategic Planning & Forecast',
        icon: Compass,
        alwaysVisible: true,
      },
      {
        key: 'seasons',
        sectionId: 'governance-strategy',
        href: '/erp/seasons',
        labelAr: 'المواسم والمناسبات',
        labelEn: 'Seasons & Occasions',
        icon: Calendar,
        alwaysVisible: true,
      },
      // Unlinked: requires Odoo 17 Documents / Municipal, PAFN, PAM & Kuwait Fire Force License Registry.
      {
        key: 'regulations',
        sectionId: 'governance-strategy',
        href: '/erp/regulations',
        labelAr: 'التشريعات والتراخيص',
        labelEn: 'Regulations & Licensing',
        icon: Scale,
        alwaysVisible: true,
        enabled: false,
      },
      {
        key: 'booth-feasibility',
        sectionId: 'governance-strategy',
        href: '/erp/booth-feasibility',
        aliases: ['/erp/events-intelligence', '/erp/booth'],
        labelAr: 'حاسبة جدوى المعارض',
        labelEn: 'Booth Feasibility Calculator',
        icon: Calendar,
        alwaysVisible: true,
      },
    ],
  },
]

export const SIDEBAR_ITEMS: NavItem[] = SIDEBAR_SECTIONS.flatMap((section) => [...section.items])

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/erp') {
    return pathname === '/erp'
  }
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true
  }
  if (item.aliases) {
    return item.aliases.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`))
  }
  return false
}

const isItemActive = isNavItemActive

export function Sidebar({
  user,
  isAuditor = false,
  sessionRole,
}: {
  user: AccessUser
  enabledKeys?: string[] | null
  isAuditor?: boolean
  sessionRole?: ExecSessionRole
}) {
  const pathname = usePathname() ?? ''
  const { t, locale } = useI18n()
  const isAr = locale === 'ar'
  const auditorMode = Boolean(
    isAuditor ||
      sessionRole === 'auditor' ||
      user.role.name === 'Read-Only Auditor' ||
      user.email.toLowerCase().includes('auditor'),
  )
  const roleProfile = resolveExecRoleProfile(
    auditorMode ? 'auditor' : (sessionRole ?? 'admin'),
  )

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
    let saved = true
    try {
      const rawSaved = window.localStorage.getItem(RAIL_STORAGE_KEY)
      saved = rawSaved === null ? true : rawSaved === 'true'
    } catch {}
    setCollapsed(saved)
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.railCollapsed = saved ? 'true' : 'false'
    }

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

  const visibleSections = useMemo(
    () =>
      SIDEBAR_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.enabled === false) return false
          if (!isErpRouteAllowedForRole(roleProfile.role, item.href)) return false
          if (user.role.isAdmin) return true
          if (item.alwaysVisible) return true
          return can(user, item.key, 'view')
        }),
      })).filter((section) => section.items.length > 0),
    [roleProfile.role, user],
  )

  const activeKey = useMemo(() => {
    for (const section of visibleSections) {
      for (const item of section.items) {
        if (isItemActive(item, pathname)) {
          return item.key
        }
      }
    }
    return null
  }, [pathname, visibleSections])

  const measureIndicator = useCallback(() => {
    if (!activeKey || !navListRef.current) {
      setIndicator(null)
      return
    }
    const el = linkRefs.current.get(activeKey)
    const container = navListRef.current
    if (!el) {
      setIndicator(null)
      return
    }
    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    setIndicator({
      top: elRect.top - containerRect.top,
      height: elRect.height,
    })
  }, [activeKey])

  useIsomorphicLayoutEffect(() => {
    measureIndicator()
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    const startTs = typeof performance !== 'undefined' ? performance.now() : 0
    const trackDurationMs = prefersReduced ? 0 : 560

    const step = (now: number) => {
      measureIndicator()
      setAnimateIndicator(true)
      if (now - startTs < trackDurationMs) {
        raf = window.requestAnimationFrame(step)
      }
    }

    raf = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(raf)
  }, [measureIndicator, pathname, collapsed, locale])

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
      className={`no-print sticky top-0 z-[41] hidden h-screen shrink-0 flex-col rounded-[28px] bg-[#0D162A] transition-[width,box-shadow] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none lg:flex ${
        collapsed ? 'w-[76px] overflow-visible' : 'w-[272px] overflow-y-auto'
      }`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Brand Header + Tactile Collapse/Expand Trigger */}
      <div
        data-rail-header=""
        className={`shrink-0 transition-[padding] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          collapsed ? 'px-2.5 pt-4 pb-2' : 'px-4 pt-5 pb-3'
        }`}
      >
        <div
          data-rail-header-row=""
          className={`flex items-center ${collapsed ? 'flex-col gap-2.5' : 'justify-between gap-2'}`}
        >
          <Link
            href={resolveRoleDefaultHome(roleProfile.role)}
            className="flex min-w-0 items-center gap-3 rounded-2xl outline-none transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/75"
            aria-label={isAr ? 'العودة إلى ملخص الشركة' : 'Back to Company Summary'}
          >
            <div
              className="ae-side-logo flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 text-sm font-black tracking-wide text-white shadow-md shadow-blue-500/30 ring-1 ring-sky-300/25"
              aria-hidden
            >
              VF
            </div>
            <div data-rail-expanded-only="true" className="ae-rail-clip-label min-w-0">
              <p className="ae-side-strong truncate text-sm font-semibold leading-tight tracking-tight">
                {isAr ? 'فنتشر فودز' : 'Venture Foods'}
              </p>
              <p className="ae-side-muted truncate text-xs font-medium leading-tight">
                {isAr ? 'منصة إيثر' : 'Aether BI'}
              </p>
            </div>
          </Link>

          <div className="group relative shrink-0">
            <button
              type="button"
              onClick={toggleRail}
              aria-label={toggleTitle}
              title={toggleTitle}
              className="ae-side-toggle flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white/[0.06] transition-all duration-150 hover:bg-white/[0.12] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/75"
            >
              <CollapseIcon size={16} />
            </button>
            {collapsed ? (
              <span
                role="tooltip"
                className="pointer-events-none invisible absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-slate-900 opacity-0 shadow-lg ring-1 ring-sky-200/70 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              >
                {isAr ? 'توسيع القائمة (Ctrl+B)' : 'Expand Rail (Ctrl+B)'}
              </span>
            ) : null}
          </div>
        </div>

        {/* Company badge card — smoothly fades in 76px icon rail mode */}
        <div
          data-rail-expanded-only="true"
          aria-hidden={collapsed}
          className={`ae-side-card overflow-hidden rounded-[18px] bg-white/[0.055] text-center leading-relaxed ring-1 ring-slate-400/15 transition-[max-height,opacity,margin,padding] duration-[480ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
            collapsed
              ? 'pointer-events-none mt-0 max-h-0 px-3 py-0 opacity-0'
              : 'mt-3.5 max-h-24 space-y-1 px-3 py-2 opacity-100'
          }`}
        >
          <p className="ae-side-strong text-[13px] font-semibold">
            {isAr ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م' : 'Venture Foods Restaurants Co. W.L.L.'}
          </p>
          <p className="ae-side-muted inline-flex items-center justify-center gap-1.5 text-xs font-semibold">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.65)]" />
            {isAr
              ? formatScopeStripAr(getRegistryScopeCounts(), '·')
              : formatScopeStripEn(getRegistryScopeCounts(), '·')}
          </p>
        </div>
      </div>

      {/* Categorized Executive Navigation Sections with Smooth Sliding Cobalt/Sky Active Pill */}
      <nav
        aria-label={isAr ? 'القائمة الرئيسية' : 'Main Navigation'}
        className={`flex-1 transition-[padding] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          collapsed
            ? 'overflow-visible px-2.5 pt-1 pb-2.5'
            : 'no-scrollbar min-h-0 overflow-y-auto overflow-x-hidden px-3 pt-1.5 pb-5'
        }`}
      >
        <div ref={navListRef} className={`relative ${collapsed ? 'space-y-1' : 'space-y-3.5'}`}>
          {indicator ? (
            <div
              aria-hidden
              style={{
                top: 0,
                height: `${indicator.height}px`,
                transform: `translate3d(0, ${indicator.top}px, 0)`,
                transition: animateIndicator
                  ? 'transform 460ms cubic-bezier(0.16, 1, 0.3, 1), height 280ms cubic-bezier(0.16, 1, 0.3, 1)'
                  : 'none',
              }}
              className="ae-side-pill-indicator pointer-events-none absolute inset-x-0 z-0 rounded-2xl bg-gradient-to-r rtl:bg-gradient-to-l from-blue-600/90 via-blue-500/85 to-sky-500/80 text-white shadow-[0_6px_18px_-4px_rgba(37,99,235,0.5)] ring-1 ring-sky-200/25"
            >
              <span className="absolute inset-y-2 start-1 w-1 rounded-full bg-white/85" />
            </div>
          ) : null}

          {visibleSections.map((section, sectionIndex) => {
            const sectionLabel = isAr ? section.labelAr : section.labelEn
            return (
              <div key={section.id} className="space-y-0.5">
                {collapsed && sectionIndex > 0 ? (
                  <div aria-hidden className="mx-2 my-0.5 h-px bg-white/[0.09]" />
                ) : null}
                <div
                  data-rail-expanded-only="true"
                  className="ae-rail-section-hdr px-3 pb-1 pt-0.5"
                  aria-hidden={collapsed}
                >
                  <span className="ae-side-muted whitespace-nowrap text-xs font-bold uppercase tracking-wider">
                    {sectionLabel}
                  </span>
                </div>

                {section.items.map((item) => {
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
                        className={`ae-side-link relative z-10 flex items-center rounded-2xl text-[13.5px] font-medium transition-[padding,gap,color] duration-[480ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/75 ${
                          active
                            ? 'bg-gradient-to-r rtl:bg-gradient-to-l from-blue-600/90 via-blue-500/85 to-sky-500/80 text-white shadow-sm ring-1 ring-sky-200/20'
                            : ''
                        } ${
                          collapsed ? 'justify-center gap-0 px-0 py-1.5' : 'gap-2.5 px-3 py-2'
                        }`}
                      >
                        <Icon
                          size={18}
                          className="ae-side-icon shrink-0 transition-transform duration-150 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        />
                        <span
                          data-rail-expanded-only="true"
                          className="ae-rail-clip-label text-[13px] leading-snug whitespace-normal"
                        >
                          {label}
                        </span>
                      </Link>

                      {collapsed ? (
                        <span
                          role="tooltip"
                          className="pointer-events-none invisible absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-slate-900 opacity-0 shadow-lg ring-1 ring-sky-200/70 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                        >
                          {label}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </nav>

      {/* User Footer */}
      <div className={`ae-side-divider shrink-0 ${collapsed ? 'px-2.5 py-2.5' : 'px-4 py-3'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="ae-side-chip flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.09] text-xs font-bold ring-1 ring-sky-200/20"
              title={
                auditorMode
                  ? isAr
                    ? 'حساب مراجعة — قراءة فقط'
                    : 'Read-Only Auditor'
                  : isAr
                    ? roleProfile.accountLabelAr
                    : roleProfile.accountLabelEn
              }
            >
              {auditorMode
                ? isAr
                  ? 'م'
                  : 'A'
                : (isAr ? roleProfile.nameAr : roleProfile.nameEn).slice(0, 1)}
            </div>
            <form action={logout} className="group relative">
              <button
                type="submit"
                aria-label={t('nav.logout')}
                className="ae-side-logout flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white/[0.06] transition-all hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/75"
              >
                <LogOut size={14} />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none invisible absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-slate-900 opacity-0 shadow-lg ring-1 ring-sky-200/70 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              >
                {t('nav.logout')}
              </span>
            </form>
          </div>
        ) : (
          <div data-rail-expanded-only="true">
            {auditorMode ? (
              <div className="ae-side-card space-y-1 rounded-[18px] bg-white/[0.055] px-3 py-2 text-start ring-1 ring-slate-400/15">
                <div className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span className="ae-side-strong text-[13px] font-bold leading-snug">
                    {isAr ? roleProfile.accountLabelAr : roleProfile.accountLabelEn}
                  </span>
                </div>
                <p className="ae-side-muted text-xs leading-snug">
                  {isAr ? 'حساب مراجعة — قراءة فقط' : 'Read-Only Auditor'}
                </p>
                {user.email ? (
                  <p
                    dir="ltr"
                    className="ae-side-muted break-all whitespace-normal font-mono text-xs leading-snug"
                  >
                    {user.email}
                  </p>
                ) : null}
              </div>
            ) : (
              <div
                className="ae-side-card space-y-1.5 rounded-[18px] bg-white/[0.055] px-3 py-2.5 text-start ring-1 ring-slate-400/15"
                data-sidebar-role={roleProfile.role}
              >
                <div className="flex items-center gap-2.5">
                  <div className="ae-side-chip flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.09] text-xs font-bold ring-1 ring-sky-200/20">
                    {(isAr ? roleProfile.nameAr : roleProfile.nameEn).slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="ae-side-strong break-words text-xs font-semibold leading-snug">
                      {isAr ? roleProfile.accountLabelAr : roleProfile.accountLabelEn}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-xs font-semibold text-sky-200 ring-1 ring-sky-300/25">
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                      <span>{isAr ? roleProfile.titleAr : roleProfile.titleEn}</span>
                    </span>
                  </div>
                </div>
                {user.email ? (
                  <p
                    dir="ltr"
                    className="ae-side-muted break-all whitespace-normal font-mono text-xs leading-snug"
                  >
                    {user.email}
                  </p>
                ) : null}
              </div>
            )}
            <form action={logout} className="mt-2">
              <button
                type="submit"
                className="ae-side-logout flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold transition-all hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/75"
              >
                <LogOut size={13} />
                <span>{t('nav.logout')}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  )
}
