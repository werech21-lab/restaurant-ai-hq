'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { formatPeriodCalendarWindow } from '@/lib/aether/global-filter-engine'

type SyncState = {
  status: 'idle' | 'syncing' | 'done' | 'error' | 'unauthorized'
  summary?: OdooLiveSummary
  message?: string
}

const LAST_SYNC_STORAGE_KEY = 'vf_last_silent_odoo_sync_ts_v11'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/**
 * Odoo 17 Sync Pill in the Single-Row Executive Command Bar.
 * Shows the synced 30-day calendar window, runs a silent 6-hour background refresh check,
 * and allows 1-click manual pull from /api/erp/odoo-sync.
 */
export function OdooSyncPill({ isAr }: { isAr: boolean }) {
  const [state, setState] = useState<SyncState>({ status: 'idle' })

  const sync = useCallback(async (silent = false) => {
    setState((prev) => {
      if (prev.status === 'syncing') return prev
      return silent ? prev : { ...prev, status: 'syncing' }
    })
    try {
      const res = await fetch('/api/erp/odoo-sync', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (res.status === 401) {
        if (!silent) setState({ status: 'unauthorized' })
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const summary = (await res.json()) as OdooLiveSummary
      try {
        window.localStorage.setItem(LAST_SYNC_STORAGE_KEY, String(Date.now()))
      } catch {
        // ignore storage quota errors
      }
      setState({ status: 'done', summary })
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: summary }))
    } catch (error) {
      if (!silent) {
        setState({ status: 'error', message: error instanceof Error ? error.message : 'error' })
      }
    }
  }, [])

  useEffect(() => {
    const onExternalSync = (ev: Event) => {
      const detail = (ev as CustomEvent<OdooLiveSummary>).detail
      if (detail) setState({ status: 'done', summary: detail })
    }
    window.addEventListener('aether:odoo-sync', onExternalSync)
    try {
      const isAuditorDom =
        typeof document !== 'undefined' &&
        (document.documentElement.dataset.auditor === 'true' ||
          document.documentElement.dataset.sessionRole === 'auditor')
      const last = Number(window.localStorage.getItem(LAST_SYNC_STORAGE_KEY) || '0')
      if (!isAuditorDom && (!last || Date.now() - last > SIX_HOURS_MS)) {
        const timer = window.setTimeout(() => {
          void sync(true)
        }, 1200)
        return () => {
          window.clearTimeout(timer)
          window.removeEventListener('aether:odoo-sync', onExternalSync)
        }
      }
    } catch {
      // ignore storage errors
    }
    return () => window.removeEventListener('aether:odoo-sync', onExternalSync)
  }, [sync])

  const s = state.summary
  const canonicalMonthWin = formatPeriodCalendarWindow('month', { liveSummary: s ?? null })
  const r30From = canonicalMonthWin.fromIso
  const r30To = canonicalMonthWin.toInclusiveIso
  const mtdDays = s?.journeyPulse?.mtd?.days ?? 0
  const mtdSuffixAr = mtdDays > 0 ? ` + الشهر الجاري (${mtdDays} يوماً)` : ''
  const mtdSuffixEn = mtdDays > 0 ? ` + MTD (${mtdDays}d)` : ''

  const label =
    state.status === 'syncing'
      ? isAr
        ? 'جارٍ تحديث بيانات أودو…'
        : 'Updating Odoo data…'
      : state.status === 'unauthorized'
        ? isAr
          ? 'سجّل الدخول للتحديث'
          : 'Sign in to refresh'
        : state.status === 'error'
          ? isAr
            ? 'تعذر الاتصال بأودو · إعادة المحاولة'
            : 'Odoo Unreachable · Retry'
          : isAr
            ? `Odoo 17 · آخر 30 يوماً (${r30From} ← ${r30To})${mtdSuffixAr}`
            : `Odoo 17 · Last 30d (${r30From} → ${r30To})${mtdSuffixEn}`

  const shortLabel =
    state.status === 'syncing'
      ? isAr
        ? 'جارٍ التحديث…'
        : 'Updating…'
      : isAr
        ? 'Odoo 17 · آخر 30 يوماً'
        : 'Odoo 17 · Last 30d'

  const title = s
    ? [
        isAr
          ? `آخر 30 يوماً: ${s.period.from} ← ${s.period.to}${mtdSuffixAr}`
          : `Last 30d: ${s.period.from} → ${s.period.to}${mtdSuffixEn}`,
        isAr
          ? `صافي المبيعات: ${fmt(s.totals.netSalesKwd)} د.ك · ${s.totals.orders.toLocaleString('en-US')} طلب`
          : `Net sales: ${fmt(s.totals.netSalesKwd)} KWD · ${s.totals.orders.toLocaleString('en-US')} orders`,
      ].join('\n')
    : isAr
      ? 'مزامنة Odoo 17 — اضغط لتحديث الأرقام الآن'
      : 'Odoo 17 sync — click to refresh numbers now'

  return (
    <button
      type="button"
      onClick={() => void sync(false)}
      title={title}
      aria-live="polite"
      aria-busy={state.status === 'syncing'}
      className="ae-top-live ms-1 hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-90 sm:inline-flex"
    >
      {state.status === 'syncing' ? (
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{
              backgroundColor:
                state.status === 'error' || state.status === 'unauthorized'
                  ? '#FBBF24'
                  : '#10B981',
            }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{
              backgroundColor:
                state.status === 'error'
                  ? '#E11D48'
                  : state.status === 'unauthorized'
                    ? '#D97706'
                    : '#059669',
            }}
          />
        </span>
      )}
      <span className="hidden xl:inline">{label}</span>
      <span className="xl:hidden">{shortLabel}</span>
    </button>
  )
}
