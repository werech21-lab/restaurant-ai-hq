'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ChevronDown, PanelLeft, Search, Share2 } from 'lucide-react'
import { useI18n, type Locale } from '@/lib/i18n'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PanelHeaderBar } from '@/components/panel-chrome'
import { openCommandPalette } from '@/components/aether/BiFilterContext'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { OdooAuditCertificatePill } from '@/components/aether/OdooAuditCertificateModal'
import { OdooSyncPill } from '@/components/aether/OdooSyncPill'
import { BrainControlsInline, BRAIN_BAR_ROUTES } from '@/components/aether/TopBrainSwitcher'
import { GovernanceBellTrigger } from '@/components/erp/GovernanceBellDrawer'
import { RAIL_TOGGLE_EVENT } from '@/components/erp-sidebar'
import { routeTitle } from '@/lib/aether/route-titles'
import {
  GLOBAL_KUWAIT_SLICE_OPTIONS,
  GLOBAL_PERIOD_OPTIONS,
  GLOBAL_PROFIT_LENS_OPTIONS,
  type FilterOption,
  type ProfitLens,
} from '@/lib/aether/global-filter-engine'

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
      className="inline-flex flex-wrap items-center gap-0.5 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/[0.06] select-none dark:bg-[#111A22] dark:ring-white/[0.08]"
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
            className={`inline-flex h-7 cursor-pointer items-center justify-center rounded-full px-3 text-[12px] font-bold whitespace-nowrap transition-all duration-150 focus:outline-none ${
              active
                ? 'btn-colored bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-600 hover:bg-[#F4F6F9] hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            <span>{opt.label}</span>
          </button>
        )
      })}
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
        className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-150 focus:outline-none dark:bg-[#111A22] ${
          open || isActive
            ? 'bg-emerald-50/70 text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-emerald-500/45 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/55'
            : 'text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/[0.06] hover:text-slate-950 hover:ring-emerald-500/30 dark:text-slate-200 dark:ring-white/[0.08]'
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
                    ? 'bg-emerald-600 font-bold text-white dark:bg-emerald-500 dark:text-[#04130D]'
                    : 'font-medium text-slate-700 hover:bg-[#F4F6F9] hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/[0.06]'
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
 * Single Sleek Global Executive Header Bar across all 13 ERP routes:
 * - Row 1 (Sticky Global Bar): Rail Toggle + Page Title + Period (`Today/Week/Month/Year/Custom` with Custom Start/End dates)
 *   + Brand + Branch + Channel + WhatsApp Share + Manager PIN Session + Bell `🔔` + Theme + `AR/EN`
 *   (+ Feryal AI Switcher strictly on `/erp/feryal-ai` & `/erp/feryal`).
 * - Row 2 (7 Quick-Lens Pills + Green Weighted Margin / Peer Diagnostic Strip):
 *   Rendered STRICTLY ONLY when `pathname === '/erp'` AND the active `/erp` sub-tab is `'summary'` (`الأرقام المهمة`).
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

  const [sharedCopied, setSharedCopied] = useState(false)
  const [draftFrom, setDraftFrom] = useState(filters.customFrom)
  const [draftTo, setDraftTo] = useState(filters.customTo)

  useEffect(() => {
    setDraftFrom(filters.customFrom)
    setDraftTo(filters.customTo)
  }, [filters.customFrom, filters.customTo])

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
  const showPosFilters = POS_FILTER_ROUTES.has(pathname)
  // CRITICAL: Row 2 (7 Quick-Lens Pills + Green Weighted Margin / Peer Diagnostic Strip)
  // renders STRICTLY ONLY on `/erp` (`Overview / ملخص الشركة`) — NEVER on any subpage!
  const showOverviewSummaryRow2 = pathname === '/erp'

  const diag = workspace.diagnosticStrip
  const diagPillTone =
    diag.tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/25'
      : diag.tone === 'amber'
        ? 'bg-amber-50 text-amber-900 ring-amber-500/20 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-400/25'
        : 'bg-rose-50 text-rose-800 ring-rose-500/20 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-400/25'

  return (
    <>
      {/* Single Sticky Global Control Bar */}
      <header
        id="ae-topbar"
        aria-label={isAr ? 'شريط التحكم التنفيذي الموحد' : 'Unified Executive Control Bar'}
        dir={isAr ? 'rtl' : 'ltr'}
        className="no-print sticky top-2 z-40 w-full overflow-visible px-3.5 py-2 sm:px-4"
      >
        <span className="hidden" aria-hidden>
          <OdooSyncPill isAr={isAr} />
        </span>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Start Group: Rail Toggle + Page Title + Period (incl. Custom Start/End) + Brand + Branch + Channel */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(RAIL_TOGGLE_EVENT))}
              className="ae-capsule hidden h-8 w-8 shrink-0 cursor-pointer items-center justify-center md:inline-flex"
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

            <span
              aria-hidden
              className="me-0.5 hidden h-4 w-px bg-slate-200/80 sm:inline-block dark:bg-white/10"
            />

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
                  <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.06] dark:bg-[#111A22] dark:ring-white/[0.08]">
                    <label className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 dark:text-slate-300">
                      <span>{isAr ? 'من تاريخ' : 'Start Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftFrom}
                        onChange={(e) => setDraftFrom(e.target.value)}
                        className="h-7 rounded-full bg-[#F7F7F8] px-2.5 text-[11.5px] font-bold tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#090F15] dark:text-white"
                      />
                    </label>
                    <label className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 dark:text-slate-300">
                      <span>{isAr ? 'إلى تاريخ' : 'End Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftTo}
                        onChange={(e) => setDraftTo(e.target.value)}
                        className="h-7 rounded-full bg-[#F7F7F8] px-2.5 text-[11.5px] font-bold tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#090F15] dark:text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomRange(draftFrom, draftTo)}
                      className="inline-flex h-7 cursor-pointer items-center rounded-full bg-emerald-600 px-3 text-[11.5px] font-bold text-white transition-all duration-150 hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500 dark:text-[#04130D]"
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
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-amber-50 px-2.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-500/20 dark:bg-amber-950/50 dark:text-amber-200"
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
                    className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full bg-rose-50 px-3 text-[12px] font-bold text-rose-700 ring-1 ring-rose-500/20 transition-all duration-150 hover:bg-rose-100 active:scale-95 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-400/25"
                  >
                    <span>{isAr ? 'عرض الكل ✕' : 'Reset ✕'}</span>
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          {/* End Group: Quick Search + Share WhatsApp + Feryal Brain Switcher + Manager PIN & Bell 🔔 + Theme + AR/EN */}
          <div className="relative z-[60] flex flex-wrap items-center gap-1.5 overflow-visible">
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
              className="btn-colored inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-[12px] font-extrabold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
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

      {/* Row 2: STRICTLY ONLY on `/erp` when active sub-tab is `'summary'` (`الأرقام المهمة`) */}
      {showOverviewSummaryRow2 ? (
        <section
          aria-label={isAr ? 'عدسات الربح السبع وتشخيص الهامش المرجح' : '7 Profit Lenses & Weighted Margin Diagnostic'}
          dir={isAr ? 'rtl' : 'ltr'}
          className="no-print relative z-30 space-y-1.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="overflow-x-auto pb-0.5">
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

            <div className="flex flex-wrap items-center gap-1.5">
              <PillDropdown
                label={isAr ? 'التوقيت' : 'Slice'}
                value={filters.kuwaitSlice}
                defaultValue="all"
                compactDefaultLabel={isAr ? 'كل الأوقات' : 'All Times'}
                options={GLOBAL_KUWAIT_SLICE_OPTIONS}
                isAr={isAr}
                onChange={setKuwaitSlice}
              />
              <OdooAuditCertificatePill isAr={isAr} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/90 px-3.5 py-2 text-[13px] shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/[0.05] dark:bg-[#111A22]/95 dark:ring-white/[0.07]">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-extrabold ring-1 ${diagPillTone}`}
              >
                {isAr ? diag.benchmarkAr : diag.benchmarkEn}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {isAr ? diag.rootCauseAr : diag.rootCauseEn}
              </span>
            </div>

            <span className="text-[12px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {isAr ? workspace.periodRangeLabelAr : workspace.periodRangeLabelEn}
            </span>
          </div>
        </section>
      ) : null}
    </>
  )
}
