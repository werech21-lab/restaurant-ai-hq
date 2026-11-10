'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { JOURNEY_META } from '@/lib/full-journey-enterprise-brain'

type SyncState = { status: 'idle' | 'syncing' | 'done' | 'error' | 'unauthorized'; summary?: OdooLiveSummary; message?: string }

const LAST_SYNC_STORAGE_KEY = 'vf_last_silent_odoo_sync_ts_v11'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/**
 * Live Odoo 17 Heartbeat Pill in the Single-Row Executive Command Bar.
 * Shows the exact Rolling 30-Day + Nov 2026 MTD window, runs a silent 6-hour background refresh check,
 * and allows 1-click manual pull from /api/odoo-sync.
 */
export function OdooSyncPill({ isAr }: { isAr: boolean }) {
  const [state, setState] = useState<SyncState>({ status: 'idle' })

  const sync = useCallback(async (silent = false) => {
    setState((prev) => {
      if (prev.status === 'syncing') return prev
      return silent ? prev : { ...prev, status: 'syncing' }
    })
    try {
      const res = await fetch('/api/odoo-sync', { cache: 'no-store', credentials: 'same-origin', headers: { accept: 'application/json' } })
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

  // Silent 6-hour background freshness check on mount + cross-component sync listener
  useEffect(() => {
    const onExternalSync = (ev: Event) => {
      const detail = (ev as CustomEvent<OdooLiveSummary>).detail
      if (detail) setState({ status: 'done', summary: detail })
    }
    window.addEventListener('aether:odoo-sync', onExternalSync)
    try {
      const last = Number(window.localStorage.getItem(LAST_SYNC_STORAGE_KEY) || '0')
      const snapshotAgeMs = Date.now() - new Date(JOURNEY_META.syncedAt).getTime()
      if ((!last || Date.now() - last > SIX_HOURS_MS) && snapshotAgeMs > SIX_HOURS_MS) {
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
  const r30From = s?.period?.from ?? JOURNEY_META.rolling.from
  const r30To = s?.period?.to ?? JOURNEY_META.rolling.to
  const mtdLabelAr = `نوفمبر 2026 (${JOURNEY_META.mtd.days} أيام)`
  const mtdLabelEn = `Nov 2026 MTD (${JOURNEY_META.mtd.days}d)`

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
            ? 'آخر تحديث محفوظ · إعادة المحاولة'
            : 'Saved Data · Retry'
          : isAr
            ? `أودو متصل · آخر 30 يوماً (${r30From} ← ${r30To}) + ${mtdLabelAr}`
            : `Odoo Live · Last 30d (${r30From} → ${r30To}) + ${mtdLabelEn}`

  const shortLabel =
    state.status === 'syncing'
      ? isAr
        ? 'جارٍ التحديث…'
        : 'Updating…'
      : isAr
        ? 'أودو متصل · 30 يوماً + نوفمبر'
        : 'Odoo Live · 30d + Nov'

  const title = s
    ? [
        isAr ? `آخر 30 يوماً: ${s.period.from} ← ${s.period.to} + ${mtdLabelAr}` : `Last 30d: ${s.period.from} → ${s.period.to} + ${mtdLabelEn}`,
        isAr
          ? `صافي المبيعات: ${fmt(s.totals.netSalesKwd)} د.ك · ${s.totals.orders.toLocaleString('en-US')} طلب`
          : `Net sales: ${fmt(s.totals.netSalesKwd)} KWD · ${s.totals.orders.toLocaleString('en-US')} orders`,
      ].join('\n')
    : isAr
      ? 'متصل بأودو — اضغط لتحديث الأرقام الآن'
      : 'Connected to Odoo — click to refresh numbers now'

  return (
    <button
      type="button"
      onClick={() => void sync(false)}
      title={title}
      aria-live="polite"
      aria-busy={state.status === 'syncing'}
      className="ae-top-live ms-1 hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold transition hover:opacity-90 sm:inline-flex"
    >
      {state.status === 'syncing' ? (
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ backgroundColor: state.status === 'error' || state.status === 'unauthorized' ? '#FBBF24' : '#10B981' }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: state.status === 'error' ? '#E11D48' : state.status === 'unauthorized' ? '#D97706' : '#059669' }}
          />
        </span>
      )}
      <span className="hidden xl:inline">{label}</span>
      <span className="xl:hidden">{shortLabel}</span>
    </button>
  )
}
