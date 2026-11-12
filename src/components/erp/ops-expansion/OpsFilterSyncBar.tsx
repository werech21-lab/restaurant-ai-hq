'use client'

import React from 'react'
import { RotateCcw } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  GLOBAL_BRANCH_OPTIONS,
  GLOBAL_BRAND_OPTIONS,
  GLOBAL_CHANNEL_OPTIONS,
  isNonDefaultFilter,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
} from '@/lib/aether/global-filter-engine'

const SELECT_CLS =
  'h-9 cursor-pointer rounded-full bg-[#F7F7F8] px-3.5 text-[12.5px] font-semibold text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:bg-neutral-200/70 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-neutral-950 dark:text-neutral-200'

export function OpsFilterSyncBar() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { filters, workspace, setBrand, setBranch, setChannel, resetFilters } = useGlobalFilter()
  const hasCustom = isNonDefaultFilter(filters)

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-bold text-neutral-500 dark:text-neutral-400">
          {isAr ? 'النطاق المتزامن:' : 'Active Scope:'}
        </span>

        <select
          aria-label={isAr ? 'البراند' : 'Brand'}
          value={filters.brand}
          onChange={(e) => setBrand(e.target.value as GlobalBrand)}
          className={SELECT_CLS}
        >
          {GLOBAL_BRAND_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {isAr ? opt.ar : opt.en}
            </option>
          ))}
        </select>

        <select
          aria-label={isAr ? 'الفرع' : 'Branch'}
          value={filters.branch}
          onChange={(e) => setBranch(e.target.value as GlobalBranch)}
          className={SELECT_CLS}
        >
          {GLOBAL_BRANCH_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {isAr ? opt.ar : opt.en}
            </option>
          ))}
        </select>

        <select
          aria-label={isAr ? 'القناة' : 'Channel'}
          value={filters.channel}
          onChange={(e) => setChannel(e.target.value as GlobalChannel)}
          className={SELECT_CLS}
        >
          {GLOBAL_CHANNEL_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {isAr ? opt.ar : opt.en}
            </option>
          ))}
        </select>

        {hasCustom && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full bg-emerald-50 px-3 text-[12px] font-bold text-emerald-800 transition hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isAr ? 'إعادة ضبط' : 'Reset'}
          </button>
        )}
      </div>

      <div className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400">
        {isAr ? workspace.subtitleAr : workspace.subtitleEn}
      </div>
    </div>
  )
}
