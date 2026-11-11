'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import { useI18n, type Locale } from '@/lib/i18n'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { BrainControlsInline, BRAIN_BAR_ROUTES } from '@/components/aether/TopBrainSwitcher'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'
import {
  GLOBAL_BRANCH_OPTIONS,
  GLOBAL_BRAND_OPTIONS,
  GLOBAL_CHANNEL_OPTIONS,
  GLOBAL_PERIOD_OPTIONS,
  type FilterOption,
} from '@/lib/aether/global-filter-engine'

/** Routes that display the 4 global POS & ledger filters. */
const POS_FILTER_ROUTES = new Set([
  '/erp',
  '/erp/cores',
  '/erp/before-after',
  '/erp/feryal-ai',
  '/erp/aggregator-radar',
])

function PillDropdown<T extends string>({
  label,
  value,
  defaultValue,
  compactDefaultLabel,
  options,
  isAr,
  onChange,
}: {
  label: string
  value: T
  defaultValue: T
  compactDefaultLabel: string
  options: readonly FilterOption<T>[]
  isAr: boolean
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
          className="ae-bento-card absolute start-0 z-50 mt-2 max-h-80 min-w-[210px] overflow-y-auto p-1.5"
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
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-start text-[12.5px] transition-colors duration-150 ${
                  chosen
                    ? 'ae-btn-primary font-bold'
                    : 'font-medium text-slate-700 hover:bg-[#F4F6F9] hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                }`}
              >
                <span>{isAr ? opt.ar : opt.en}</span>
                {chosen ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Unified Single-Row Executive Header Strip across all 6 Aether BI pillars:
 * - Period SlidingPillTabs (اليوم | الأسبوع | الشهر | السنة)
 * - Brand • Branch • Channel Floating Pill Dropdowns + 1-click Reset
 * - Dual-Brain SlidingPillTabs + Copy for Grok Ultra + API Key Gear
 * - Light Finance V2 ☀️ / Dark Verdelo Emerald 🌙 Toggle + AR / EN Toggle
 */
export function TopFilterBar() {
  const pathname = usePathname()
  const { locale, setLocale } = useI18n()
  const isAr = locale === 'ar'
  const { filters, workspace, setPeriod, setBrand, setBranch, setChannel, resetFilters } = useGlobalFilter()

  if (!pathname || !BRAIN_BAR_ROUTES.has(pathname)) return null

  const showPosFilters = POS_FILTER_ROUTES.has(pathname)

  return (
    <section
      aria-label={isAr ? 'شريط التحكم التنفيذي الموحد' : 'Unified Executive Control Bar'}
      dir={isAr ? 'rtl' : 'ltr'}
      className="no-print relative z-30 flex flex-wrap items-center justify-between gap-2.5"
    >
      {/* Start Group: Global Filters + Verdelo Period SlidingPillTabs */}
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

            <PillDropdown
              label={isAr ? 'المطعم' : 'Brand'}
              value={filters.brand}
              defaultValue="all"
              compactDefaultLabel={isAr ? 'الكل' : 'All'}
              options={GLOBAL_BRAND_OPTIONS}
              isAr={isAr}
              onChange={setBrand}
            />

            <PillDropdown
              label={isAr ? 'الفرع' : 'Branch'}
              value={filters.branch}
              defaultValue="all"
              compactDefaultLabel={isAr ? 'الكل' : 'All'}
              options={GLOBAL_BRANCH_OPTIONS}
              isAr={isAr}
              onChange={setBranch}
            />

            <PillDropdown
              label={isAr ? 'القناة' : 'Channel'}
              value={filters.channel}
              defaultValue="all"
              compactDefaultLabel={isAr ? 'الكل' : 'All'}
              options={GLOBAL_CHANNEL_OPTIONS}
              isAr={isAr}
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
            <span>{isAr ? 'حاسبة المعارض الموسمية · EXB' : 'Seasonal Booths Calculator · EXB'}</span>
          </div>
        )}
      </div>

      {/* End Group: Dual-Brain Switcher + Grok Ultra + Gear + Theme Toggle + AR/EN */}
      <div className="flex flex-wrap items-center gap-1.5">
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
    </section>
  )
}
