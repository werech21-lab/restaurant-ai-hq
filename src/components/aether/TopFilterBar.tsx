'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Check,
  ChevronDown,
  Globe,
  Lock,
  LogOut,
  PanelLeft,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Unlock,
  X,
} from 'lucide-react'
import { useI18n, type Locale } from '@/lib/i18n'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PanelHeaderBar } from '@/components/panel-chrome'
import { openCommandPalette } from '@/components/aether/BiFilterContext'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { BRAIN_BAR_ROUTES } from '@/components/aether/TopBrainSwitcher'
import {
  GovernanceBellTrigger,
  OPEN_GOV_DRAWER_EVENT,
  useOptionalGovernance,
} from '@/components/erp/GovernanceBellDrawer'
import { RAIL_TOGGLE_EVENT } from '@/components/erp-sidebar'
import { routeTitle } from '@/lib/aether/route-titles'
import {
  GLOBAL_KUWAIT_SLICE_OPTIONS,
  GLOBAL_PERIOD_OPTIONS,
  GLOBAL_PROFIT_LENS_OPTIONS,
  type FilterOption,
  type GlobalPeriod,
} from '@/lib/aether/global-filter-engine'

export const ERP_SUBTAB_EVENT = 'aether:erp-subtab'
export type ErpOverviewSubtab = 'summary' | 'plays'

/** Routes that display the 5D POS & ledger filters (Period incl. Custom + Unified Filters Popover). */
export const POS_FILTER_ROUTES = new Set([
  '/erp',
  '/erp/cores',
  '/erp/weekday-comparison',
  '/erp/before-after',
  '/erp/warehouse-chain',
  '/erp/prep-sla',
  '/erp/delivery-sla',
  '/erp/aggregator-radar',
  '/erp/social-reviews',
  '/erp/feryal-ai',
  '/erp/feryal',
  '/erp/planning',
  '/erp/regulations',
  '/erp/booth-feasibility',
  '/erp/events-intelligence',
])

function toWesternNumerals(input: string): string {
  return input.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
}

/** Keeps the browser tab <title> synced with the active language and page route. */
function useDocumentTitle(pathname: string, isAr: boolean, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const t = routeTitle(pathname)
    const label = t
      ? isAr
        ? `${t.ar} | فنتشر فودز · إيثر`
        : `${t.en} | Venture Foods · Aether BI`
      : isAr
        ? 'ملخص الشركة | فنتشر فودز'
        : 'Company Summary | Venture Foods'
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
  }, [pathname, isAr, enabled])
}

function formatPinCountdown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function cleanPeriodOptionLabel(periodId: GlobalPeriod, rawLabel: string, isAr: boolean): string {
  if (periodId === 'custom') return isAr ? 'مخصص' : 'Custom'
  return toWesternNumerals(rawLabel)
}

