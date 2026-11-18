'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Globe,
  Lock,
  LogOut,
  Moon,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Unlock,
  X,
} from 'lucide-react'
import { useI18n, type Locale } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import {
  resolveExecRoleProfile,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import { resolveRoleDefaultHome } from '@/lib/auth/role-access-policy'
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
import { AdminExecutiveDirectoryCard } from '@/components/erp/AdminExecutiveDirectoryCard'
import { OdooPartialWarningBanner } from '@/components/erp/OdooPartialWarningBanner'
import { RAIL_TOGGLE_EVENT } from '@/components/erp-sidebar'
import { routeTitle } from '@/lib/aether/route-titles'
import {
  formatPeriodCalendarWindow,
  GLOBAL_KUWAIT_SLICE_OPTIONS,
  GLOBAL_PERIOD_OPTIONS,
  GLOBAL_PROFIT_LENS_OPTIONS,
  type FilterOption,
  type GlobalPeriod,
} from '@/lib/aether/global-filter-engine'
import { getKuwaitTimeContext } from '@/lib/aether/period-delta'
import { formatPct } from '@/lib/format'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export const ERP_SUBTAB_EVENT = 'aether:erp-subtab'
export type ErpOverviewSubtab = 'summary' | 'plays'

const ROUTES_WITH_OWN_PARTIAL_BANNER = new Set([
  '/erp',
  '/erp/cores',
  '/erp/sales-analysis',
  '/erp/menu-engineering',
  '/erp/aggregator-radar',
  '/erp/commissions',
  '/erp/sales-scorecard',
  '/erp/executive-pnl',
  '/erp/receivables',
  '/erp/brand-sales-analytics',
  '/erp/weekday-comparison',
  '/erp/before-after',
  '/erp/feryal-ai',
  '/erp/cost-intelligence',
  '/erp/warehouse-chain',
])

const ROUTES_WITH_OWN_H1 = new Set([
  '/erp/alerts',
  '/erp/cost-intelligence',
  '/erp/ledger',
  '/erp/odoo-sync',
])

/** Routes that display the 5D POS & ledger filters (Period incl. Custom + Unified Filters Popover). */
export const POS_FILTER_ROUTES = new Set([
  '/erp',
  '/erp/cores',
  '/erp/weekday-comparison',
  '/erp/before-after',
  '/erp/warehouse-chain',
  '/erp/aggregator-radar',
  '/erp/commissions',
  '/erp/feryal-ai',
  '/erp/feryal',
  '/erp/planning',
  '/erp/booth-feasibility',
  '/erp/booth',
  '/erp/events-intelligence',
  '/erp/receivables',
  '/erp/executive-pnl',
  '/erp/sales-scorecard',
  '/erp/sales-analysis',
  '/erp/menu-engineering',
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

function computeCustomSpanDays(fromIso: string, toIso: string): number {
  const m1 = /^\d{4}-\d{2}-\d{2}$/.test(fromIso)
  const m2 = /^\d{4}-\d{2}-\d{2}$/.test(toIso)
  if (!m1 || !m2) return 1
  const a = new Date(`${fromIso}T00:00:00Z`).getTime()
  const b = new Date(`${toIso}T00:00:00Z`).getTime()
  const diff = Math.round(Math.abs(b - a) / 86_400_000) + 1
  return Number.isFinite(diff) && diff > 0 ? diff : 1
}

function shiftCalendarIso(baseIso: string, deltaDays: number): string {
  const ms = Date.parse(`${baseIso}T12:00:00Z`)
  if (!Number.isFinite(ms)) return baseIso
  return new Date(ms + deltaDays * 86_400_000).toISOString().slice(0, 10)
}

function PeriodDropdownPopover({
  isAr,
  activePeriod,
  draftFrom,
  draftTo,
  liveSummary,
  onSelectPeriod,
  onChangeFrom,
  onChangeTo,
  onApplyCustomRange,
  onOpenScopeFilters,
  onClose,
}: {
  isAr: boolean
  activePeriod: GlobalPeriod
  draftFrom: string
  draftTo: string
  liveSummary?: OdooLiveSummary | null
  onSelectPeriod: (next: GlobalPeriod) => void
  onChangeFrom: (val: string) => void
  onChangeTo: (val: string) => void
  onApplyCustomRange: () => void
  onOpenScopeFilters?: () => void
  onClose: () => void
}) {
  const spanDays = computeCustomSpanDays(draftFrom, draftTo)

  return (
    <div
      role="listbox"
      aria-label={isAr ? 'الفترة الزمنية' : 'Time Period'}
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-[min(92vw,336px)] space-y-2 rounded-3xl bg-white/90 p-3.5 text-slate-800 backdrop-blur-xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-slate-400/25 dark:bg-[#0F1A30]/95 dark:text-slate-100 dark:shadow-[0_20px_50px_-12px_rgba(2,6,23,0.75)] dark:ring-sky-400/25"
    >
      <div className="px-1 text-xs font-bold tracking-tight text-slate-600 dark:text-slate-300">
        {isAr ? 'اختر الفترة الزمنية ونطاق التاريخ' : 'Select Time Period & Date Window'}
      </div>

      <div className="space-y-1">
        {GLOBAL_PERIOD_OPTIONS.map((p) => {
          const active = p.id === activePeriod
          const label = cleanPeriodOptionLabel(p.id, isAr ? p.ar : p.en, isAr)
          const optWindow = formatPeriodCalendarWindow(p.id, {
            customFrom: draftFrom,
            customTo: draftTo,
            liveSummary,
          })
          const rangeText = isAr ? optWindow.labelAr : optWindow.labelEn
          return (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onSelectPeriod(p.id)
                if (p.id !== 'custom') {
                  onClose()
                }
              }}
              className={`v35-focus-ring flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl px-3 py-2 text-start text-[12.5px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
                active
                  ? 'bg-blue-50/95 text-blue-950 shadow-[0_2px_8px_-3px_rgba(37,99,235,0.22)] ring-1 ring-blue-500/35 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                  : 'text-slate-700 hover:bg-blue-50/60 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/[0.07] dark:hover:text-white'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span>{label}</span>
                <span
                  className={`ms-1.5 text-xs font-medium tabular-nums ${
                    active
                      ? 'text-blue-700 dark:text-sky-200'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ({rangeText})
                </span>
              </span>
              {active ? <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-sky-300" /> : null}
            </button>
          )
        })}
      </div>

      {activePeriod === 'custom' ? (
        <div className="space-y-2 border-t border-slate-300/40 pt-2.5 dark:border-sky-300/15">
          <div className="flex items-center justify-between gap-1.5">
            <span className="rounded-full bg-blue-50/90 px-2.5 py-0.5 text-xs font-bold text-blue-800 ring-1 ring-blue-400/25 tabular-nums dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25">
              {isAr ? `${spanDays} يوم` : `${spanDays} Days`}
            </span>
            <div className="flex items-center gap-1">
              {(() => {
                const anchorToIso =
                  liveSummary?.latestOperationalDate &&
                  /^\d{4}-\d{2}-\d{2}$/.test(liveSummary.latestOperationalDate)
                    ? liveSummary.latestOperationalDate
                    : getKuwaitTimeContext().yesterdayIso
                return [
                  { label: '7d', from: shiftCalendarIso(anchorToIso, -6), to: anchorToIso },
                  { label: '14d', from: shiftCalendarIso(anchorToIso, -13), to: anchorToIso },
                  { label: '30d', from: shiftCalendarIso(anchorToIso, -29), to: anchorToIso },
                ]
              })().map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => {
                    onChangeFrom(q.from)
                    onChangeTo(q.to)
                  }}
                  className="v35-focus-ring cursor-pointer rounded-full bg-blue-50/75 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/20 transition-colors hover:bg-blue-100/80 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10 dark:hover:bg-sky-400/20 dark:hover:text-sky-100 dark:focus-visible:ring-sky-400/60"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>{isAr ? 'من تاريخ' : 'From Date'}</span>
              <input
                type="date"
                dir="ltr"
                value={draftFrom}
                onChange={(e) => onChangeFrom(e.target.value)}
                className="v35-focus-ring h-9 w-full rounded-xl bg-blue-50/55 px-2.5 text-xs font-bold tabular-nums text-slate-900 ring-1 ring-slate-400/25 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0B1427]/90 dark:text-white dark:ring-sky-400/20 dark:focus-visible:ring-sky-400/60"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>{isAr ? 'إلى تاريخ' : 'To Date'}</span>
              <input
                type="date"
                dir="ltr"
                value={draftTo}
                onChange={(e) => onChangeTo(e.target.value)}
                className="v35-focus-ring h-9 w-full rounded-xl bg-blue-50/55 px-2.5 text-xs font-bold tabular-nums text-slate-900 ring-1 ring-slate-400/25 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0B1427]/90 dark:text-white dark:ring-sky-400/20 dark:focus-visible:ring-sky-400/60"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              onApplyCustomRange()
              onClose()
            }}
            className="btn-colored v35-focus-ring inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-bold text-white shadow-[0_6px_16px_-4px_rgba(37,99,235,0.42)] transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-sky-400 dark:text-[#081226] dark:hover:bg-sky-300 dark:focus-visible:ring-sky-400/60"
          >
            {isAr ? 'تطبيق الفترة المخصصة' : 'Apply Custom Range'}
          </button>
          {onOpenScopeFilters ? (
            <button
              type="button"
              onClick={() => {
                onApplyCustomRange()
                onClose()
                onOpenScopeFilters()
              }}
              className="v35-focus-ring inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-full bg-blue-50/75 px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/20 transition-colors hover:bg-blue-100/80 hover:text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10 dark:hover:bg-sky-400/15 dark:hover:text-sky-100 dark:focus-visible:ring-sky-400/60"
            >
              {isAr ? 'تحديد المطاعم والفروع مع الفترة ▸' : 'Pair with Brand & Branch Filters ▸'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function EmeraldPillTabs<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string
  value: T
  options: readonly { id: T; label: string; title?: string }[]
  onChange: (next: T) => void
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-full bg-blue-50/75 p-1 ring-1 ring-slate-400/20 select-none dark:bg-[#0B1427]/85 dark:ring-sky-400/15"
    >
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            title={opt.title}
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`v35-focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
              active
                ? 'bg-white text-blue-800 shadow-[0_2px_8px_-2px_rgba(37,99,235,0.20)] ring-1 ring-blue-500/35 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                : 'text-slate-600 hover:bg-white/75 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white'
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
      <div className="text-xs font-bold tracking-tight text-slate-600 dark:text-slate-300">{label}</div>
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
              className={`v35-focus-ring inline-flex shrink-0 cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-start text-[12.5px] leading-snug whitespace-nowrap sm:whitespace-normal transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
                twoColGrid ? 'rounded-2xl' : 'rounded-full'
              } ${
                active
                  ? 'bg-blue-50/95 font-semibold text-blue-950 shadow-[0_2px_8px_-3px_rgba(37,99,235,0.22)] ring-1 ring-blue-500/35 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                  : 'bg-blue-50/45 font-medium text-slate-700 ring-1 ring-slate-400/20 hover:bg-blue-50/85 hover:text-slate-950 dark:bg-white/[0.05] dark:text-slate-200 dark:ring-white/[0.08] dark:hover:bg-sky-400/10'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {showHealthMeta && opt.healthDot ? (
                  <span className="shrink-0 text-xs leading-none" aria-hidden>
                    {opt.healthDot}
                  </span>
                ) : null}
                <span>{textLabel}</span>
              </span>

              {showHealthMeta && typeof opt.weightedNetPct === 'number' ? (
                <span
                  dir="ltr"
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                    active
                      ? 'bg-blue-100/90 text-blue-900 dark:bg-sky-300/20 dark:text-sky-100'
                      : 'bg-white/90 text-slate-600 ring-1 ring-slate-400/15 dark:bg-white/10 dark:text-slate-300'
                  }`}
                >
                  {formatPct(opt.weightedNetPct, { locale: isAr ? 'ar' : 'en' })}
                </span>
              ) : active ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-sky-300" />
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
  sessionRole,
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
  sessionRole?: ExecSessionRole
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
  const activeRole: ExecSessionRole = auditorMode
    ? 'auditor'
    : (sessionRole ?? gov?.sessionRole ?? 'admin')
  const roleProfile = resolveExecRoleProfile(activeRole)
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
      className="w-[min(92vw,330px)] space-y-2.5 rounded-3xl bg-white/90 p-3.5 text-slate-800 backdrop-blur-xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-slate-400/25 dark:bg-[#0F1A30]/95 dark:text-slate-100 dark:shadow-[0_20px_50px_-12px_rgba(2,6,23,0.75)] dark:ring-sky-400/25"
    >
      {/* Account Identity Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-300/40 pb-2.5 dark:border-sky-300/15">
        <div className="min-w-0">
          {auditorMode ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-xs font-bold text-slate-800 ring-1 ring-slate-400/30 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-400/25">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-400" />
              <span>{isAr ? roleProfile.accountLabelAr : roleProfile.accountLabelEn}</span>
            </span>
          ) : (
            <div className="space-y-0.5">
              <div className="text-[13px] font-bold text-slate-900 dark:text-white">
                {isAr ? roleProfile.accountLabelAr : roleProfile.accountLabelEn}
              </div>
              <div className="text-xs font-medium text-blue-700 dark:text-sky-300">
                {isAr ? roleProfile.titleAr : roleProfile.titleEn}
              </div>
            </div>
          )}
          {userEmail ? (
            <div
              dir="ltr"
              className="mt-0.5 break-all whitespace-normal font-mono text-xs text-slate-600 dark:text-slate-300"
            >
              {userEmail}
            </div>
          ) : null}
        </div>
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            auditorMode
              ? 'bg-slate-100/90 text-slate-700 ring-1 ring-slate-400/25 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-400/25'
              : 'bg-blue-50/90 text-blue-700 ring-1 ring-blue-400/25 dark:bg-sky-400/15 dark:text-sky-300 dark:ring-sky-400/25'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
        </span>
      </div>

      {/* 1. Notifications & Approvals (`الإشعارات والاعتمادات 🔔`) — displays pending count ONCE */}
      <button
        type="button"
        onClick={handleOpenNotifications}
        className="v35-focus-ring flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl bg-blue-50/65 px-3 py-2.5 text-start text-[12.5px] font-semibold text-slate-800 ring-1 ring-slate-400/15 transition-colors hover:bg-blue-100/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#13203B]/80 dark:text-slate-100 dark:ring-sky-400/15 dark:hover:bg-sky-400/15 dark:focus-visible:ring-sky-400/60"
      >
        <span className="inline-flex items-center gap-2">
          <Bell
            className={`h-4 w-4 shrink-0 ${
              hasBreaches
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-blue-600 dark:text-sky-400'
            }`}
          />
          <span>
            {isAr ? 'الإشعارات والاعتمادات 🔔' : 'Notifications & Approvals 🔔'}
          </span>
        </span>
        <span
          dir="ltr"
          style={badgeCount > 0 ? { color: '#FFFFFF' } : undefined}
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${
            badgeCount > 0
              ? hasBreaches
                ? 'btn-colored bg-rose-700 text-white'
                : 'btn-colored bg-blue-600 text-white dark:bg-blue-500'
              : 'bg-blue-100/80 text-blue-800 dark:bg-sky-400/15 dark:text-sky-200'
          }`}
        >
          {badgeCount}
        </span>
      </button>

      {/* 2. Role / Manager PIN Control (Executive PIN unlock vs Auditor Read-Only badge) */}
      {auditorMode ? (
        <div data-auditor-badge="drawer" className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 bg-slate-100 text-slate-700 ring-1 ring-slate-300/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold">
            <Lock className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300" />
            <span>{isAr ? 'حساب مراجعة — قراءة فقط' : 'Read-Only Auditor'}</span>
          </div>
          <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/20 dark:bg-white/10 dark:text-slate-200">
            {isAr ? 'مقفل' : 'Disabled'}
          </span>
        </div>
      ) : gov ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-blue-50/65 px-3 py-2.5 ring-1 ring-slate-400/15 dark:bg-[#13203B]/80 dark:ring-sky-400/15">
          {gov.session.active ? (
            <>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-sky-300">
                  <Unlock className="h-3.5 w-3.5 shrink-0" />
                  <span>{isAr ? 'صلاحية المدير نشطة' : 'Manager Session Active'}</span>
                </div>
                <div
                  dir="ltr"
                  className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300"
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
                className="v35-focus-ring inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-white/90 px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/25 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0F1A30] dark:text-slate-200 dark:ring-sky-400/20 dark:hover:bg-white/[0.08] dark:focus-visible:ring-sky-400/60"
              >
                <Lock className="h-3 w-3" />
                <span>{isAr ? 'قفل' : 'Lock'}</span>
              </button>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                <Lock className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-sky-400" />
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
                className="btn-colored v35-focus-ring inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-blue-600 px-3.5 text-xs font-bold text-white shadow-[0_4px_12px_-3px_rgba(37,99,235,0.4)] transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-sky-400 dark:text-[#081226] dark:hover:bg-sky-300 dark:focus-visible:ring-sky-400/60"
              >
                <Unlock className="h-3 w-3" />
                <span>{isAr ? 'تفعيل' : 'Unlock'}</span>
              </button>
            </>
          )}
        </div>
      ) : null}

      {/* 3. Theme Switcher (`الوضع النهاري / الليلي`) — mobile/tablet & `< 1280px` desktop menu */}
      <div className="flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5 xl:hidden">
        <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
          {isAr ? 'الوضع النهاري / الليلي' : 'Light / Dark Theme'}
        </span>
        <ThemeToggle />
      </div>

      {/* 4. Single Language Toggle (`Language: العربية | English`) */}
      <div className="flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200">
          <Globe className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
          <span>{isAr ? 'اللغة:' : 'Language:'}</span>
        </span>
        <div
          dir="ltr"
          data-no-translate=""
          className="inline-flex items-center gap-1 rounded-full bg-blue-50/80 p-1 ring-1 ring-slate-400/20 dark:bg-[#0B1427]/85 dark:ring-sky-400/15"
        >
          <button
            type="button"
            onClick={() => onSetLocale('ar')}
            className={`v35-focus-ring cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
              locale === 'ar'
                ? 'bg-white text-blue-800 shadow-xs ring-1 ring-blue-500/30 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            العربية
          </button>
          <button
            type="button"
            onClick={() => onSetLocale('en')}
            className={`v35-focus-ring cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
              locale === 'en'
                ? 'bg-white text-blue-800 shadow-xs ring-1 ring-blue-500/30 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="border-t border-slate-300/40 pt-1.5 dark:border-sky-300/15">
        {/* 5. WhatsApp Executive Summary Share (`مشاركة التقرير عبر واتساب`) */}
        <button
          type="button"
          onClick={onShareWhatsApp}
          title={isAr ? 'مشاركة التقرير عبر واتساب' : 'Share Report via WhatsApp'}
          className="v35-focus-ring flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-[13px] font-medium text-slate-700 transition-colors hover:bg-blue-50/75 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:text-slate-200 dark:hover:bg-sky-400/10 dark:hover:text-white dark:focus-visible:ring-sky-400/60"
        >
          <span className="inline-flex items-center gap-2">
            {sharedCopied ? (
              <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-sky-400" />
            ) : (
              <Share2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-sky-400" />
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

      {/* 6. Quick Command Search (`ابحث… ⌘K`) */}
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="v35-focus-ring flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-[13px] font-medium text-slate-700 transition-colors hover:bg-blue-50/75 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:text-slate-200 dark:hover:bg-sky-400/10 dark:hover:text-white dark:focus-visible:ring-sky-400/60"
        >
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />
            <span>{isAr ? 'ابحث…' : 'Search…'}</span>
          </span>
          <kbd
            dir="ltr"
            className="rounded-full bg-blue-50/90 px-2 py-0.5 font-mono text-xs font-bold text-slate-700 ring-1 ring-slate-400/25 dark:bg-white/[0.08] dark:text-sky-200 dark:ring-sky-400/20"
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Admin-Only 8-Role Executive Access Directory inside Account Drawer */}
      {activeRole === 'admin' && !auditorMode ? (
        <div className="border-t border-slate-300/40 pt-2 dark:border-sky-300/15">
          <AdminExecutiveDirectoryCard role={activeRole} compact />
        </div>
      ) : null}

      {/* 7. Real Sign Out (`تسجيل الخروج` / `Sign Out`) */}
      <div className="border-t border-slate-300/40 pt-1.5 dark:border-sky-300/15">
        <button
          type="button"
          disabled={signingOut}
          onClick={onSignOut}
          className="v35-focus-ring flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-[12.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950/40"
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
  sessionRole?: ExecSessionRole
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
  sessionRole,
  userEmail,
}: TopFilterBarProps = {}) {
  const pathname = usePathname() ?? ''
  const { locale, setLocale } = useI18n()
  const isAr = locale === 'ar'
  const isBrainBarRoute = Boolean(
    pathname && (BRAIN_BAR_ROUTES.has(pathname) || pathname.startsWith('/erp')),
  )

  useDocumentTitle(pathname, isAr, isBrainBarRoute)

  const { theme, toggleTheme } = useTheme()

  const {
    filters,
    workspace,
    liveSummary,
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
      sessionRole === 'auditor' ||
      liveSummary?.readOnly === true ||
      gov?.isAuditor ||
      (typeof userEmail === 'string' && userEmail.toLowerCase().includes('auditor')),
  )
  const topRoleProfile = resolveExecRoleProfile(auditorMode ? 'auditor' : sessionRole)
  const execAvatarInitials = auditorMode
    ? isAr
      ? 'م'
      : 'AU'
    : topRoleProfile.role === 'gm'
      ? isAr
        ? 'م.ع'
        : 'GM'
      : topRoleProfile.role === 'dgm'
        ? isAr
          ? 'ن.م'
          : 'DG'
        : topRoleProfile.role === 'ops'
          ? isAr
            ? 'م.عم'
            : 'OP'
          : topRoleProfile.role === 'cfo'
            ? isAr
              ? 'م.م'
              : 'CF'
            : topRoleProfile.role === 'marketing'
              ? isAr
                ? 'ت.س'
                : 'MK'
              : topRoleProfile.role === 'supply'
                ? isAr
                  ? 'م.إ'
                  : 'SP'
                : isAr
                  ? 'ع.ع'
                  : 'AA'

  const [sharedCopied, setSharedCopied] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false)
  const [filtersPopoverOpen, setFiltersPopoverOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [draftFrom, setDraftFrom] = useState(filters.customFrom)
  const [draftTo, setDraftTo] = useState(filters.customTo)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDarkTheme = mounted ? theme === 'dark' : false

  const desktopBarRef = useRef<HTMLDivElement>(null)
  const mobileBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraftFrom(filters.customFrom)
    setDraftTo(filters.customTo)
  }, [filters.customFrom, filters.customTo])

  useEffect(() => {
    setMobileSheetOpen(false)
    setPeriodDropdownOpen(false)
    setFiltersPopoverOpen(false)
    setAccountMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileSheetOpen && !periodDropdownOpen && !filtersPopoverOpen && !accountMenuOpen) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSheetOpen(false)
        setPeriodDropdownOpen(false)
        setFiltersPopoverOpen(false)
        setAccountMenuOpen(false)
      }
    }
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (desktopBarRef.current && desktopBarRef.current.contains(target)) return
      if (mobileBarRef.current && mobileBarRef.current.contains(target)) return
      setPeriodDropdownOpen(false)
      setFiltersPopoverOpen(false)
      setAccountMenuOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      window.removeEventListener('keydown', onEsc)
      document.removeEventListener('mousedown', onDocMouseDown)
    }
  }, [accountMenuOpen, filtersPopoverOpen, mobileSheetOpen, periodDropdownOpen])

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

  const activePeriodMeta =
    GLOBAL_PERIOD_OPTIONS.find((p) => p.id === filters.period) ?? GLOBAL_PERIOD_OPTIONS[2]
  const activePeriodShortLabel = cleanPeriodOptionLabel(
    activePeriodMeta.id,
    isAr ? activePeriodMeta.ar : activePeriodMeta.en,
    isAr,
  )
  const activePeriodRangeText = isAr
    ? workspace.periodCalendarWindowAr
    : workspace.periodCalendarWindowEn
  const periodCompactLabel = isAr
    ? `الفترة: ${activePeriodShortLabel}`
    : `Period: ${activePeriodShortLabel}`
  const periodDropdownLabel = isAr
    ? `الفترة: ${activePeriodShortLabel} (${activePeriodRangeText})`
    : `Period: ${activePeriodShortLabel} (${activePeriodRangeText})`

  const periodPillOptions = GLOBAL_PERIOD_OPTIONS.map((p) => {
    const shortLbl = cleanPeriodOptionLabel(p.id, isAr ? p.ar : p.en, isAr)
    const win = formatPeriodCalendarWindow(p.id, {
      customFrom: draftFrom,
      customTo: draftTo,
      liveSummary,
    })
    const winText = isAr ? win.labelAr : win.labelEn
    return {
      id: p.id,
      label: shortLbl,
      title: `${shortLbl} (${winText})`,
    }
  })

  const handleApplyMobileSheet = () => {
    if (filters.period === 'custom') {
      setCustomRange(draftFrom, draftTo)
    }
    setMobileSheetOpen(false)
  }

  const hasOwnPageH1 = ROUTES_WITH_OWN_H1.has(pathname)
  const canonicalHeadingText = page
    ? isAr
      ? page.ar
      : page.en
    : isAr
      ? 'ملخص الشركة'
      : 'Company Summary'

  return (
    <>
      {!hasOwnPageH1 ? <h1 className="sr-only">{canonicalHeadingText}</h1> : null}
      {/* =====================================================================
          1. MOBILE & TABLET COMPACT 56px STICKY FROSTED APP BAR (`lg:hidden`)
             Strictly 3 Ultra-Clean Controls on `<sm` (`390px`) Phones:
             (1) Period Dropdown  •  (2) Filters  •  (3) Account & Menu (Bell hidden `<sm`)
         ===================================================================== */}
      <header
        aria-label={isAr ? 'الشريط العلوي للجوال' : 'Mobile Executive App Bar'}
        dir={isAr ? 'rtl' : 'ltr'}
        className="ae-mobile-appbar no-print sticky top-0 z-40 -mx-4 bg-white/85 px-3.5 shadow-[0_1px_0_rgba(148,163,184,0.2)] backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden dark:bg-[#0D162A]/90 dark:shadow-[0_1px_0_rgba(96,165,250,0.16)]"
      >
        <div ref={mobileBarRef} className="relative flex h-14 items-center justify-between gap-2">
          {/* Start: VF Brand Badge + Single Concise Active Page Title */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link
              href={resolveRoleDefaultHome(topRoleProfile.role)}
              aria-label={isAr ? 'ملخص الشركة' : 'Overview'}
              className="btn-colored v35-focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-xs font-black text-white shadow-[0_4px_12px_-3px_rgba(37,99,235,0.45)] transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:from-sky-400 dark:to-blue-500 dark:text-[#081226] dark:focus-visible:ring-sky-400/60"
            >
              VF
            </Link>
            <span
              className="min-w-0 truncate text-[14px] font-semibold tracking-tight text-slate-900 sm:text-[15px] dark:text-white"
              aria-current="page"
            >
              {mobilePageTitle}
            </span>
          </div>

          {/* End: Strictly 3 Clean Controls on `<sm` — Period + Filters + Account & Menu */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {showPosFilters ? (
              <>
                {/* Control (1): Compact Period Dropdown */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      setMobileSheetOpen(false)
                      setPeriodDropdownOpen((v) => !v)
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={periodDropdownOpen}
                    aria-label={periodDropdownLabel}
                    className={`v35-focus-ring inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-all duration-[160ms] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 sm:px-3 dark:focus-visible:ring-sky-400/60 ${
                      periodDropdownOpen || filters.period !== 'month'
                        ? 'bg-blue-50/95 text-blue-950 ring-1 ring-blue-500/35 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                        : 'bg-white/75 text-slate-700 ring-1 ring-slate-400/25 hover:bg-white dark:bg-white/[0.06] dark:text-slate-200 dark:ring-sky-400/20'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-sky-400" />
                    <span className="whitespace-nowrap sm:hidden">{activePeriodShortLabel}</span>
                    <span className="hidden whitespace-nowrap sm:inline">{periodDropdownLabel}</span>
                    <ChevronDown
                      className={`h-3 w-3 shrink-0 opacity-75 transition-transform duration-150 ${
                        periodDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {periodDropdownOpen ? (
                    <div className="absolute end-0 top-full z-50 mt-2 lg:hidden">
                      <PeriodDropdownPopover
                        isAr={isAr}
                        activePeriod={filters.period}
                        draftFrom={draftFrom}
                        draftTo={draftTo}
                        liveSummary={liveSummary}
                        onSelectPeriod={setPeriod}
                        onChangeFrom={setDraftFrom}
                        onChangeTo={setDraftTo}
                        onApplyCustomRange={() => setCustomRange(draftFrom, draftTo)}
                        onOpenScopeFilters={() => setMobileSheetOpen(true)}
                        onClose={() => setPeriodDropdownOpen(false)}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Control (2): Filters (`فلاتر`) */}
                <button
                  type="button"
                  onClick={() => {
                    setPeriodDropdownOpen(false)
                    setAccountMenuOpen(false)
                    setMobileSheetOpen(true)
                  }}
                  aria-expanded={mobileSheetOpen}
                  aria-label={isAr ? 'فتح فلاتر التحليل' : 'Open Filters'}
                  className={`v35-focus-ring inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-all duration-[160ms] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 sm:px-3 dark:focus-visible:ring-sky-400/60 ${
                    mobileActiveFilterCount > 0
                      ? 'bg-blue-50/95 text-blue-950 ring-1 ring-blue-500/35 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                      : 'bg-white/75 text-slate-700 ring-1 ring-slate-400/25 hover:bg-white dark:bg-white/[0.06] dark:text-slate-200 dark:ring-sky-400/20'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-sky-400" />
                  <span className="hidden whitespace-nowrap sm:inline">
                    {isAr ? 'فلاتر' : 'Filters'}
                  </span>
                  {mobileActiveFilterCount > 0 ? (
                    <span
                      dir="ltr"
                      style={{ color: '#FFFFFF' }}
                      className="btn-colored inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-xs font-bold tabular-nums text-white dark:bg-blue-500"
                    >
                      {mobileActiveFilterCount}
                    </span>
                  ) : null}
                </button>
              </>
            ) : null}

            {/* Tablet-only (`sm:block`) Bell — hidden on `<sm` (`390px`) phones where Notifications live inside Account & Menu */}
            <div className="hidden sm:block">
              <GovernanceBellTrigger />
            </div>

            {/* Control (3): Account & Menu (`القائمة والحساب` — houses single Language switcher & Notifications) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPeriodDropdownOpen(false)
                  setMobileSheetOpen(false)
                  setAccountMenuOpen((v) => !v)
                }}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label={isAr ? 'القائمة والحساب' : 'Account & Menu'}
                className={`v35-focus-ring relative inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-all duration-[160ms] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 sm:px-3 dark:focus-visible:ring-sky-400/60 ${
                  accountMenuOpen || (!auditorMode && gov?.session.active)
                    ? 'bg-blue-50/95 text-blue-950 ring-1 ring-blue-500/35 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                    : auditorMode
                      ? 'bg-slate-100/90 text-slate-800 ring-1 ring-slate-400/30 dark:bg-slate-800/75 dark:text-slate-200 dark:ring-slate-400/25'
                      : 'bg-white/75 text-slate-700 ring-1 ring-slate-400/25 hover:bg-white dark:bg-white/[0.06] dark:text-slate-200 dark:ring-sky-400/20'
                }`}
              >
                <ShieldCheck
                  className={`h-3.5 w-3.5 shrink-0 ${
                    auditorMode
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-blue-600 dark:text-sky-400'
                  }`}
                />
                <span className="hidden whitespace-nowrap sm:inline">
                  {isAr ? 'القائمة والحساب' : 'Account & Menu'}
                </span>
                {hasUnreadNotifications ? (
                  <span
                    aria-hidden
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      hasActiveBreaches ? 'bg-rose-600' : 'bg-blue-500 dark:bg-sky-400'
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
                    sessionRole={sessionRole}
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

        {/* Compact <640px Explicit Period Date Window Subtitle (`Period: Month (Oct 15 – Nov 13, 2026)`) */}
        {showPosFilters ? (
          <div className="flex items-center justify-between gap-2 pb-1.5 text-xs font-medium tabular-nums text-slate-600 sm:hidden dark:text-slate-300">
            <span className="min-w-0 truncate">{periodDropdownLabel}</span>
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
            className="ae-sheet-backdrop no-print fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs lg:hidden"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              isAr ? 'فلاتر الفترة والفروع والقنوات' : 'Period, Brand, Branch & Channel Filters'
            }
            dir={isAr ? 'rtl' : 'ltr'}
            className="ae-bottom-sheet no-print fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-white/95 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur-xl shadow-[0_-14px_44px_-10px_rgba(15,23,42,0.16)] ring-1 ring-slate-400/25 lg:hidden dark:bg-[#0F1A30]/95 dark:shadow-[0_-14px_44px_-10px_rgba(2,6,23,0.72)] dark:ring-sky-400/20"
          >
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-300/80 dark:bg-sky-300/20" />

            <div className="flex items-start justify-between gap-2 pb-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                  {isAr ? 'فلاتر التحليل الموحدة' : 'Unified Executive Filters'}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {toWesternNumerals(isAr ? workspace.subtitleAr : workspace.subtitleEn)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="v35-focus-ring inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-blue-50/80 text-slate-600 ring-1 ring-slate-400/20 transition-colors hover:bg-blue-100/80 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.08] dark:text-slate-200 dark:ring-white/10 dark:hover:bg-sky-400/15 dark:hover:text-white dark:focus-visible:ring-sky-400/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Period + Custom Dates */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="text-xs font-bold tracking-tight text-slate-600 dark:text-slate-300">
                    {isAr ? 'الفترة الزمنية' : 'Time Period'}
                  </div>
                  <span className="rounded-full bg-blue-50/90 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-blue-800 ring-1 ring-blue-400/25 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25">
                    {periodDropdownLabel}
                  </span>
                </div>
                <EmeraldPillTabs
                  ariaLabel={isAr ? 'الفترة' : 'Period'}
                  value={filters.period}
                  onChange={setPeriod}
                  options={periodPillOptions}
                />

                {filters.period === 'custom' ? (
                  <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-blue-50/65 p-3 ring-1 ring-slate-400/20 dark:bg-[#13203B]/80 dark:ring-sky-400/20">
                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span>{isAr ? 'من تاريخ' : 'Start Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftFrom}
                        onChange={(e) => setDraftFrom(e.target.value)}
                        className="v35-focus-ring h-10 w-full rounded-xl bg-white/95 px-2.5 text-xs font-bold tabular-nums text-slate-900 ring-1 ring-slate-400/25 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0B1427] dark:text-white dark:ring-sky-400/25 dark:focus-visible:ring-sky-400/60"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span>{isAr ? 'إلى تاريخ' : 'End Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftTo}
                        onChange={(e) => setDraftTo(e.target.value)}
                        className="v35-focus-ring h-10 w-full rounded-xl bg-white/95 px-2.5 text-xs font-bold tabular-nums text-slate-900 ring-1 ring-slate-400/25 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0B1427] dark:text-white dark:ring-sky-400/25 dark:focus-visible:ring-sky-400/60"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <FilterChipGroup
                label={isAr ? 'المطعم / العلامة (6 علامات تجارية)' : 'Brand (6 Approved Brands)'}
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
                  className="v35-focus-ring inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-slate-100/85 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-400/20 transition-colors hover:bg-slate-200/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-45 dark:bg-white/[0.08] dark:text-slate-200 dark:focus-visible:ring-sky-400/60"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{isAr ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyMobileSheet}
                  className="btn-colored v35-focus-ring inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-blue-600 text-[13px] font-bold text-white shadow-[0_6px_18px_-4px_rgba(37,99,235,0.45)] transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-sky-400 dark:text-[#081226] dark:hover:bg-sky-300 dark:focus-visible:ring-sky-400/60"
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
          3. DESKTOP V35 FROSTED PILL UTILITY & EXECUTIVE CONTROL BAR (`hidden lg:block`)
             [Rail + Pill Search ⌘K] ... [Period • Filters] • [Bell • Theme] • [Executive Profile Pill (houses single Language toggle)]
         ===================================================================== */}
      <header
        id="ae-topbar"
        aria-label={isAr ? 'شريط التحكم التنفيذي الموحد' : 'Unified Executive Control Bar'}
        dir={isAr ? 'rtl' : 'ltr'}
        className="no-print sticky top-2 z-40 hidden w-full max-w-[1920px] overflow-visible py-1.5 lg:block"
      >
        <div
          ref={desktopBarRef}
          className="relative flex items-center justify-between gap-2 xl:gap-2.5 rounded-2xl px-3.5 xl:px-4 py-2.5"
        >
          {/* Start Side: Sidebar Rail Toggle + Compact Pill Search Input (`⌘K`) + Optional Auditor Pill */}
          <div className="flex min-w-0 flex-1 items-center gap-2 xl:gap-2.5">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(RAIL_TOGGLE_EVENT))}
              className="ae-capsule v35-focus-ring inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60"
              title={
                isAr ? 'طي أو توسيع القائمة الجانبية (Ctrl+B)' : 'Toggle sidebar rail (Ctrl+B)'
              }
              aria-label={isAr ? 'طي أو توسيع القائمة الجانبية' : 'Toggle sidebar rail'}
            >
              {isAr ? (
                <PanelRight className="h-4 w-4 opacity-80" />
              ) : (
                <PanelLeft className="h-4 w-4 opacity-80" />
              )}
            </button>

            {/* Compact Pill Search Input (`Search…` / `ابحث…` + `⌘K`) */}
            <button
              type="button"
              onClick={openCommandPalette}
              aria-label={isAr ? 'ابحث… (Ctrl+K)' : 'Search… (Ctrl+K)'}
              className="ae-capsule v35-focus-ring group inline-flex h-9 min-w-[128px] max-w-[220px] xl:min-w-[172px] xl:max-w-[280px] flex-1 cursor-pointer items-center justify-between gap-2.5 rounded-full bg-white/70 px-3.5 text-[13px] text-slate-600 backdrop-blur-md ring-1 ring-slate-400/25 transition-all duration-150 hover:bg-white/95 hover:text-slate-950 hover:ring-blue-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-sky-400/20 dark:hover:bg-white/[0.11] dark:hover:text-white dark:hover:ring-sky-400/40 dark:focus-visible:ring-sky-400/60"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-blue-600 transition-transform duration-150 group-hover:scale-105 dark:text-sky-400" />
                <span className="truncate font-medium">
                  {isAr ? 'ابحث…' : 'Search…'}
                </span>
              </span>
              <kbd
                dir="ltr"
                className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-slate-400/25 dark:bg-white/[0.08] dark:text-sky-200 dark:ring-sky-400/20"
              >
                ⌘K
              </kbd>
            </button>

            {page ? (
              <span
                className="ae-top-title hidden 2xl:inline truncate px-1 text-[13.5px] font-semibold tracking-tight text-slate-700 dark:text-slate-200"
                aria-current="page"
              >
                {isAr ? page.ar : page.en}
              </span>
            ) : null}

            {auditorMode ? (
              <span data-auditor-badge="bar" className="hidden xl:inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-700 ring-1 ring-slate-300/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15">
                <Lock className="h-3 w-3 shrink-0 text-slate-600 dark:text-slate-300" />
                <span>{isAr ? 'حساب مراجعة — قراءة فقط' : 'Read-Only Auditor'}</span>
              </span>
            ) : null}
          </div>

          {/* End Utility & Filter Cluster:
              [Period • Filters] + [xl+: Bell Circle • Theme Circle] + [Executive Profile Pill -> houses workspace actions & single Language row] */}
          <div className="relative z-[60] flex shrink-0 items-center justify-end gap-1.5 xl:gap-2 overflow-visible">
            {showPosFilters ? (
              <>
                {/* Control (1): Sleek Pill Period Dropdown (`الفترة: الشهر ▾` / `Period: Month ▾`) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setFiltersPopoverOpen(false)
                      setAccountMenuOpen(false)
                      setPeriodDropdownOpen((v) => !v)
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={periodDropdownOpen}
                    aria-label={periodDropdownLabel}
                    title={periodDropdownLabel}
                    className={`v35-focus-ring inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 xl:px-3.5 text-[13px] font-semibold backdrop-blur-md transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
                      periodDropdownOpen || filters.period !== 'month'
                        ? 'bg-blue-50/95 text-blue-950 shadow-[0_2px_10px_-3px_rgba(37,99,235,0.22)] ring-1 ring-blue-500/40 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                        : 'bg-white/75 text-slate-700 ring-1 ring-slate-400/25 hover:bg-white/95 hover:text-slate-950 hover:ring-blue-500/30 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-sky-400/20 dark:hover:bg-white/[0.11] dark:hover:text-white'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-sky-400" />
                    <span className="whitespace-nowrap xl:hidden">{periodCompactLabel}</span>
                    <span className="hidden whitespace-nowrap xl:inline">{periodDropdownLabel}</span>
                    {filters.period === 'today' && workspace.isTodayFallback ? (
                      <span
                        title={
                          isAr
                            ? `تعويض تلقائي لآخر يوم تشغيل مكتمل في نقاط البيع (${workspace.todayFallbackDate ?? ''})`
                            : `Auto-fallback to last completed POS operating day (${workspace.todayFallbackDate ?? ''})`
                        }
                        className="hidden xl:inline-flex rounded-full bg-slate-100/90 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/25 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25"
                      >
                        {isAr ? 'آخر يوم مكتمل' : 'Last Full Day'}
                      </span>
                    ) : null}
                    <ChevronDown
                      className={`h-3.5 w-3.5 opacity-70 transition-transform duration-150 ${
                        periodDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {periodDropdownOpen ? (
                    <div className="absolute end-0 top-full z-50 mt-2">
                      <PeriodDropdownPopover
                        isAr={isAr}
                        activePeriod={filters.period}
                        draftFrom={draftFrom}
                        draftTo={draftTo}
                        liveSummary={liveSummary}
                        onSelectPeriod={setPeriod}
                        onChangeFrom={setDraftFrom}
                        onChangeTo={setDraftTo}
                        onApplyCustomRange={() => setCustomRange(draftFrom, draftTo)}
                        onOpenScopeFilters={() => setFiltersPopoverOpen(true)}
                        onClose={() => setPeriodDropdownOpen(false)}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Control (2): Single Unified `فلاتر` (`Filters`) Pill + Active Count Badge */}
                <button
                  type="button"
                  onClick={() => {
                    setPeriodDropdownOpen(false)
                    setAccountMenuOpen(false)
                    setFiltersPopoverOpen((v) => !v)
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={filtersPopoverOpen}
                  className={`v35-focus-ring inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 xl:px-3.5 text-[13px] font-semibold backdrop-blur-md transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
                    filtersPopoverOpen || nonDefaultSliceCount > 0
                      ? 'bg-blue-50/95 text-blue-950 shadow-[0_2px_10px_-3px_rgba(37,99,235,0.22)] ring-1 ring-blue-500/40 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                      : 'bg-white/75 text-slate-700 ring-1 ring-slate-400/25 hover:bg-white/95 hover:text-slate-950 hover:ring-blue-500/30 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-sky-400/20 dark:hover:bg-white/[0.11] dark:hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-sky-400" />
                  <span className="whitespace-nowrap">{isAr ? 'فلاتر' : 'Filters'}</span>
                  {nonDefaultSliceCount > 0 ? (
                    <span
                      dir="ltr"
                      style={{ color: '#FFFFFF' }}
                      className="btn-colored inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold tabular-nums text-white dark:bg-blue-500"
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

            {/* Secondary Quick Action Pills (Notifications Bell & Theme Circle) — collapsed into AccountWorkspaceMenuPanel on `< 1280px` */}
            <div className="hidden xl:flex items-center gap-1.5">
              {/* Quick Action Circle (1): Notifications & Governance Bell */}
              <GovernanceBellTrigger />

              {/* Quick Action Circle (2): Light / Midnight-Navy Blue Dark Mode Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                title={
                  isDarkTheme
                    ? isAr
                      ? 'التبديل إلى الوضع النهاري'
                      : 'Switch to Light Mode'
                    : isAr
                      ? 'التبديل إلى الوضع الأزرق الداكن'
                      : 'Switch to Blue Dark Mode'
                }
                aria-label={
                  isDarkTheme
                    ? isAr
                      ? 'التبديل إلى الوضع النهاري'
                      : 'Switch to Light Mode'
                    : isAr
                      ? 'التبديل إلى الوضع الأزرق الداكن'
                      : 'Switch to Blue Dark Mode'
                }
                className="ae-capsule v35-focus-ring inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/75 text-slate-500 backdrop-blur-md ring-1 ring-slate-400/25 transition-all duration-150 hover:bg-white/95 hover:text-slate-700 hover:ring-blue-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-sky-400/20 dark:hover:bg-white/[0.11] dark:hover:ring-sky-400/40 dark:focus-visible:ring-sky-400/60"
              >
                {isDarkTheme ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Sleek Executive Profile Pill (`Avatar + Name + Corporate Email` -> opens Account & Menu with Notifications, Theme & single Language row) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPeriodDropdownOpen(false)
                  setFiltersPopoverOpen(false)
                  setAccountMenuOpen((v) => !v)
                }}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label={isAr ? 'القائمة والحساب' : 'Account & Menu'}
                className={`v35-focus-ring inline-flex h-10 cursor-pointer items-center gap-2 xl:gap-2.5 rounded-full py-1 ps-1.5 pe-2.5 xl:pe-3 text-start backdrop-blur-md transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
                  accountMenuOpen || (!auditorMode && gov?.session.active)
                    ? 'bg-blue-50/95 text-blue-950 shadow-[0_2px_10px_-3px_rgba(37,99,235,0.22)] ring-1 ring-blue-500/40 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/40'
                    : auditorMode
                      ? 'bg-slate-100/90 text-slate-800 ring-1 ring-slate-400/30 dark:bg-slate-800/75 dark:text-slate-200 dark:ring-slate-400/25'
                      : 'bg-white/75 text-slate-800 ring-1 ring-slate-400/25 hover:bg-white/95 hover:ring-blue-500/30 dark:bg-white/[0.06] dark:text-slate-100 dark:ring-sky-400/20 dark:hover:bg-white/[0.11]'
                }`}
              >
                <span
                  style={{ color: '#FFFFFF' }}
                  className="btn-colored relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 via-blue-600 to-sky-500 text-xs font-bold tracking-tight text-white shadow-sm"
                >
                  {execAvatarInitials}
                  {hasUnreadNotifications ? (
                    <span
                      aria-hidden
                      className={`absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#0D162A] ${
                        hasActiveBreaches ? 'bg-rose-600' : 'bg-sky-400'
                      }`}
                    />
                  ) : null}
                </span>

                <span className="hidden xl:block leading-tight">
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold tracking-tight text-slate-900 dark:text-white">
                    <span>{isAr ? topRoleProfile.nameAr : topRoleProfile.nameEn}</span>
                    <span
                      data-role-badge={topRoleProfile.role}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        auditorMode
                          ? 'bg-slate-100/90 text-slate-800 ring-1 ring-slate-400/25 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-400/25'
                          : 'bg-sky-100/90 text-blue-900 dark:bg-sky-400/20 dark:text-sky-200'
                      }`}
                    >
                      {isAr ? topRoleProfile.titleAr : topRoleProfile.titleEn}
                    </span>
                  </span>
                  <span
                    dir={userEmail ? 'ltr' : undefined}
                    className="block whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    {userEmail || (isAr ? topRoleProfile.titleAr : topRoleProfile.titleEn)}
                  </span>
                </span>

                <span className="sr-only">
                  {isAr ? 'القائمة والحساب' : 'Account & Menu'}
                </span>

                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-150 ${
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
                    sessionRole={sessionRole}
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
              className="absolute end-0 top-full z-50 mt-2 max-h-[82dvh] w-[min(92vw,720px)] max-w-full space-y-4 overflow-y-auto rounded-3xl bg-white/90 p-5 backdrop-blur-xl shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-slate-400/25 dark:bg-[#0F1A30]/95 dark:shadow-[0_24px_60px_-12px_rgba(2,6,23,0.75)] dark:ring-sky-400/25"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-300/40 pb-3 dark:border-sky-300/15">
                <div className="min-w-0">
                  <h2 className="text-[14.5px] font-bold tracking-tight text-slate-900 dark:text-white">
                    {isAr ? 'فلاتر التحليل الموحدة' : 'Unified Executive Filters'}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                    {toWesternNumerals(isAr ? workspace.subtitleAr : workspace.subtitleEn)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {hasAnyActiveFilter ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="v35-focus-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-slate-100/85 px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/25 transition-colors hover:bg-slate-200/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.08] dark:text-slate-200 dark:ring-white/15 dark:hover:bg-white/[0.14] dark:focus-visible:ring-sky-400/60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{isAr ? 'إعادة ضبط الفلاتر' : 'Reset All Filters'}</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setFiltersPopoverOpen(false)}
                    aria-label={isAr ? 'إغلاق' : 'Close'}
                    className="v35-focus-ring inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-50/80 text-slate-600 ring-1 ring-slate-400/20 transition-colors hover:bg-blue-100/80 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.08] dark:text-slate-200 dark:ring-white/10 dark:hover:bg-sky-400/15 dark:hover:text-white dark:focus-visible:ring-sky-400/60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 0. Time Period + Custom From/To Range right inside Desktop Unified Filters */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="text-xs font-bold tracking-tight text-slate-600 dark:text-slate-300">
                    {isAr ? 'الفترة الزمنية والتقويم المخصص' : 'Time Period & Custom Date Range'}
                  </div>
                  <span className="rounded-full bg-blue-50/90 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-blue-800 ring-1 ring-blue-400/25 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25">
                    {periodDropdownLabel}
                  </span>
                </div>
                <EmeraldPillTabs
                  ariaLabel={isAr ? 'الفترة' : 'Period'}
                  value={filters.period}
                  onChange={setPeriod}
                  options={periodPillOptions}
                />
                {filters.period === 'custom' ? (
                  <div className="grid grid-cols-1 gap-2.5 rounded-2xl bg-blue-50/65 p-3 ring-1 ring-slate-400/20 sm:grid-cols-3 dark:bg-[#13203B]/80 dark:ring-sky-400/20">
                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span>{isAr ? 'من تاريخ' : 'From Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftFrom}
                        onChange={(e) => {
                          setDraftFrom(e.target.value)
                          setCustomRange(e.target.value, draftTo)
                        }}
                        className="v35-focus-ring h-9 w-full rounded-xl bg-white/95 px-2.5 text-xs font-bold tabular-nums text-slate-900 ring-1 ring-slate-400/25 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0B1427] dark:text-white dark:ring-sky-400/25 dark:focus-visible:ring-sky-400/60"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span>{isAr ? 'إلى تاريخ' : 'To Date'}</span>
                      <input
                        type="date"
                        dir="ltr"
                        value={draftTo}
                        onChange={(e) => {
                          setDraftTo(e.target.value)
                          setCustomRange(draftFrom, e.target.value)
                        }}
                        className="v35-focus-ring h-9 w-full rounded-xl bg-white/95 px-2.5 text-xs font-bold tabular-nums text-slate-900 ring-1 ring-slate-400/25 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0B1427] dark:text-white dark:ring-sky-400/25 dark:focus-visible:ring-sky-400/60"
                      />
                    </label>
                    <div className="flex flex-col justify-end">
                      <span className="inline-flex h-9 items-center justify-center rounded-xl bg-blue-100/85 px-3 text-xs font-bold text-blue-900 ring-1 ring-blue-400/25 tabular-nums dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-400/30">
                        {isAr
                          ? `نطاق نشط: ${computeCustomSpanDays(draftFrom, draftTo)} يوم`
                          : `Active Span: ${computeCustomSpanDays(draftFrom, draftTo)} Days`}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* 1. Brand (`المطعم / العلامة`) */}
              <FilterChipGroup
                label={isAr ? 'المطعم / العلامة (6 علامات تجارية معتمدة)' : 'Brand (6 Approved Brands)'}
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

              <div className="flex items-center justify-between gap-2 border-t border-slate-300/40 pt-3 dark:border-sky-300/15">
                <span className="text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                  {toWesternNumerals(
                    isAr ? workspace.periodRangeLabelAr : workspace.periodRangeLabelEn,
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {hasAnyActiveFilter ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="v35-focus-ring inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-slate-100/85 px-3.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/20 transition-colors hover:bg-slate-200/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.08] dark:text-slate-200 dark:focus-visible:ring-sky-400/60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{isAr ? 'إعادة ضبط الفلاتر' : 'Reset All'}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setFiltersPopoverOpen(false)}
                    className="btn-colored v35-focus-ring inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-blue-600 px-5 text-xs font-bold text-white shadow-[0_6px_16px_-4px_rgba(37,99,235,0.42)] transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-sky-400 dark:text-[#081226] dark:hover:bg-sky-300 dark:focus-visible:ring-sky-400/60"
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
      {pathname.startsWith('/erp') && !ROUTES_WITH_OWN_PARTIAL_BANNER.has(pathname) ? (
        <OdooPartialWarningBanner summary={liveSummary} isAr={isAr} />
      ) : null}
    </>
  )
}
