'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Check,
  ChevronDown,
  Lock,
  PanelLeft,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Unlock,
  X,
} from 'lucide-react'
import { useI18n, type Locale } from '@/lib/i18n'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PanelHeaderBar } from '@/components/panel-chrome'
import { openCommandPalette } from '@/components/aether/BiFilterContext'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { OdooAuditCertificatePill } from '@/components/aether/OdooAuditCertificateModal'
import { OdooSyncPill } from '@/components/aether/OdooSyncPill'
import { BrainControlsInline, BRAIN_BAR_ROUTES } from '@/components/aether/TopBrainSwitcher'
import {
  GovernanceBellTrigger,
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
  type ProfitLens,
} from '@/lib/aether/global-filter-engine'

export const ERP_SUBTAB_EVENT = 'aether:erp-subtab'
export type ErpOverviewSubtab = 'summary' | 'plays'

/** Routes that display the 5D POS & ledger filters (Period incl. Custom + Brand/Branch/Channel). */
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

function shortPeriodBadge(period: GlobalPeriod, isAr: boolean): string {
  if (period === 'today') return isAr ? 'اليوم' : 'Today'
  if (period === 'week') return isAr ? 'الأسبوع' : 'Week'
  if (period === 'month') return isAr ? 'الشهر' : 'Month'
  if (period === 'year') return isAr ? 'السنة' : 'Year'
  return isAr ? 'مخصص' : 'Custom'
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

function SheetFilterRow<T extends string>({
  label,
  value,
  options,
  isAr,
  showHealthMeta = false,
  onChange,
}: {
  label: string
  value: T
  options: readonly FilterOption<T>[]
  isAr: boolean
  showHealthMeta?: boolean
  onChange: (next: T) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11.5px] font-bold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl bg-neutral-100/90 p-1 dark:bg-white/[0.05]">
        {options.map((opt) => {
          const active = opt.id === value
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium whitespace-nowrap transition-all duration-[160ms] ${
                active
                  ? 'btn-colored bg-emerald-600 font-semibold text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                  : 'text-slate-700 hover:bg-white hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/[0.08]'
              }`}
            >
              {showHealthMeta && opt.healthDot ? (
                <span className="text-[10.5px] leading-none" aria-hidden>
                  {opt.healthDot}
                </span>
              ) : null}
              <span>{isAr ? opt.ar : opt.en}</span>
              {showHealthMeta && typeof opt.weightedNetPct === 'number' ? (
                <span
                  dir="ltr"
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    active
                      ? 'bg-white/20 text-white dark:bg-black/15 dark:text-[#04130D]'
                      : 'bg-white text-slate-600 dark:bg-white/10 dark:text-slate-300'
                  }`}
                >
                  {opt.weightedNetPct.toFixed(1)}%
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PillDropdown<T extends string>({
  label,
  value,
  defaultValue,
  compactDefaultLabel,
  options,
  isAr,
  showHealthMeta = false,
  onChange,
}: {
  label: string
  value: T
  defaultValue: T
  compactDefaultLabel: string
  options: readonly FilterOption<T>[]
  isAr: boolean
  showHealthMeta?: boolean
  onChange: (next: T) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const selected = options.find((o) => o.id === value) ?? options[0]
  const isActive = value !== defaultValue
  const displayValue = isActive ? (isAr ? selected.ar : selected.en) : compactDefaultLabel

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-[160ms] focus:outline-none dark:bg-[#101C17] ${
          open || isActive
            ? 'bg-emerald-50/70 text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-emerald-500/45 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/55'
            : 'text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/[0.06] hover:text-slate-950 hover:ring-emerald-500/30 dark:text-slate-200 dark:ring-emerald-500/10'
        }`}
      >
        <span className="text-[11.5px] font-medium text-slate-400 dark:text-slate-400">{label}:</span>
        {showHealthMeta && selected?.healthDot ? (
          <span className="text-[10.5px] leading-none" aria-hidden>
            {selected.healthDot}
          </span>
        ) : null}
        <span className="whitespace-nowrap font-bold">{displayValue}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${
            open ? 'rotate-180 text-emerald-700 dark:text-emerald-300' : ''
          }`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="ae-bento-card absolute start-0 z-50 mt-2 max-h-80 min-w-[248px] overflow-y-auto p-1.5"
        >
          {options.map((opt) => {
            const chosen = opt.id === value
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={chosen}
                onClick={() => {
                  onChange(opt.id)
                  setOpen(false)
                }}
                className={`flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-start text-[12.5px] transition-colors duration-150 ${
                  chosen
                    ? 'btn-colored bg-emerald-600 font-bold text-white dark:bg-emerald-500 dark:text-[#04130D]'
                    : 'font-medium text-slate-700 hover:bg-[#F6F7F8] hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {showHealthMeta && opt.healthDot ? (
                    <span className="text-[11px] leading-none" aria-hidden>
                      {opt.healthDot}
                    </span>
                  ) : null}
                  <span>{isAr ? opt.ar : opt.en}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {showHealthMeta && typeof opt.weightedNetPct === 'number' ? (
                    <span
                      dir="ltr"
                      className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-extrabold tabular-nums ${
                        chosen
                          ? 'bg-white/20 text-current'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                      }`}
                    >
                      {opt.weightedNetPct.toFixed(1)}%
                    </span>
                  ) : null}
                  {chosen ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export interface TopFilterBarProps {
  companyNameAr?: string
  notifications?: React.ReactNode
}

/**
 * Responsive Executive Header Bar across all 13 ERP routes:
 * - Desktop (`hidden lg:block`): Full-width single horizontal executive bar (`w-full max-w-[1920px]`),
 *   scrollable `EmeraldPillTabs`, Brand/Branch/Channel dropdowns, WhatsApp Share, Feryal AI Switcher,
 *   Manager PIN & Bell `🔔`, `ThemeToggle`, and `AR/EN`.
 * - Mobile & Tablet (`lg:hidden`): Sleek `56px` (`h-14`) sticky frosted glass App Bar +
 *   silky Mobile Filter Bottom Sheet (`rounded-t-3xl`).
 * - Row 2 (7 Quick-Lens Pills + Weighted Margin Strip): strictly scoped ONLY to `pathname === '/erp'`.
 */
export function TopFilterBar({ companyNameAr = '', notifications }: TopFilterBarProps = {}) {
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

  const [sharedCopied, setSharedCopied] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(filters.customFrom)
  const [draftTo, setDraftTo] = useState(filters.customTo)

  useEffect(() => {
    setDraftFrom(filters.customFrom)
    setDraftTo(filters.customTo)
  }, [filters.customFrom, filters.customTo])

  useEffect(() => {
    setMobileSheetOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileSheetOpen) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSheetOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [mobileSheetOpen])

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

  const bellSlot = notifications ?? <GovernanceBellTrigger />

  if (!isBrainBarRoute) {
    return (
      <header id="ae-topbar" className="no-print sticky top-2 z-40 w-full overflow-visible">
        <PanelHeaderBar companyNameAr={companyNameAr} notifications={bellSlot} />
      </header>
    )
  }

  const page = routeTitle(pathname)
  const activePageTitle = page
    ? isAr
      ? page.ar
      : page.en
    : isAr
      ? 'ملخص الشركة'
      : 'Company Summary'
  const showPosFilters = POS_FILTER_ROUTES.has(pathname)
  // CRITICAL: Row 2 (7 Quick-Lens Pills + Green Weighted Margin / Peer Diagnostic Strip)
  // renders ONLY when pathname === '/erp' — NEVER on any subpage.
  const showOverviewSummaryRow2 = pathname === '/erp'
  const isFeryalRoute = pathname === '/erp/feryal-ai' || pathname === '/erp/feryal'

  const activeFilterDimensionCount =
    (filters.period !== 'month' ? 1 : 0) +
    (filters.brand !== 'all' ? 1 : 0) +
    (filters.branch !== 'all' ? 1 : 0) +
    (filters.channel !== 'all' ? 1 : 0) +
    (pathname === '/erp' && filters.lens !== 'all' ? 1 : 0) +
    (pathname === '/erp' && filters.kuwaitSlice !== 'all' ? 1 : 0)

  const hasActiveMobileFilter =
    filters.brand !== 'all' ||
    filters.branch !== 'all' ||
    filters.channel !== 'all' ||
    filters.period !== 'month' ||
    activeFilterDimensionCount > 0

  const diag = workspace.diagnosticStrip
  const diagPillTone =
    diag.tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/25'
      : diag.tone === 'amber'
        ? 'bg-amber-50 text-amber-900 ring-amber-500/20 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-400/25'
        : 'bg-rose-50 text-rose-800 ring-rose-500/20 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-400/25'

  const handleApplyMobileSheet = () => {
    if (filters.period === 'custom') {
      setCustomRange(draftFrom, draftTo)
    }
    setMobileSheetOpen(false)
  }

  return (
    <>
      <span className="hidden" aria-hidden>
        <OdooSyncPill isAr={isAr} />
      </span>

      {/* =====================================================================
          1. MOBILE & TABLET COMPACT 56px STICKY FROSTED APP BAR (`lg:hidden`)
         ===================================================================== */}
      <header
        aria-label={isAr ? 'الشريط العلوي للجوال' : 'Mobile Executive App Bar'}
        dir={isAr ? 'rtl' : 'ltr'}
        className="ae-mobile-appbar no-print sticky top-0 z-40 -mx-4 flex h-14 items-center justify-between gap-2 bg-white/90 px-4 shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden dark:bg-[#0B1512]/90 dark:shadow-[0_1px_0_rgba(16,185,129,0.12)]"
      >
        {/* Start: VF Brand Badge + Single Active Page Title */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Link
            href="/erp"
            aria-label={isAr ? 'ملخص الشركة' : 'Company Summary'}
            className="btn-colored flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-xs font-black text-white shadow-xs transition-transform duration-150 active:scale-95"
          >
            VF
          </Link>
          <span
            className="truncate text-[15px] font-semibold text-slate-900 dark:text-white"
            aria-current="page"
          >
            {activePageTitle}
          </span>
        </div>

        {/* End: 1) Filter Trigger Pill + 2) Compact Bell 🔔 + 3) Compact AR/EN */}
        <div className="flex shrink-0 items-center gap-1.5">
          {showPosFilters ? (
            <button
              type="button"
              onClick={() => setMobileSheetOpen(true)}
              aria-expanded={mobileSheetOpen}
              aria-label={isAr ? 'فتح الفلاتر والإعدادات' : 'Open Filters & Quick Controls'}
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all duration-[160ms] active:scale-95 ${
                hasActiveMobileFilter
                  ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/35'
                  : 'bg-neutral-100/90 text-slate-700 ring-1 ring-slate-900/[0.05] dark:bg-white/[0.06] dark:text-slate-200 dark:ring-emerald-500/15'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="whitespace-nowrap">{shortPeriodBadge(filters.period, isAr)}</span>
              {hasActiveMobileFilter ? (
                <span
                  dir="ltr"
                  style={{ color: '#FFFFFF' }}
                  className="btn-colored inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold tabular-nums text-white"
                >
                  {activeFilterDimensionCount}
                </span>
              ) : null}
            </button>
          ) : null}

          {bellSlot}

          <button
            type="button"
            dir="ltr"
            data-no-translate=""
            onClick={() => setLocale(isAr ? 'en' : 'ar')}
            aria-label={isAr ? 'Switch language to English' : 'تغيير اللغة إلى العربية'}
            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-xl bg-neutral-100/90 px-2.5 text-xs font-bold text-slate-700 ring-1 ring-slate-900/[0.05] transition-all duration-[160ms] active:scale-95 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-emerald-500/15"
          >
            {isAr ? 'EN' : 'AR'}
          </button>
        </div>
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
            aria-label={isAr ? 'فلاتر الفترة والفروع والقنوات' : 'Period, Brand, Branch & Channel Filters'}
            dir={isAr ? 'rtl' : 'ltr'}
            className="ae-bottom-sheet no-print fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-slate-900/5 lg:hidden dark:bg-[#101C17] dark:ring-emerald-500/15"
          >
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-200 dark:bg-white/15" />

            <div className="flex items-center justify-between gap-2 pb-3">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                  {isAr ? 'الفلاتر والتحكم التنفيذي' : 'Executive Filters & Controls'}
                </h2>
                <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                  {isAr ? workspace.subtitleAr : workspace.subtitleEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-neutral-100 text-slate-600 transition-colors hover:text-slate-950 dark:bg-white/[0.08] dark:text-slate-300"
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
                    label: isAr ? p.ar : p.en,
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

              {/* Brand, Branch & Channel */}
              <SheetFilterRow
                label={isAr ? 'المطعم (6 علامات معتمدة)' : 'Brand (6 Approved Brands)'}
                value={filters.brand}
                options={workspace.cascadingOptions.brands}
                isAr={isAr}
                showHealthMeta
                onChange={setBrand}
              />

              <SheetFilterRow
                label={isAr ? 'الفرع (7 فروع نشطة)' : 'Branch (7 Active Locations)'}
                value={filters.branch}
                options={workspace.cascadingOptions.branches}
                isAr={isAr}
                showHealthMeta
                onChange={setBranch}
              />

              <SheetFilterRow
                label={isAr ? 'قناة البيع والتوصيل' : 'Sales & Delivery Channel'}
                value={filters.channel}
                options={workspace.cascadingOptions.channels}
                isAr={isAr}
                showHealthMeta
                onChange={setChannel}
              />

              {/* Route-Specific: /erp Quick Lens & Kuwait Time Slice */}
              {pathname === '/erp' ? (
                <>
                  <SheetFilterRow
                    label={isAr ? 'عدسات الربح السبع' : 'Quick Profit Lens'}
                    value={filters.lens}
                    options={GLOBAL_PROFIT_LENS_OPTIONS}
                    isAr={isAr}
                    onChange={setLens}
                  />
                  <SheetFilterRow
                    label={isAr ? 'توقيت الكويت التشغيلي' : 'Kuwait Time Slice'}
                    value={filters.kuwaitSlice}
                    options={GLOBAL_KUWAIT_SLICE_OPTIONS}
                    isAr={isAr}
                    onChange={setKuwaitSlice}
                  />
                </>
              ) : null}

              {/* Route-Specific: /erp/feryal-ai Triple-Brain Switcher */}
              {isFeryalRoute ? (
                <div className="space-y-1.5 rounded-2xl bg-[#F6F7F8] p-3 ring-1 ring-slate-900/[0.04] dark:bg-[#09110E] dark:ring-emerald-500/15">
                  <div className="text-[11.5px] font-bold text-slate-500 dark:text-slate-400">
                    {isAr ? 'محرك المستشارة فريال' : 'Feryal AI Council Engine'}
                  </div>
                  <BrainControlsInline />
                </div>
              ) : null}

              {/* Share WhatsApp + ThemeToggle + Manager PIN Session */}
              <div className="space-y-2 rounded-2xl bg-[#F6F7F8] p-3 ring-1 ring-slate-900/[0.04] dark:bg-[#09110E] dark:ring-emerald-500/15">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void copyShareDeepLink()}
                    className="btn-colored inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-xs transition-all duration-150 active:scale-95 dark:bg-emerald-500 dark:text-[#04130D]"
                  >
                    {sharedCopied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                    <span>
                      {sharedCopied
                        ? isAr
                          ? 'تم نسخ الرابط ✅'
                          : 'Link Copied ✅'
                        : isAr
                          ? 'مشاركة للواتساب 📲'
                          : 'Share WhatsApp 📲'}
                    </span>
                  </button>

                  <ThemeToggle />
                </div>

                {gov ? (
                  <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 dark:border-emerald-500/15">
                    {gov.session.active ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <Unlock className="h-3.5 w-3.5" />
                          <span>{isAr ? 'وضع المدير نشط 🔓' : 'Manager Active 🔓'}</span>
                          <span dir="ltr" className="font-mono text-[11px] tabular-nums">
                            {formatPinCountdown(gov.session.remainingSeconds)}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={gov.lockSession}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-white px-3 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/20 transition-colors hover:bg-rose-50 dark:bg-[#101C17] dark:text-rose-300"
                        >
                          <span>{isAr ? 'قفل الصلاحية 🔒' : 'Lock PIN 🔒'}</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                          <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{isAr ? 'صلاحية اعتماد المدير' : 'Executive PIN Session'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            gov.requireManagerPin({
                              titleAr: 'تفعيل وضع المدير لمدة ١٥ دقيقة',
                              titleEn: 'Unlock 15-Minute Manager Session',
                            })
                          }
                          className="btn-colored inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
                        >
                          <span>{isAr ? 'فتح الصلاحية 🔓' : 'Unlock PIN 🔓'}</span>
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Footer Actions: Reset + Apply/Close */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-neutral-100 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-neutral-200/80 dark:bg-white/[0.07] dark:text-slate-200"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{isAr ? 'إعادة ضبط' : 'Reset'}</span>
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
          3. DESKTOP SINGLE HORIZONTAL EXECUTIVE BAR (`hidden lg:block`)
         ===================================================================== */}
      <header
        id="ae-topbar"
        aria-label={isAr ? 'شريط التحكم التنفيذي الموحد' : 'Unified Executive Control Bar'}
        dir={isAr ? 'rtl' : 'ltr'}
        className="no-print sticky top-2 z-40 hidden w-full max-w-[1920px] overflow-visible px-3.5 py-2 sm:px-4 lg:block"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Start Group: Rail Toggle + Page Title + Period + Brand + Branch + Channel */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(RAIL_TOGGLE_EVENT))}
              className="ae-capsule inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center"
              title={isAr ? 'طي أو توسيع القائمة الجانبية (Ctrl+B)' : 'Toggle sidebar rail (Ctrl+B)'}
              aria-label={isAr ? 'طي أو توسيع القائمة الجانبية' : 'Toggle sidebar rail'}
            >
              <PanelLeft className="h-3.5 w-3.5 opacity-75" />
            </button>

            {page ? (
              <span
                className="ae-top-title me-1 truncate px-1.5 text-[14.5px] font-extrabold tracking-tight"
                aria-current="page"
              >
                {isAr ? page.ar : page.en}
              </span>
            ) : null}

            <span aria-hidden className="me-0.5 h-4 w-px bg-slate-200/80 dark:bg-white/10" />

            {showPosFilters ? (
              <>
                <EmeraldPillTabs
                  ariaLabel={isAr ? 'الفترة' : 'Period'}
                  value={filters.period}
                  onChange={setPeriod}
                  options={GLOBAL_PERIOD_OPTIONS.map((p) => ({
                    id: p.id,
                    label: isAr ? p.ar : p.en,
                  }))}
                />

                {filters.period === 'custom' ? (
                  <div className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-2.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.06] dark:bg-[#101C17] dark:ring-emerald-500/15">
                    <label className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 dark:text-slate-300">
                      <span>{isAr ? 'من تاريخ' : 'Start Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftFrom}
                        onChange={(e) => setDraftFrom(e.target.value)}
                        className="h-7 rounded-xl bg-[#F6F7F8] px-2.5 text-[11.5px] font-bold tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#09110E] dark:text-white"
                      />
                    </label>
                    <label className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 dark:text-slate-300">
                      <span>{isAr ? 'إلى تاريخ' : 'End Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftTo}
                        onChange={(e) => setDraftTo(e.target.value)}
                        className="h-7 rounded-xl bg-[#F6F7F8] px-2.5 text-[11.5px] font-bold tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#09110E] dark:text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomRange(draftFrom, draftTo)}
                      className="btn-colored inline-flex h-7 cursor-pointer items-center rounded-xl bg-emerald-600 px-3 text-[11.5px] font-bold text-white transition-all duration-150 hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500 dark:text-[#04130D]"
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

                <PillDropdown
                  label={isAr ? 'المطعم' : 'Brand'}
                  value={filters.brand}
                  defaultValue="all"
                  compactDefaultLabel={isAr ? 'الكل' : 'All'}
                  options={workspace.cascadingOptions.brands}
                  isAr={isAr}
                  showHealthMeta
                  onChange={setBrand}
                />

                <PillDropdown
                  label={isAr ? 'الفرع' : 'Branch'}
                  value={filters.branch}
                  defaultValue="all"
                  compactDefaultLabel={isAr ? 'الكل' : 'All'}
                  options={workspace.cascadingOptions.branches}
                  isAr={isAr}
                  showHealthMeta
                  onChange={setBranch}
                />

                <PillDropdown
                  label={isAr ? 'القناة' : 'Channel'}
                  value={filters.channel}
                  defaultValue="all"
                  compactDefaultLabel={isAr ? 'الكل' : 'All'}
                  options={workspace.cascadingOptions.channels}
                  isAr={isAr}
                  showHealthMeta
                  onChange={setChannel}
                />

                {workspace.isFiltered ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-xl bg-rose-50 px-3 text-[12px] font-bold text-rose-700 ring-1 ring-rose-500/20 transition-all duration-150 hover:bg-rose-100 active:scale-95 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-400/25"
                  >
                    <span>{isAr ? 'عرض الكل ✕' : 'Reset ✕'}</span>
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          {/* End Group: Quick Search + Share WhatsApp + Feryal Brain Switcher + Manager PIN & Bell 🔔 + Theme + AR/EN */}
          <div className="relative z-[60] flex shrink-0 items-center gap-1.5 overflow-visible">
            <button
              type="button"
              onClick={openCommandPalette}
              className="ae-capsule hidden h-9 cursor-pointer items-center gap-1.5 px-2.5 py-1 text-xs font-semibold 2xl:inline-flex"
              title={isAr ? 'بحث سريع في الفروع والمطاعم والصفحات (⌘K)' : 'Quick search branches, brands & pages (⌘K)'}
              aria-label={isAr ? 'بحث سريع' : 'Quick Search'}
            >
              <Search className="h-3.5 w-3.5 opacity-70" />
              <kbd dir="ltr" className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => void copyShareDeepLink()}
              title={isAr ? 'مشاركة للواتساب 📲' : 'Share WhatsApp 📲'}
              aria-label={isAr ? 'مشاركة للواتساب 📲' : 'Share WhatsApp 📲'}
              className="btn-colored inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[12px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
            >
              {sharedCopied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span className="hidden 2xl:inline">{isAr ? 'تم نسخ الرابط ✅' : 'Link Copied ✅'}</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden 2xl:inline">{isAr ? 'مشاركة للواتساب 📲' : 'Share WhatsApp 📲'}</span>
                </>
              )}
            </button>

            <BrainControlsInline />

            {bellSlot}

            <ThemeToggle />

            <div dir="ltr" data-no-translate="">
              <EmeraldPillTabs<Locale>
                ariaLabel={isAr ? 'اللغة' : 'Language'}
                value={locale}
                onChange={setLocale}
                options={[
                  { id: 'ar', label: 'AR' },
                  { id: 'en', label: 'EN' },
                ]}
              />
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          4. ROW 2: STRICTLY ONLY ON `/erp` (COMPACT SINGLE-ROW SCROLL ON MOBILE)
         ===================================================================== */}
      {showOverviewSummaryRow2 ? (
        <section
          aria-label={isAr ? 'عدسات الربح السبع وتشخيص الهامش المرجح' : '7 Profit Lenses & Weighted Margin Diagnostic'}
          dir={isAr ? 'rtl' : 'ltr'}
          className="no-print relative z-30 space-y-1.5"
        >
          <div className="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar lg:overflow-visible">
            <div className="min-w-0 shrink-0 lg:shrink">
              <EmeraldPillTabs<ProfitLens>
                ariaLabel={isAr ? 'عدسات الربح السبع' : '7 Profit Lenses'}
                value={filters.lens}
                onChange={setLens}
                options={GLOBAL_PROFIT_LENS_OPTIONS.map((l) => ({
                  id: l.id,
                  label: isAr ? l.ar : l.en,
                }))}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <div className="hidden lg:block">
                <PillDropdown
                  label={isAr ? 'التوقيت' : 'Slice'}
                  value={filters.kuwaitSlice}
                  defaultValue="all"
                  compactDefaultLabel={isAr ? 'كل الأوقات' : 'All Times'}
                  options={GLOBAL_KUWAIT_SLICE_OPTIONS}
                  isAr={isAr}
                  onChange={setKuwaitSlice}
                />
              </div>
              <OdooAuditCertificatePill isAr={isAr} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar rounded-2xl bg-white px-3 py-1.5 text-[12px] whitespace-nowrap shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] lg:flex-wrap lg:px-3.5 lg:py-2 lg:text-[13px] lg:whitespace-normal dark:bg-[#101C17] dark:ring-emerald-500/10">
            <div className="flex items-center gap-2 lg:flex-wrap">
              <span
                className={`inline-flex shrink-0 items-center rounded-xl px-2.5 py-0.5 text-[11.5px] font-extrabold ring-1 lg:text-[12px] ${diagPillTone}`}
              >
                {isAr ? diag.benchmarkAr : diag.benchmarkEn}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {isAr ? diag.rootCauseAr : diag.rootCauseEn}
              </span>
            </div>

            <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-slate-500 lg:text-[12px] dark:text-slate-400">
              {isAr ? workspace.periodRangeLabelAr : workspace.periodRangeLabelEn}
            </span>
          </div>
        </section>
      ) : null}
    </>
  )
}