function EmeraldPillTabs<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (next: T) => void
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-2xl bg-neutral-100/90 p-1 ring-1 ring-slate-900/[0.04] select-none dark:bg-white/[0.06] dark:ring-emerald-500/10"
    >
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-all duration-[160ms] focus:outline-none ${
              active
                ? 'btn-colored bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white'
            }`}
          >
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function FilterChipGroup<T extends string>({
  label,
  value,
  options,
  isAr,
  showHealthMeta = false,
  twoColGrid = false,
  onChange,
}: {
  label: string
  value: T
  options: readonly FilterOption<T>[]
  isAr: boolean
  showHealthMeta?: boolean
  twoColGrid?: boolean
  onChange: (next: T) => void
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11.5px] font-bold text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={
          twoColGrid
            ? 'grid grid-cols-1 gap-1.5 sm:grid-cols-2'
            : 'flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:flex-wrap sm:overflow-visible'
        }
      >
        {options.map((opt) => {
          const active = opt.id === value
          const textLabel = toWesternNumerals(isAr ? opt.ar : opt.en)
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`inline-flex shrink-0 cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-[12.5px] leading-snug whitespace-nowrap sm:whitespace-normal transition-all duration-[160ms] ${
                active
                  ? 'btn-colored bg-emerald-600 font-semibold text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                  : 'bg-neutral-100/90 font-medium text-slate-700 hover:bg-neutral-200/70 hover:text-slate-950 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.10]'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {showHealthMeta && opt.healthDot ? (
                  <span className="shrink-0 text-[10.5px] leading-none" aria-hidden>
                    {opt.healthDot}
                  </span>
                ) : null}
                <span>{textLabel}</span>
              </span>

              {showHealthMeta && typeof opt.weightedNetPct === 'number' ? (
                <span
                  dir="ltr"
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    active
                      ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-[#04130D]'
                      : 'bg-white text-slate-600 dark:bg-white/10 dark:text-slate-300'
                  }`}
                >
                  {opt.weightedNetPct.toFixed(1)}%
                </span>
              ) : active ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AccountWorkspaceMenuPanel({
  isAr,
  locale,
  auditorMode,
  userEmail,
  onSetLocale,
  sharedCopied,
  onShareWhatsApp,
  onOpenCommandSearch,
  onSignOut,
  signingOut,
  onCloseMenu,
}: {
  isAr: boolean
  locale: Locale
  auditorMode: boolean
  userEmail?: string
  onSetLocale: (next: Locale) => void
  sharedCopied: boolean
  onShareWhatsApp: () => void
  onOpenCommandSearch: () => void
  onSignOut: () => void
  signingOut: boolean
  onCloseMenu: () => void
}) {
  const gov = useOptionalGovernance()
  const badgeCount = gov?.liveBadgeCount ?? 0
  const hasBreaches = (gov?.activeBreaches.length ?? 0) > 0

  const handleOpenNotifications = () => {
    onCloseMenu()
    if (gov) {
      gov.openDrawer('all')
    } else {
      window.dispatchEvent(new CustomEvent(OPEN_GOV_DRAWER_EVENT, { detail: 'all' }))
    }
  }

  return (
    <div
      role="menu"
      aria-label={isAr ? 'القائمة والحساب' : 'Account & Menu'}
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-[min(92vw,330px)] space-y-2 rounded-2xl bg-white p-3.5 text-slate-800 shadow-[0_20px_50px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/[0.07] dark:bg-[#101C17] dark:text-slate-100 dark:ring-emerald-500/20"
    >
      {/* Account Identity Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5 dark:border-white/[0.08]">
        <div className="min-w-0">
          {auditorMode ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-bold text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-200">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>{isAr ? 'حساب مراجعة — قراءة فقط' : 'Read-Only Auditor'}</span>
            </span>
          ) : (
            <div className="text-[12.5px] font-bold text-slate-900 dark:text-white">
              {isAr ? 'الإدارة التنفيذية • فنتشر فودز' : 'Executive Office • Venture Foods'}
            </div>
          )}
          <div
            dir="ltr"
            className="mt-0.5 truncate font-mono text-[11px] text-slate-400 dark:text-slate-400"
          >
            {userEmail ||
              (auditorMode ? 'auditor@venturefoodskw.com' : 'admin@venturefoodskw.com')}
          </div>
        </div>
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            auditorMode
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
        </span>
      </div>

      {/* 1. Notifications & Approvals (`الإشعارات والاعتمادات 🔔`) — displays pending count ONCE */}
      <button
        type="button"
        onClick={handleOpenNotifications}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl bg-[#F6F7F8] px-3 py-2.5 text-start text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-emerald-50/70 dark:bg-[#09110E] dark:text-slate-100 dark:hover:bg-emerald-950/40"
      >
        <span className="inline-flex items-center gap-2">
          <Bell
            className={`h-4 w-4 shrink-0 ${
              hasBreaches
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          />
          <span>
            {isAr ? 'الإشعارات والاعتمادات 🔔' : 'Notifications & Approvals 🔔'}
          </span>
        </span>
        <span
          dir="ltr"
          style={badgeCount > 0 ? { color: '#FFFFFF' } : undefined}
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-lg px-1.5 text-[11px] font-bold tabular-nums ${
            badgeCount > 0
              ? hasBreaches
                ? 'btn-colored bg-rose-600 text-white'
                : 'btn-colored bg-emerald-600 text-white'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}
        >
          {badgeCount}
        </span>
      </button>

      {/* 2. Role / Manager PIN Control (Executive PIN unlock vs Auditor Read-Only badge) */}
      {auditorMode ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/75 px-3 py-2.5 ring-1 ring-amber-500/20 dark:bg-amber-950/35 dark:ring-amber-400/20">
          <div className="inline-flex items-center gap-1.5 text-[12px] font-bold text-amber-900 dark:text-amber-200">
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{isAr ? 'حساب مراجعة — قراءة فقط' : 'Read-Only Auditor'}</span>
          </div>
          <span className="rounded-lg bg-white/80 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:bg-white/10 dark:text-amber-200">
            {isAr ? 'مقفل' : 'Disabled'}
          </span>
        </div>
      ) : gov ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-[#F6F7F8] px-3 py-2.5 dark:bg-[#09110E]">
          {gov.session.active ? (
            <>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-700 dark:text-emerald-300">
                  <Unlock className="h-3.5 w-3.5 shrink-0" />
                  <span>{isAr ? 'صلاحية المدير نشطة' : 'Manager Session Active'}</span>
                </div>
                <div
                  dir="ltr"
                  className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400"
                >
                  {formatPinCountdown(gov.session.remainingSeconds)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  gov.lockSession()
                  onCloseMenu()
                }}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-white px-2.5 text-[11.5px] font-semibold text-rose-700 ring-1 ring-rose-500/20 transition-colors hover:bg-rose-50 dark:bg-[#101C17] dark:text-rose-300"
              >
                <Lock className="h-3 w-3" />
                <span>{isAr ? 'قفل' : 'Lock'}</span>
              </button>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{isAr ? 'صلاحية المدير' : 'Manager PIN'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onCloseMenu()
                  gov.requireManagerPin({
                    titleAr: 'تفعيل وضع المدير لمدة 15 دقيقة',
                    titleEn: 'Unlock 15-Minute Manager Session',
                  })
                }}
                className="btn-colored inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-emerald-600 px-3 text-[11.5px] font-bold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
              >
                <Unlock className="h-3 w-3" />
                <span>{isAr ? 'تفعيل' : 'Unlock'}</span>
              </button>
            </>
          )}
        </div>
      ) : null}

      {/* 3. Theme Switcher (`الوضع النهاري / الليلي`) */}
      <div className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5">
        <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
          {isAr ? 'الوضع النهاري / الليلي' : 'Light / Dark Theme'}
        </span>
        <ThemeToggle />
      </div>

      {/* 4. Language Toggle (`العربية / English`) */}
      <div className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
          <Globe className="h-3.5 w-3.5 text-slate-400" />
          <span>{isAr ? 'اللغة' : 'Language'}</span>
        </span>
        <div
          dir="ltr"
          data-no-translate=""
          className="inline-flex items-center gap-1 rounded-xl bg-neutral-100/90 p-1 dark:bg-white/[0.06]"
        >
          <button
            type="button"
            onClick={() => onSetLocale('ar')}
            className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
              locale === 'ar'
                ? 'btn-colored bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            العربية
          </button>
          <button
            type="button"
            onClick={() => onSetLocale('en')}
            className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
              locale === 'en'
                ? 'btn-colored bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200/70 pt-1.5 dark:border-white/[0.08]">
        {/* 5. WhatsApp Executive Summary Share (`مشاركة التقرير عبر واتساب`) */}
        <button
          type="button"
          onClick={onShareWhatsApp}
          title={isAr ? 'مشاركة التقرير عبر واتساب' : 'Share Report via WhatsApp'}
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-[12.5px] font-medium text-slate-700 transition-colors hover:bg-[#F6F7F8] hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/[0.06]"
        >
          <span className="inline-flex items-center gap-2">
            {sharedCopied ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Share2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>
              {sharedCopied
                ? isAr
                  ? 'تم نسخ الملخص للواتساب ✅'
                  : 'Summary Copied for WhatsApp ✅'
                : isAr
                  ? 'مشاركة التقرير عبر واتساب'
                  : 'Share Report via WhatsApp'}
            </span>
          </span>
        </button>

        {/* 6. Quick Command Search (`البحث السريع ⌘K`) */}
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-[12.5px] font-medium text-slate-700 transition-colors hover:bg-[#F6F7F8] hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/[0.06]"
        >
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
            <span>{isAr ? 'البحث السريع' : 'Quick Search'}</span>
          </span>
          <kbd
            dir="ltr"
            className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300"
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {/* 7. Real Sign Out (`تسجيل الخروج` / `Sign Out`) */}
      <div className="border-t border-slate-200/70 pt-1.5 dark:border-white/[0.08]">
        <button
          type="button"
          disabled={signingOut}
          onClick={onSignOut}
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-[12.5px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          <span className="inline-flex items-center gap-2">
            <LogOut className="h-4 w-4 shrink-0" />
            <span>
              {signingOut
                ? isAr
                  ? 'جارٍ تسجيل الخروج...'
                  : 'Signing out...'
                : isAr
                  ? 'تسجيل الخروج'
                  : 'Sign Out'}
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}

export interface TopFilterBarProps {
  companyNameAr?: string
  notifications?: React.ReactNode
  isAuditor?: boolean
  userEmail?: string
}

/**
 * Ultra-Clean 3-Control Executive Top Bar (`src/components/aether/TopFilterBar.tsx`):
 * Displays strictly 3 controls in the header control cluster:
 *   1) Period Selector (`اليوم | الأسبوع | الشهر | السنة | مخصص` — horizontally scrollable on `< 768px`)
 *   2) Single `فلاتر` (`Filters`) button (with active filter count badge & unclipped/scrollable filter chips)
 *   3) `القائمة والحساب` (`Account & Menu`) button housing Notifications, PIN/Auditor Role, Theme, Language, Share, Search, and Sign Out.
 */
export function TopFilterBar({
  companyNameAr = '',
  notifications,
  isAuditor = false,
  userEmail,
}: TopFilterBarProps = {}) {
  const pathname = usePathname() ?? ''
  const { locale, setLocale } = useI18n()
  const isAr = locale === 'ar'
  const isBrainBarRoute = Boolean(pathname && BRAIN_BAR_ROUTES.has(pathname))

  useDocumentTitle(pathname, isAr, isBrainBarRoute)

  const {
    filters,
    workspace,
    setPeriod,
    setCustomRange,
    setKuwaitSlice,
    setBrand,
    setBranch,
    setChannel,
    setLens,
    resetFilters,
    buildShareDeepLinkText,
  } = useGlobalFilter()

  const gov = useOptionalGovernance()
  const auditorMode = Boolean(
    isAuditor ||
      gov?.isAuditor ||
      (typeof userEmail === 'string' && userEmail.toLowerCase().includes('auditor')),
  )

  const [sharedCopied, setSharedCopied] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [filtersPopoverOpen, setFiltersPopoverOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [draftFrom, setDraftFrom] = useState(filters.customFrom)
  const [draftTo, setDraftTo] = useState(filters.customTo)

  const desktopBarRef = useRef<HTMLDivElement>(null)
  const mobileAccountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraftFrom(filters.customFrom)
    setDraftTo(filters.customTo)
  }, [filters.customFrom, filters.customTo])

  useEffect(() => {
    setMobileSheetOpen(false)
    setFiltersPopoverOpen(false)
    setAccountMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileSheetOpen && !filtersPopoverOpen && !accountMenuOpen) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSheetOpen(false)
        setFiltersPopoverOpen(false)
        setAccountMenuOpen(false)
      }
    }
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (desktopBarRef.current && desktopBarRef.current.contains(target)) return
      if (mobileAccountRef.current && mobileAccountRef.current.contains(target)) return
      setFiltersPopoverOpen(false)
      setAccountMenuOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      window.removeEventListener('keydown', onEsc)
      document.removeEventListener('mousedown', onDocMouseDown)
    }
  }, [accountMenuOpen, filtersPopoverOpen, mobileSheetOpen])

  const copyShareDeepLink = useCallback(async () => {
    if (!pathname) return
    try {
      const text = buildShareDeepLinkText(pathname, isAr)
      await navigator.clipboard.writeText(text)
      setSharedCopied(true)
      window.setTimeout(() => setSharedCopied(false), 2200)
    } catch {
      // ignore clipboard errors
    }
  }, [buildShareDeepLinkText, isAr, pathname])

  const handleSignOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } catch {
      // proceed to login page
    } finally {
      window.location.href = '/login'
    }
  }, [signingOut])

  if (!isBrainBarRoute) {
    const fallbackNotifications = notifications ?? <GovernanceBellTrigger />
    return (
      <header id="ae-topbar" className="no-print sticky top-2 z-40 w-full overflow-visible">
        <PanelHeaderBar companyNameAr={companyNameAr} notifications={fallbackNotifications} />
      </header>
    )
  }

  const page = routeTitle(pathname)
  const mobilePageTitle = page
    ? isAr
      ? (page.mobileAr ?? page.ar)
      : (page.mobileEn ?? page.en)
    : isAr
      ? 'ملخص الشركة'
      : 'Overview'
  const showPosFilters = POS_FILTER_ROUTES.has(pathname)
  // Overview-specific Quick Lenses & Daypart/Slice inside the unified Filters drawer/popover
  const showOverviewSummaryRow2 = pathname === '/erp'

  const nonDefaultSliceCount =
    (filters.brand !== 'all' ? 1 : 0) +
    (filters.branch !== 'all' ? 1 : 0) +
    (filters.channel !== 'all' ? 1 : 0) +
    (showOverviewSummaryRow2 && filters.lens !== 'all' ? 1 : 0) +
    (showOverviewSummaryRow2 && filters.kuwaitSlice !== 'all' ? 1 : 0)

  const mobileActiveFilterCount =
    nonDefaultSliceCount + (filters.period !== 'month' ? 1 : 0)

  const hasAnyActiveFilter = nonDefaultSliceCount > 0 || filters.period !== 'month'
  const hasUnreadNotifications = (gov?.liveBadgeCount ?? 0) > 0
  const hasActiveBreaches = (gov?.activeBreaches.length ?? 0) > 0

  const handleApplyMobileSheet = () => {
    if (filters.period === 'custom') {
      setCustomRange(draftFrom, draftTo)
    }
    setMobileSheetOpen(false)
  }

  return (
    <>
      {/* =====================================================================
          1. MOBILE & TABLET COMPACT 56px STICKY FROSTED APP BAR (`lg:hidden`)
             Strictly 3 Controls: (a) Scrollable Period Strip, (b) `فلاتر`, (c) `القائمة والحساب`
         ===================================================================== */}
      <header
        aria-label={isAr ? 'الشريط العلوي للجوال' : 'Mobile Executive App Bar'}
        dir={isAr ? 'rtl' : 'ltr'}
        className="ae-mobile-appbar no-print sticky top-0 z-40 -mx-4 bg-white/90 px-3.5 shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden dark:bg-[#0B1512]/90 dark:shadow-[0_1px_0_rgba(16,185,129,0.12)]"
      >
        <div className="flex h-14 items-center justify-between gap-1.5">
          {/* Start: VF Brand Badge + Single Concise Active Page Title */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link
              href="/erp"
              aria-label={isAr ? 'ملخص الشركة' : 'Overview'}
              className="btn-colored flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-[11px] font-black text-white shadow-xs transition-transform duration-150 active:scale-95"
            >
              VF
            </Link>
            <span
              className="truncate text-[14px] font-semibold tracking-tight text-slate-900 sm:text-[15px] dark:text-white"
              aria-current="page"
            >
              {mobilePageTitle}
            </span>
          </div>

          {/* End: Control (b) `فلاتر` + Control (c) `القائمة والحساب` */}
          <div className="flex shrink-0 items-center gap-1.5">
            {showPosFilters ? (
              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen(false)
                  setMobileSheetOpen(true)
                }}
                aria-expanded={mobileSheetOpen}
                aria-label={isAr ? 'فتح فلاتر التحليل' : 'Open Filters'}
                className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl px-2 text-[11.5px] font-semibold transition-all duration-[160ms] active:scale-95 sm:px-2.5 ${
                  mobileActiveFilterCount > 0
                    ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/35'
                    : 'bg-neutral-100/90 text-slate-700 ring-1 ring-slate-900/[0.05] dark:bg-white/[0.06] dark:text-slate-200 dark:ring-emerald-500/15'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="whitespace-nowrap">{isAr ? 'فلاتر' : 'Filters'}</span>
                {mobileActiveFilterCount > 0 ? (
                  <span
                    dir="ltr"
                    style={{ color: '#FFFFFF' }}
                    className="btn-colored inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-emerald-600 px-1 text-[10px] font-bold tabular-nums text-white"
                  >
                    {mobileActiveFilterCount}
                  </span>
                ) : null}
              </button>
            ) : null}

            <div ref={mobileAccountRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setMobileSheetOpen(false)
                  setAccountMenuOpen((v) => !v)
                }}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label={isAr ? 'القائمة والحساب' : 'Account & Menu'}
                className={`relative inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl px-2 text-[11.5px] font-semibold transition-all duration-[160ms] active:scale-95 sm:px-2.5 ${
                  accountMenuOpen || (!auditorMode && gov?.session.active)
                    ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/35'
                    : auditorMode
                      ? 'bg-amber-50/90 text-amber-950 ring-1 ring-amber-500/25 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-400/25'
                      : 'bg-neutral-100/90 text-slate-700 ring-1 ring-slate-900/[0.05] dark:bg-white/[0.06] dark:text-slate-200 dark:ring-emerald-500/15'
                }`}
              >
                <ShieldCheck
                  className={`h-3.5 w-3.5 shrink-0 ${
                    auditorMode
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                />
                <span className="whitespace-nowrap">
                  {isAr ? 'القائمة والحساب' : 'Account & Menu'}
                </span>
                {hasUnreadNotifications ? (
                  <span
                    aria-hidden
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      hasActiveBreaches ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                  />
                ) : null}
                <ChevronDown
                  className={`h-3 w-3 shrink-0 opacity-75 transition-transform duration-150 ${
                    accountMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {accountMenuOpen ? (
                <div className="absolute end-0 top-full z-50 mt-2 lg:hidden">
                  <AccountWorkspaceMenuPanel
                    isAr={isAr}
                    locale={locale}
                    auditorMode={auditorMode}
                    userEmail={userEmail}
                    onSetLocale={setLocale}
                    sharedCopied={sharedCopied}
                    onShareWhatsApp={() => void copyShareDeepLink()}
                    onOpenCommandSearch={() => {
                      setAccountMenuOpen(false)
                      openCommandPalette()
                    }}
                    onSignOut={() => void handleSignOut()}
                    signingOut={signingOut}
                    onCloseMenu={() => setAccountMenuOpen(false)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Control (a) on `< 1024px` (`< 768px` smartphone & tablet): Horizontally Scrollable Period Selector */}
        {showPosFilters ? (
          <div className="space-y-2 pb-2.5">
            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
              <EmeraldPillTabs
                ariaLabel={isAr ? 'الفترة' : 'Period'}
                value={filters.period}
                onChange={setPeriod}
                options={GLOBAL_PERIOD_OPTIONS.map((p) => ({
                  id: p.id,
                  label: cleanPeriodOptionLabel(p.id, isAr ? p.ar : p.en, isAr),
                }))}
              />

              {auditorMode ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-200">
                  <Lock className="h-3 w-3 shrink-0" />
                  <span>{isAr ? 'حساب مراجعة — قراءة فقط' : 'Read-Only Auditor'}</span>
                </span>
              ) : null}
            </div>

            {filters.period === 'custom' ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#F6F7F8] p-2.5 ring-1 ring-slate-900/[0.04] dark:bg-[#09110E] dark:ring-emerald-500/15">
                <label className="inline-flex flex-1 items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="whitespace-nowrap">{isAr ? 'من تاريخ' : 'Start Date'}</span>
                  <input
                    type="date"
                    dir="ltr"
                    value={draftFrom}
                    onChange={(e) => setDraftFrom(e.target.value)}
                    className="h-8 min-w-[120px] flex-1 rounded-xl bg-white px-2 text-[11.5px] font-bold tabular-nums text-slate-900 ring-1 ring-slate-900/[0.06] outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#101C17] dark:text-white"
                  />
                </label>
                <label className="inline-flex flex-1 items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="whitespace-nowrap">{isAr ? 'إلى تاريخ' : 'End Date'}</span>
                  <input
                    type="date"
                    dir="ltr"
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                    className="h-8 min-w-[120px] flex-1 rounded-xl bg-white px-2 text-[11.5px] font-bold tabular-nums text-slate-900 ring-1 ring-slate-900/[0.06] outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#101C17] dark:text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setCustomRange(draftFrom, draftTo)}
                  className="btn-colored inline-flex h-8 shrink-0 cursor-pointer items-center rounded-xl bg-emerald-600 px-3 text-[11.5px] font-bold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
                >
                  {isAr ? 'تطبيق' : 'Apply'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* =====================================================================
          2. SILKY MOBILE FILTER BOTTOM SHEET (`lg:hidden`)
         ===================================================================== */}
      {mobileSheetOpen ? (
        <>
          <div
            aria-hidden
            onClick={() => setMobileSheetOpen(false)}
            className="ae-sheet-backdrop no-print fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs lg:hidden"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              isAr ? 'فلاتر الفترة والفروع والقنوات' : 'Period, Brand, Branch & Channel Filters'
            }
            dir={isAr ? 'rtl' : 'ltr'}
            className="ae-bottom-sheet no-print fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-slate-900/5 lg:hidden dark:bg-[#101C17] dark:ring-emerald-500/15"
          >
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-200 dark:bg-white/15" />

            <div className="flex items-start justify-between gap-2 pb-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                  {isAr ? 'فلاتر التحليل الموحدة' : 'Unified Executive Filters'}
                </h2>
                <p className="mt-0.5 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                  {toWesternNumerals(isAr ? workspace.subtitleAr : workspace.subtitleEn)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-neutral-100 text-slate-600 transition-colors hover:text-slate-950 dark:bg-white/[0.08] dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Period + Custom Dates */}
              <div className="space-y-2">
                <div className="text-[11.5px] font-bold text-slate-500 dark:text-slate-400">
                  {isAr ? 'الفترة الزمنية' : 'Time Period'}
                </div>
                <EmeraldPillTabs
                  ariaLabel={isAr ? 'الفترة' : 'Period'}
                  value={filters.period}
                  onChange={setPeriod}
                  options={GLOBAL_PERIOD_OPTIONS.map((p) => ({
                    id: p.id,
                    label: cleanPeriodOptionLabel(p.id, isAr ? p.ar : p.en, isAr),
                  }))}
                />

                {filters.period === 'custom' ? (
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F6F7F8] p-3 ring-1 ring-slate-900/[0.04] dark:bg-[#09110E] dark:ring-emerald-500/15">
                    <label className="space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <span>{isAr ? 'من تاريخ' : 'Start Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftFrom}
                        onChange={(e) => setDraftFrom(e.target.value)}
                        className="h-9 w-full rounded-xl bg-white px-2.5 text-xs font-bold tabular-nums text-slate-900 ring-1 ring-slate-900/[0.06] outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#101C17] dark:text-white"
                      />
                    </label>
                    <label className="space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <span>{isAr ? 'إلى تاريخ' : 'End Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftTo}
                        onChange={(e) => setDraftTo(e.target.value)}
                        className="h-9 w-full rounded-xl bg-white px-2.5 text-xs font-bold tabular-nums text-slate-900 ring-1 ring-slate-900/[0.06] outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#101C17] dark:text-white"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <FilterChipGroup
                label={isAr ? 'المطعم / العلامة (6 مطاعم)' : 'Brand (6 Approved Brands)'}
                value={filters.brand}
                options={workspace.cascadingOptions.brands}
                isAr={isAr}
                showHealthMeta
                onChange={setBrand}
              />

              <FilterChipGroup
                label={isAr ? 'الفرع (7 فروع نشطة)' : 'Branch (7 Active Branches)'}
                value={filters.branch}
                options={workspace.cascadingOptions.branches}
                isAr={isAr}
                showHealthMeta
                onChange={setBranch}
              />

              <FilterChipGroup
                label={isAr ? 'قناة البيع (8 قنوات)' : 'Sales Channel (8 Channels)'}
                value={filters.channel}
                options={workspace.cascadingOptions.channels}
                isAr={isAr}
                showHealthMeta
                onChange={setChannel}
              />

              {showOverviewSummaryRow2 ? (
                <>
                  <FilterChipGroup
                    label={isAr ? 'الفترة اليومية / الشريحة' : 'Daypart / Time Slice'}
                    value={filters.kuwaitSlice}
                    options={GLOBAL_KUWAIT_SLICE_OPTIONS}
                    isAr={isAr}
                    onChange={setKuwaitSlice}
                  />
                  <FilterChipGroup
                    label={isAr ? 'عدسات التركيز السريع' : 'Quick Focus Lenses'}
                    value={filters.lens}
                    options={GLOBAL_PROFIT_LENS_OPTIONS}
                    isAr={isAr}
                    twoColGrid
                    onChange={setLens}
                  />
                </>
              ) : null}

              {/* Footer Actions: Reset All + Apply */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={!hasAnyActiveFilter}
                  className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-neutral-100 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-neutral-200/80 disabled:opacity-45 dark:bg-white/[0.07] dark:text-slate-200"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{isAr ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyMobileSheet}
                  className="btn-colored inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
                >
                  <Check className="h-4 w-4" />
                  <span>{isAr ? 'تطبيق وإغلاق' : 'Apply'}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* =====================================================================
          3. DESKTOP ULTRA-CLEAN 3-CONTROL EXECUTIVE TOP BAR (`hidden lg:block`)
             [Rail + Title]  ...  1) Period  •  2) فلاتر  •  3) القائمة والحساب ▾
         ===================================================================== */}
      <header
        id="ae-topbar"
        aria-label={isAr ? 'شريط التحكم التنفيذي الموحد' : 'Unified Executive Control Bar'}
        dir={isAr ? 'rtl' : 'ltr'}
        className="no-print sticky top-2 z-40 hidden w-full max-w-[1920px] overflow-visible py-1.5 lg:block"
      >
        <div
          ref={desktopBarRef}
          className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/95 px-3.5 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.05] backdrop-blur-md dark:bg-[#101C17]/95 dark:ring-emerald-500/15"
        >
          {/* Start Side: Sidebar Rail Toggle + Page Title + Optional Auditor Pill */}
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(RAIL_TOGGLE_EVENT))}
              className="ae-capsule inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl"
              title={
                isAr ? 'طي أو توسيع القائمة الجانبية (Ctrl+B)' : 'Toggle sidebar rail (Ctrl+B)'
              }
              aria-label={isAr ? 'طي أو توسيع القائمة الجانبية' : 'Toggle sidebar rail'}
            >
              <PanelLeft className="h-4 w-4 opacity-75" />
            </button>

            {page ? (
              <span
                className="ae-top-title truncate px-1 text-[15px] font-extrabold tracking-tight"
                aria-current="page"
              >
                {isAr ? page.ar : page.en}
              </span>
            ) : null}

            {auditorMode ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-50 px-2.5 py-1 text-[11.5px] font-bold text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-200">
                <Lock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{isAr ? 'حساب مراجعة — قراءة فقط' : 'Read-Only Auditor'}</span>
              </span>
            ) : null}
          </div>

          {/* End Control Cluster: Strictly ONLY 3 Controls: (a) Period, (b) `فلاتر`, (c) `القائمة والحساب` */}
          <div className="relative z-[60] flex flex-wrap items-center justify-end gap-2 overflow-visible">
            {showPosFilters ? (
              <>
                {/* Control (a): Period Selector (`اليوم | الأسبوع | الشهر | السنة | مخصص`) */}
                <EmeraldPillTabs
                  ariaLabel={isAr ? 'الفترة' : 'Period'}
                  value={filters.period}
                  onChange={setPeriod}
                  options={GLOBAL_PERIOD_OPTIONS.map((p) => ({
                    id: p.id,
                    label: cleanPeriodOptionLabel(p.id, isAr ? p.ar : p.en, isAr),
                  }))}
                />

                {filters.period === 'custom' ? (
                  <div className="inline-flex items-center gap-1.5 rounded-2xl bg-[#F6F7F8] px-2.5 py-1 ring-1 ring-slate-900/[0.05] dark:bg-[#09110E] dark:ring-emerald-500/15">
                    <label className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">
                      <span>{isAr ? 'من تاريخ' : 'Start Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftFrom}
                        onChange={(e) => setDraftFrom(e.target.value)}
                        className="h-7 rounded-xl bg-white px-2 text-[11.5px] font-bold tabular-nums text-slate-900 ring-1 ring-slate-900/[0.06] outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#101C17] dark:text-white"
                      />
                    </label>
                    <label className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">
                      <span>{isAr ? 'إلى تاريخ' : 'End Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftTo}
                        onChange={(e) => setDraftTo(e.target.value)}
                        className="h-7 rounded-xl bg-white px-2 text-[11.5px] font-bold tabular-nums text-slate-900 ring-1 ring-slate-900/[0.06] outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#101C17] dark:text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomRange(draftFrom, draftTo)}
                      className="btn-colored inline-flex h-7 cursor-pointer items-center rounded-xl bg-emerald-600 px-2.5 text-[11.5px] font-bold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
                    >
                      {isAr ? 'تطبيق' : 'Apply'}
                    </button>
                  </div>
                ) : null}

                {filters.period === 'today' && workspace.isTodayFallback ? (
                  <span
                    title={
                      isAr
                        ? `تعويض تلقائي لآخر يوم تشغيل مكتمل في نقاط البيع (${workspace.todayFallbackDate ?? ''})`
                        : `Auto-fallback to last completed POS operating day (${workspace.todayFallbackDate ?? ''})`
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-xl bg-amber-50 px-2.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-500/20 dark:bg-amber-950/50 dark:text-amber-200"
                  >
                    <span>{isAr ? 'آخر يوم مكتمل' : 'Last Full Day'}</span>
                  </span>
                ) : null}

                {/* Control (b): Single Unified `فلاتر` (`Filters`) Button + Active Count Badge */}
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    setFiltersPopoverOpen((v) => !v)
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={filtersPopoverOpen}
                  className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold transition-all duration-[160ms] focus:outline-none ${
                    filtersPopoverOpen || nonDefaultSliceCount > 0
                      ? 'bg-emerald-50/80 text-emerald-950 ring-1 ring-emerald-500/45 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-400/50'
                      : 'bg-neutral-100/90 text-slate-700 ring-1 ring-slate-900/[0.05] hover:bg-white hover:text-slate-950 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-emerald-500/10 dark:hover:bg-white/[0.10]'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="whitespace-nowrap">{isAr ? 'فلاتر' : 'Filters'}</span>
                  {nonDefaultSliceCount > 0 ? (
                    <span
                      dir="ltr"
                      style={{ color: '#FFFFFF' }}
                      className="btn-colored inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-md bg-emerald-600 px-1.5 text-[10.5px] font-bold tabular-nums text-white"
                    >
                      {nonDefaultSliceCount}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={`h-3.5 w-3.5 opacity-70 transition-transform duration-150 ${
                      filtersPopoverOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </>
            ) : null}

            {/* Control (c): `القائمة والحساب` (`Account & Menu`) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setFiltersPopoverOpen(false)
                  setAccountMenuOpen((v) => !v)
                }}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold transition-all duration-[160ms] focus:outline-none ${
                  accountMenuOpen || (!auditorMode && gov?.session.active)
                    ? 'bg-emerald-50/80 text-emerald-950 ring-1 ring-emerald-500/45 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-400/50'
                    : auditorMode
                      ? 'bg-amber-50/80 text-amber-950 ring-1 ring-amber-500/30 dark:bg-amber-950/45 dark:text-amber-200 dark:ring-amber-400/30'
                      : 'bg-neutral-100/90 text-slate-700 ring-1 ring-slate-900/[0.05] hover:bg-white hover:text-slate-950 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-emerald-500/10 dark:hover:bg-white/[0.10]'
                }`}
              >
                {!auditorMode && gov?.session.active ? (
                  <Unlock className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ShieldCheck
                    className={`h-3.5 w-3.5 shrink-0 ${
                      auditorMode
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  />
                )}
                <span className="whitespace-nowrap">
                  {isAr ? 'القائمة والحساب' : 'Account & Menu'}
                </span>
                {hasUnreadNotifications ? (
                  <span
                    aria-hidden
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                      hasActiveBreaches ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                  />
                ) : null}
                <ChevronDown
                  className={`h-3.5 w-3.5 opacity-70 transition-transform duration-150 ${
                    accountMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {accountMenuOpen ? (
                <div className="absolute end-0 top-full z-50 mt-2">
                  <AccountWorkspaceMenuPanel
                    isAr={isAr}
                    locale={locale}
                    auditorMode={auditorMode}
                    userEmail={userEmail}
                    onSetLocale={setLocale}
                    sharedCopied={sharedCopied}
                    onShareWhatsApp={() => void copyShareDeepLink()}
                    onOpenCommandSearch={() => {
                      setAccountMenuOpen(false)
                      openCommandPalette()
                    }}
                    onSignOut={() => void handleSignOut()}
                    signingOut={signingOut}
                    onCloseMenu={() => setAccountMenuOpen(false)}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* =================================================================
              DESKTOP ANCHORED UNIFIED `فلاتر` (`Filters`) POPOVER DRAWER
             ================================================================= */}
          {showPosFilters && filtersPopoverOpen ? (
            <div
              role="dialog"
              aria-label={isAr ? 'فلاتر التحليل الموحدة' : 'Unified Executive Filters'}
              dir={isAr ? 'rtl' : 'ltr'}
              className="absolute end-0 top-full z-50 mt-2 max-h-[82dvh] w-full max-w-[720px] space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/[0.07] dark:bg-[#101C17] dark:ring-emerald-500/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-white/[0.08]">
                <div className="min-w-0">
                  <h2 className="text-[14.5px] font-bold text-slate-900 dark:text-white">
                    {isAr ? 'فلاتر التحليل الموحدة' : 'Unified Executive Filters'}
                  </h2>
                  <p className="mt-0.5 text-[12px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                    {toWesternNumerals(isAr ? workspace.subtitleAr : workspace.subtitleEn)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {hasAnyActiveFilter ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-rose-50 px-3 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/20 transition-colors hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-400/25"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{isAr ? 'إعادة ضبط الفلاتر' : 'Reset All Filters'}</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setFiltersPopoverOpen(false)}
                    aria-label={isAr ? 'إغلاق' : 'Close'}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-neutral-100 text-slate-600 transition-colors hover:text-slate-950 dark:bg-white/[0.08] dark:text-slate-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 1. Brand (`المطعم / العلامة`) */}
              <FilterChipGroup
                label={isAr ? 'المطعم / العلامة (6 مطاعم معتمدة)' : 'Brand (6 Approved Brands)'}
                value={filters.brand}
                options={workspace.cascadingOptions.brands}
                isAr={isAr}
                showHealthMeta
                onChange={setBrand}
              />

              {/* 2. Branch (`الفرع`) */}
              <FilterChipGroup
                label={isAr ? 'الفرع (7 فروع نشطة)' : 'Branch (7 Active Branches)'}
                value={filters.branch}
                options={workspace.cascadingOptions.branches}
                isAr={isAr}
                showHealthMeta
                onChange={setBranch}
              />

              {/* 3. Channel (`قناة البيع`) */}
              <FilterChipGroup
                label={isAr ? 'قناة البيع (8 قنوات)' : 'Sales Channel (8 Channels)'}
                value={filters.channel}
                options={workspace.cascadingOptions.channels}
                isAr={isAr}
                showHealthMeta
                onChange={setChannel}
              />

              {/* 4. Daypart / Slice & 5. Quick Lenses (full unclipped labels inside popover) */}
              {showOverviewSummaryRow2 ? (
                <>
                  <FilterChipGroup
                    label={isAr ? 'الفترة اليومية / الشريحة' : 'Daypart / Time Slice'}
                    value={filters.kuwaitSlice}
                    options={GLOBAL_KUWAIT_SLICE_OPTIONS}
                    isAr={isAr}
                    onChange={setKuwaitSlice}
                  />

                  <FilterChipGroup
                    label={isAr ? 'عدسات التركيز السريع' : 'Quick Focus Lenses'}
                    value={filters.lens}
                    options={GLOBAL_PROFIT_LENS_OPTIONS}
                    isAr={isAr}
                    twoColGrid
                    onChange={setLens}
                  />
                </>
              ) : null}

              <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-white/[0.08]">
                <span className="text-[11.5px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                  {toWesternNumerals(
                    isAr ? workspace.periodRangeLabelAr : workspace.periodRangeLabelEn,
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {hasAnyActiveFilter ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-neutral-100 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-neutral-200/80 dark:bg-white/[0.08] dark:text-slate-200"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{isAr ? 'إعادة ضبط الفلاتر' : 'Reset All'}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setFiltersPopoverOpen(false)}
                    className="btn-colored inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isAr ? 'تم' : 'Done'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>
    </>
  )
}
