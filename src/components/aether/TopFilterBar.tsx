'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  GLOBAL_BRANCH_OPTIONS,
  GLOBAL_BRAND_OPTIONS,
  GLOBAL_CHANNEL_OPTIONS,
  GLOBAL_PERIOD_OPTIONS,
  type FilterOption,
} from '@/lib/aether/global-filter-engine'

/** Routes where the global top filter bar is prominently displayed. */
const TOP_FILTER_ROUTES = new Set(['/erp', '/erp/feryal-ai', '/erp/aggregator-radar'])

function PillDropdown<T extends string>({
  label,
  value,
  defaultValue,
  options,
  isAr,
  onChange,
}: {
  label: string
  value: T
  defaultValue: T
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

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex h-10 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900/80 dark:bg-[#0F1626] ${
          open || isActive
            ? 'text-neutral-950 ring-1 ring-neutral-900/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:text-white dark:ring-white/70'
            : 'text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] hover:text-neutral-950 hover:ring-neutral-950/15 dark:text-slate-200 dark:ring-white/[0.08]'
        }`}
      >
        <span className="text-[11.5px] font-medium text-neutral-400 dark:text-slate-400">{label}:</span>
        <span className="whitespace-nowrap font-bold">{isAr ? selected.ar : selected.en}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-150 ${open ? 'rotate-180 text-neutral-900 dark:text-white' : ''}`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute start-0 z-50 mt-2 max-h-80 min-w-[210px] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.04)] ring-1 ring-neutral-950/[0.06] dark:bg-[#0F1626] dark:ring-white/[0.08]"
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
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start text-[13px] transition-colors duration-150 ${
                  chosen
                    ? 'bg-neutral-900 font-bold text-white dark:bg-white dark:text-neutral-950'
                    : 'font-medium text-neutral-700 hover:bg-neutral-100/80 hover:text-neutral-950 dark:text-slate-200 dark:hover:bg-white/[0.06]'
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

export function TopFilterBar() {
  const pathname = usePathname()
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { filters, workspace, setPeriod, setBrand, setBranch, setChannel, resetFilters } = useGlobalFilter()

  if (!pathname || !TOP_FILTER_ROUTES.has(pathname)) return null

  const salesFormatted =
    workspace.salesKwd >= 100
      ? Math.round(workspace.salesKwd).toLocaleString('en-US')
      : workspace.salesKwd.toFixed(1)

  return (
    <section
      aria-label={isAr ? 'شريط الفلاتر العلوي' : 'Global Filter Bar'}
      dir={isAr ? 'rtl' : 'ltr'}
      className="no-print relative z-30 flex flex-wrap items-center justify-between gap-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* 1. الفترة (Period segmented pills) */}
        <div
          role="tablist"
          aria-label={isAr ? 'الفترة' : 'Period'}
          className="inline-flex h-10 items-center gap-1 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.08]"
        >
          {GLOBAL_PERIOD_OPTIONS.map((p) => {
            const active = filters.period === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(p.id)}
                className={`h-8 rounded-full px-3.5 text-[13px] font-bold transition-all duration-150 focus:outline-none ${
                  active
                    ? 'bg-neutral-950 text-white ring-1 ring-neutral-900/80 shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 hover:bg-neutral-100/70 hover:text-neutral-950 dark:text-slate-300 dark:hover:bg-white/[0.06]'
                }`}
              >
                {isAr ? p.ar : p.en}
              </button>
            )
          })}
        </div>

        {/* 2. المطعم (Brand pill dropdown) */}
        <PillDropdown
          label={isAr ? 'المطعم' : 'Brand'}
          value={filters.brand}
          defaultValue="all"
          options={GLOBAL_BRAND_OPTIONS}
          isAr={isAr}
          onChange={setBrand}
        />

        {/* 3. الفرع (Branch pill dropdown) */}
        <PillDropdown
          label={isAr ? 'الفرع' : 'Branch'}
          value={filters.branch}
          defaultValue="all"
          options={GLOBAL_BRANCH_OPTIONS}
          isAr={isAr}
          onChange={setBranch}
        />

        {/* 4. القناة (Channel pill dropdown) */}
        <PillDropdown
          label={isAr ? 'القناة' : 'Channel'}
          value={filters.channel}
          defaultValue="all"
          options={GLOBAL_CHANNEL_OPTIONS}
          isAr={isAr}
          onChange={setChannel}
        />

        {/* 1-click Reset button whenever any non-default filter is selected */}
        {workspace.isFiltered ? (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 text-[12.5px] font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-900/80 transition-all duration-150 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            <span>{isAr ? 'عرض الكل ✕' : 'Reset ✕'}</span>
          </button>
        ) : null}
      </div>

      {/* Crisp live POS readout pill */}
      <div className="inline-flex h-10 items-center gap-3 rounded-full bg-white px-4 text-[12.5px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.08]">
        <span className="inline-flex items-center gap-1.5 font-medium text-neutral-500 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {isAr ? 'المبيعات:' : 'Sales:'}
          <strong className="font-extrabold tabular-nums text-neutral-950 dark:text-white">
            {salesFormatted} {isAr ? 'د.ك' : 'KWD'}
          </strong>
        </span>
        <span className="h-3.5 w-px bg-neutral-200 dark:bg-white/10" aria-hidden />
        <span className="font-medium text-neutral-500 dark:text-slate-400">
          {isAr ? 'الطلبات:' : 'Orders:'}{' '}
          <strong className="font-extrabold tabular-nums text-neutral-950 dark:text-white">
            {workspace.orders.toLocaleString('en-US')}
          </strong>
        </span>
      </div>
    </section>
  )
}
