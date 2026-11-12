'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ChevronDown, Share2 } from 'lucide-react'
import { useI18n, type Locale } from '@/lib/i18n'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { BrainControlsInline, BRAIN_BAR_ROUTES } from '@/components/aether/TopBrainSwitcher'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'
import {
  GLOBAL_KUWAIT_SLICE_OPTIONS,
  GLOBAL_PERIOD_OPTIONS,
  GLOBAL_PROFIT_LENS_OPTIONS,
  type FilterOption,
  type ProfitLens,
} from '@/lib/aether/global-filter-engine'

/** Routes that display the 5D POS & ledger filters (Period incl. Custom + Brand/Branch/Channel). */
const POS_FILTER_ROUTES = new Set([
  '/erp',
  '/erp/cores',
  '/erp/before-after',
  '/erp/feryal-ai',
  '/erp/feryal',
  '/erp/aggregator-radar',
  '/erp/planning',
  '/erp/regulations',
])

/** Routes that also show Row 2 (7 Profit Lenses + Peer Diagnostic Strip). */
const PROFIT_LENS_ROUTES = new Set([
  '/erp',
  '/erp/cores',
  '/erp/before-after',
  '/erp/feryal-ai',
  '/erp/feryal',
  '/erp/aggregator-radar',
])

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
        className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 text-[12.5px] font-semibold transition-all duration-150 focus:outline-none dark:bg-[#111A22] ${
          open || isActive
            ? 'text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/80 dark:text-emerald-300 dark:ring-emerald-400/70'
            : 'text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/[0.05] hover:text-slate-950 hover:ring-slate-900/15 dark:text-slate-200 dark:ring-white/[0.08]'
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
            open ? 'rotate-180 text-slate-900 dark:text-emerald-300' : ''
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
                    ? 'ae-btn-primary font-bold'
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

/**
 * Unified 5D Executive Header Strip + 7 Profit Lenses + Peer Diagnostic Strip across all 6 Aether BI pillars:
 * - Period SlidingPillTabs (`اليوم` with automatic fallback | `الأسبوع` | `الشهر` | `السنة`)
 * - Kuwait Time Slice (`كل الأوقات` | `أيام الرواتب ٢٠–٢٨` | `منتصف الشهر ١٠–١٩` | `الويكند والزوارة` | `الساعات الهادئة ٣–٦`)
 * - Cascading `المطعم • الفرع • القناة` with live `🟢/🟠/🔴` health dots & strict weighted `%` (`sum(net)/sum(sales)`)
 * - Verdelo sliding 7 Profit Lenses + 1-line Peer Benchmark & Root-Cause Diagnostic Strip
 * - `مشاركة للواتساب 📲` URL deep-link copy across all 6 pages
 */
export function TopFilterBar() {
  const pathname = usePathname()
  const { locale, setLocale } = useI18n()
  const isAr = locale === 'ar'
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

  if (!pathname || !BRAIN_BAR_ROUTES.has(pathname)) return null

  const showPosFilters = POS_FILTER_ROUTES.has(pathname)
  const showProfitLenses = PROFIT_LENS_ROUTES.has(pathname)
  const diag = workspace.diagnosticStrip
  const diagPillTone =
    diag.tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/25'
      : diag.tone === 'amber'
        ? 'bg-amber-50 text-amber-900 ring-amber-500/20 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-400/25'
        : 'bg-rose-50 text-rose-800 ring-rose-500/20 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-400/25'

  return (
    <section
      aria-label={isAr ? 'شريط التحكم التنفيذي الموحد' : 'Unified Executive Control Bar'}
      dir={isAr ? 'rtl' : 'ltr'}
      className="no-print relative z-30 space-y-1.5"
    >
      {/* Row 1: 5D Filters + Share for WhatsApp + Dual-Brain + Theme + AR/EN */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {showPosFilters ? (
            <>
              <SlidingPillTabs
                ariaLabel={isAr ? 'الفترة' : 'Period'}
                surface="white"
                size="sm"
                value={filters.period}
                onChange={setPeriod}
                options={GLOBAL_PERIOD_OPTIONS.map((p) => ({
                  id: p.id,
                  label: isAr ? p.ar : p.en,
                }))}
              />

              {filters.period === 'custom' ? (
                <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#111A22] dark:ring-1 dark:ring-white/[0.08]">
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
                    className="ae-btn-primary inline-flex h-7 cursor-pointer items-center rounded-full px-3 text-[11.5px] font-bold transition-all duration-150 active:scale-95"
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
                label={isAr ? 'التوقيت' : 'Slice'}
                value={filters.kuwaitSlice}
                defaultValue="all"
                compactDefaultLabel={isAr ? 'كل الأوقات' : 'All Times'}
                options={GLOBAL_KUWAIT_SLICE_OPTIONS}
                isAr={isAr}
                onChange={setKuwaitSlice}
              />

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
                  className="ae-btn-primary inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-[12px] font-bold transition-all duration-150 active:scale-95"
                >
                  <span>{isAr ? 'عرض الكل ✕' : 'Reset ✕'}</span>
                </button>
              ) : null}
            </>
          ) : (
            <div className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-[12px] font-bold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/[0.05] dark:bg-[#111A22] dark:text-slate-200 dark:ring-white/[0.08]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>{isAr ? 'حاسبة المعارض · EXB' : 'Booths Calculator · EXB'}</span>
            </div>
          )}
        </div>

        {/* End Group: WhatsApp Deep-Link Share + Dual-Brain + Theme + AR/EN */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void copyShareDeepLink()}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-[12px] font-extrabold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
          >
            {sharedCopied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>{isAr ? 'تم نسخ الرابط ✅' : 'Link Copied ✅'}</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>{isAr ? 'مشاركة للواتساب 📲' : 'Share WhatsApp 📲'}</span>
              </>
            )}
          </button>

          <BrainControlsInline />

          <ThemeToggle />

          <div dir="ltr" data-no-translate="">
            <SlidingPillTabs<Locale>
              ariaLabel={isAr ? 'اللغة' : 'Language'}
              surface="white"
              size="sm"
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

      {/* Row 2 (POS & Ledger Pages): Verdelo Sliding 7 Profit Lenses + 1-Line Peer Benchmark & Root-Cause Strip */}
      {showProfitLenses ? (
        <div className="space-y-1">
          <div className="overflow-x-auto pb-0.5">
            <SlidingPillTabs<ProfitLens>
              ariaLabel={isAr ? 'عدسات الربح السبع' : '7 Profit Lenses'}
              surface="white"
              size="sm"
              value={filters.lens}
              onChange={setLens}
              options={GLOBAL_PROFIT_LENS_OPTIONS.map((l) => ({
                id: l.id,
                label: isAr ? l.ar : l.en,
              }))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/90 px-3 py-1.5 text-[12px] shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/[0.05] dark:bg-[#111A22]/95 dark:ring-white/[0.07]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold ring-1 ${diagPillTone}`}>
                {isAr ? diag.benchmarkAr : diag.benchmarkEn}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {isAr ? diag.rootCauseAr : diag.rootCauseEn}
              </span>
            </div>

            <span className="text-[11px] font-semibold tabular-nums text-slate-400 dark:text-slate-400">
              {isAr ? workspace.periodRangeLabelAr : workspace.periodRangeLabelEn}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
