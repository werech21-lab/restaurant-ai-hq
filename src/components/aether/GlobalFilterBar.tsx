'use client'

import { usePathname } from 'next/navigation'
import { Filter, RotateCcw, X } from 'lucide-react'
import { BRANDS, BRANCHES, CHANNELS, LEDGER, PERIODS, kwd, fmt, type BranchId, type BrandId, type ChannelId } from '@/lib/aether/ledger'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Num, useLang } from '@/components/aether/ui'

/** Routes that consume the live BI context. */
export const BI_ROUTES = ['/erp/delivery-control']

export function isBiRoute(pathname: string | null) {
  if (!pathname) return false
  return BI_ROUTES.some((r) => pathname === r || (r !== '/erp' && pathname.startsWith(`${r}/`)))
}

export function GlobalFilterBar() {
  const pathname = usePathname()
  const { filters, view, setBrand, setBranch, setChannel, setPeriod, reset } = useBiFilters()
  const { lang, isAr, T } = useLang()

  if (!isBiRoute(pathname)) return null

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
      <div className="ae-tile flex flex-wrap items-center gap-2.5 px-4 py-3">
        <span className="ae-icon-badge h-8 w-8">
          <Filter className="h-3.5 w-3.5" />
        </span>
        <div className="me-1 hidden min-w-0 flex-col leading-tight lg:flex">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{T('Live BI context', 'سياق التحليل المباشر')}</span>
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            {T('6 Brands • 7 Branches • 8 Channels', '6 مطاعم • 7 فروع • 8 قنوات')}
          </span>
        </div>

        <select aria-label={T('Brand', 'العلامة التجارية')} className="ae-select" value={filters.brand} onChange={(e) => setBrand(e.target.value as BrandId | 'all')}>
          <option value="all">{T('All 6 brands', 'كل المطاعم الـ 6')}</option>
          {BRANDS.map((b) => (
            <option key={b.id} value={b.id}>
              {isAr ? b.ar : b.en}
            </option>
          ))}
        </select>

        <select aria-label={T('Branch', 'الفرع')} className="ae-select" value={filters.branch} onChange={(e) => setBranch(e.target.value as BranchId | 'all')}>
          <option value="all">{T(`All ${LEDGER.branches} restaurant locations`, `كل مواقع المطاعم الـ ${LEDGER.branches}`)}</option>
          {BRANCHES.map((b) => (
            <option key={b.id} value={b.id}>
              {isAr ? b.ar : b.en}
            </option>
          ))}
        </select>

        <select aria-label={T('Sales channel', 'قناة البيع')} className="ae-select" value={filters.channel} onChange={(e) => setChannel(e.target.value as ChannelId | 'all')}>
          <option value="all">{T(`All ${LEDGER.channels} channels`, `كل القنوات الـ ${LEDGER.channels}`)}</option>
          {CHANNELS.map((c) => (
            <option key={c.id} value={c.id}>
              {isAr ? c.ar : c.en}
            </option>
          ))}
        </select>

        <div className="ae-seg" role="tablist" aria-label={T('Period', 'الفترة')}>
          {PERIODS.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={filters.period === p.id} data-active={filters.period === p.id} onClick={() => setPeriod(p.id)}>
              {isAr ? p.ar : p.en}
            </button>
          ))}
        </div>

        <div className="ms-auto flex items-center gap-2 text-xs">
          <span className="hidden text-slate-500 dark:text-slate-400 sm:inline">{T('Slice net sales', 'مبيعات الشريحة')}</span>
          <Num className="text-sm text-slate-900 dark:text-slate-50">{kwd(view.netSales, lang, view.period === 'daily' ? 3 : 0)}</Num>
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="ae-pop flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span key={c.key} className="ae-chip">
              {c.label}
              <button type="button" onClick={c.clear} aria-label={T('Remove filter', 'إزالة الفلتر')} className="rounded-full p-0.5 hover:bg-white/60">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={reset} className="ae-pill-dark ae-pill-sm">
            <RotateCcw className="h-3 w-3" />
            {T('Reset to Full Group Ledger', 'العودة إلى دفتر المجموعة الكامل')}
          </button>
          {view.filtered ? (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {T(
                `Proportional allocation of the Odoo group ledger · ${fmt(view.salesShare * 100, 2)}% of group sales`,
                `توزيع نسبي من دفتر أودو للمجموعة · ${fmt(view.salesShare * 100, 2)}% من مبيعات المجموعة`,
              )}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
