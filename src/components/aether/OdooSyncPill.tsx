'use client'

import React, { useCallback, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

type SyncState = { status: 'idle' | 'syncing' | 'done' | 'error'; summary?: OdooLiveSummary; message?: string }

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/**
 * "● Live Odoo Sync" topbar pill. Clicking it calls the server-side bridge (/api/odoo-sync), which
 * pulls Odoo with server-held credentials or falls back to the last synced snapshot.
 */
export function OdooSyncPill({ isAr }: { isAr: boolean }) {
  const [state, setState] = useState<SyncState>({ status: 'idle' })

  const sync = useCallback(async () => {
    if (state.status === 'syncing') return
    setState((s) => ({ ...s, status: 'syncing' }))
    try {
      const res = await fetch('/api/odoo-sync', { cache: 'no-store', headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const summary = (await res.json()) as OdooLiveSummary
      setState({ status: 'done', summary })
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: summary }))
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'error' })
    }
  }, [state.status])

  const s = state.summary
  const time = s ? new Date(s.syncedAt).toLocaleTimeString(isAr ? 'ar-KW' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : null
  const label =
    state.status === 'syncing'
      ? isAr ? 'جارٍ المزامنة مع أودو…' : 'Syncing Odoo…'
      : state.status === 'error'
        ? isAr ? 'تعذّرت المزامنة' : 'Sync failed'
        : s
          ? s.source === 'live'
            ? isAr ? `أودو مباشر · ${time}` : `Live Odoo · ${time}`
            : isAr ? 'آخر لقطة من أودو' : 'Odoo snapshot'
          : isAr ? 'مزامنة أودو مباشرة' : 'Live Odoo Sync'

  const title = s
    ? [
        isAr ? `الفترة: ${s.period.from} ← ${s.period.to}` : `Period: ${s.period.from} → ${s.period.to}`,
        isAr ? `صافي المبيعات: ${fmt(s.totals.netSalesKwd)} د.ك · ${s.totals.orders.toLocaleString('en-US')} طلب` : `Net sales: KWD ${fmt(s.totals.netSalesKwd)} · ${s.totals.orders.toLocaleString('en-US')} orders`,
        isAr ? `العلامات: ${s.brands.map((b) => b.brand).join('، ')}` : `Brands: ${s.brands.map((b) => b.brand).join(', ')}`,
        s.note ?? '',
      ].filter(Boolean).join('\n')
    : isAr ? 'اضغط لسحب آخر أرقام نقاط البيع من أودو' : 'Click to pull the latest POS figures from Odoo'

  return (
    <button
      type="button"
      onClick={sync}
      title={title}
      aria-live="polite"
      aria-busy={state.status === 'syncing'}
      className="ae-top-live ms-1 hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-90 md:inline-flex"
    >
      {state.status === 'syncing' ? (
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: state.status === 'error' ? '#FB7185' : '#34D399' }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: state.status === 'error' ? '#E11D48' : '#10B981' }} />
        </span>
      )}
      {label}
    </button>
  )
}
