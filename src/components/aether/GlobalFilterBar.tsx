'use client'

import { usePathname } from 'next/navigation'
import { Filter, RotateCcw, X } from 'lucide-react'
import { BRANDS, BRANCHES, CHANNELS, LEDGER, PERIODS, type BranchId, type BrandId, type ChannelId } from '@/lib/aether/ledger'
import { formatKwd, formatPct, getUnavailableTooltip } from '@/lib/format'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Num, useLang } from '@/components/aether/ui'

/** Routes that consume the live BI context. */
export const BI_ROUTES: string[] = []

export function isBiRoute(pathname: string | null) {
  if (!pathname) return false
  return BI_ROUTES.some((r) => pathname === r || (r !== '/erp' && pathname.startsWith(`${r}/`)))
}

export function GlobalFilterBar() {
  const pathname = usePathname()
  const { filters, view, setBrand, setBranch, setChannel, setPeriod, reset } = useBiFilters()
  const { isAr, T } = useLang()
  const locale = isAr ? 'ar' : 'en'
  const unavailableLabel = getUnavailableTooltip(locale)

  if (!isBiRoute(pathname)) return null
  // The static BI ledger is unlinked (no brands / branches / channels): a bar of «All 0 …» selectors and a
  // 0.000 slice would contradict the page. Nothing to filter → no bar.
  if (BRANDS.length === 0 && BRANCHES.length === 0 && CHANNELS.length === 0) return null

  const brand = BRANDS.find((b) => b.id === filters.brand)
  const branch = BRANCHES.find((b) => b.id === filters.branch)
  const channel = CHANNELS.find((c) => c.id === filters.channel)
  const chips = [
    brand ? { key: 'brand', label: isAr ? brand.ar : brand.en, clear: () => setBrand('all') } : null,
    branch ? { key: 'branch', label: isAr ? branch.ar : branch.en, clear: () => setBranch('all') } : null,
    channel ? { key: 'channel', label: isAr ? channel.ar : channel.en, clear: () => setChannel('all') } : null,
    filters.period !== 'monthly'
      ? { key: 'period', label: isAr ? PERIODS.find((p) => p.id === filters.period)!.ar : PERIODS.find((p) => p.id === filters.period)!.en, clear: () => setPeriod('monthly') }
      : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]

  return (
    <div className="ae-filterbar no-print space-y-3" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="ae-tile flex flex-wrap items-center gap-2.5 rounded-[24px] bg-white/80 px-4 py-3 backdrop-blur-xl ring-1 ring-slate-400/25 dark:bg-[#0F1A30]/80 dark:ring-sky-400/20">
        <span className="ae-icon-badge h-8 w-8 rounded-full bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:bg-sky-400/15 dark:text-sky-300 dark:ring-sky-400/25">
          <Filter className="h-3.5 w-3.5" />
        </span>
        <div className="me-1 hidden min-w-0 flex-col leading-tight lg:flex">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{T('Odoo 17 BI context', 'سياق بيانات Odoo 17')}</span>
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            {T('6 Brands • 7 Branches • 8 Channels', '6 علامات تجارية • 7 فروع • 8 قنوات')}
          </span>
        </div>

        <select aria-label={T('Brand', 'العلامة التجارية')} className="ae-select v35-focus-ring rounded-full bg-white/85 backdrop-blur-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0F1A30]/85 dark:focus-visible:ring-sky-400/60" value={filters.brand} onChange={(e) => setBrand(e.target.value as BrandId | 'all')}>
          <option value="all">{T('All 6 brands', 'كل العلامات التجارية الـ 6')}</option>
          {BRANDS.map((b) => (
            <option key={b.id} value={b.id}>
              {isAr ? b.ar : b.en}
            </option>
          ))}
        </select>

        <select aria-label={T('Branch', 'الفرع')} className="ae-select v35-focus-ring rounded-full bg-white/85 backdrop-blur-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0F1A30]/85 dark:focus-visible:ring-sky-400/60" value={filters.branch} onChange={(e) => setBranch(e.target.value as BranchId | 'all')}>
          <option value="all">{T(`All ${LEDGER.branches} restaurant locations`, `كل مواقع المطاعم الـ ${LEDGER.branches}`)}</option>
          {BRANCHES.map((b) => (
            <option key={b.id} value={b.id}>
              {isAr ? b.ar : b.en}
            </option>
          ))}
        </select>

        <select aria-label={T('Sales channel', 'قناة البيع')} className="ae-select v35-focus-ring rounded-full bg-white/85 backdrop-blur-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0F1A30]/85 dark:focus-visible:ring-sky-400/60" value={filters.channel} onChange={(e) => setChannel(e.target.value as ChannelId | 'all')}>
          <option value="all">{T(`All ${LEDGER.channels} channels`, `كل القنوات الـ ${LEDGER.channels}`)}</option>
          {CHANNELS.map((c) => (
            <option key={c.id} value={c.id}>
              {isAr ? c.ar : c.en}
            </option>
          ))}
        </select>

        <div className="ae-seg rounded-full bg-blue-50/80 p-1 ring-1 ring-slate-400/20 dark:bg-[#0C1528]/85 dark:ring-sky-400/15" role="tablist" aria-label={T('Period', 'الفترة')}>
          {PERIODS.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={filters.period === p.id} data-active={filters.period === p.id} className="v35-focus-ring cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60" onClick={() => setPeriod(p.id)}>
              {isAr ? p.ar : p.en}
            </button>
          ))}
        </div>

        <div className="ms-auto flex items-center gap-2 text-xs">
          <span className="hidden text-slate-600 dark:text-slate-300 sm:inline">{T('Slice net sales', 'مبيعات الشريحة')}</span>
          <Num
            className="text-sm text-slate-900 dark:text-slate-50"
          >
            <span
              title={view.netSales == null ? unavailableLabel : undefined}
              data-unavailable={view.netSales == null ? 'true' : undefined}
            >
              {formatKwd(view.netSales, { locale })}
            </span>
          </Num>
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="ae-pop flex flex-wrap items-center gap-2 rounded-full bg-white/75 px-3.5 py-2 backdrop-blur-md ring-1 ring-slate-400/20 dark:bg-[#0F1A30]/75 dark:ring-sky-400/20">
          {chips.map((c) => (
            <span key={c.key} className="ae-chip inline-flex items-center gap-1.5 rounded-full bg-blue-100/80 px-3 py-1 text-xs font-semibold text-blue-900 backdrop-blur-sm ring-1 ring-blue-400/25 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25">
              {c.label}
              <button type="button" onClick={c.clear} aria-label={T('Remove filter', 'إزالة الفلتر')} className="v35-focus-ring cursor-pointer rounded-full p-0.5 transition-colors hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:bg-white/15 dark:focus-visible:ring-sky-400/60">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={reset} className="btn-colored v35-focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.42)] transition-all hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-sky-400 dark:text-[#081226] dark:hover:bg-sky-300 dark:focus-visible:ring-sky-400/60">
            <RotateCcw className="h-3 w-3" />
            {T('Reset to Full Group Ledger', 'العودة إلى دفتر المجموعة الكامل')}
          </button>
          {view.filtered ? (
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {T('Proportional allocation of the Odoo group ledger · ', 'توزيع نسبي من دفتر أودو للمجموعة · ')}
              <span dir="ltr" className="tabular-nums">
                {formatPct(view.salesShare * 100, { locale, decimals: 2 })}
              </span>
              {T(' of group sales', ' من مبيعات المجموعة')}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
