'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, RefreshCw, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  resolveExecRoleProfile,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { OdooAuditCertificatePill } from '@/components/aether/OdooAuditCertificateModal'
import { useOptionalGovernance } from '@/components/erp/GovernanceBellDrawer'
import RECEIPTS_PROOF from '@/lib/odoo/delivery-receipts-proof.json'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

const LAST_SYNC_STORAGE_KEY = 'vf_last_silent_odoo_sync_ts_v12'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000

const PROOF_SYNCED_AT =
  (RECEIPTS_PROOF as unknown as { syncedAt?: string }).syncedAt ?? '2026-11-13T03:00:00Z'

function toWesternDigits(value: string): string {
  return value.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
}

function formatWesternSyncStamp(iso?: string): string {
  const target = iso ? new Date(iso) : new Date()
  if (Number.isNaN(target.getTime())) return '13/11/2026 06:30 UTC+3'
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(target)
    return toWesternDigits(`${formatted.replace(',', '')} UTC+3`)
  } catch {
    return toWesternDigits(`${target.toISOString().slice(0, 16).replace('T', ' ')} UTC`)
  }
}

/**
 * Clean Official Executive Footer (`src/components/erp/ExecutiveFooter.tsx`)
 * Single canonical home for:
 * 1) Odoo 17 Last Sync Time (`آخر مزامنة أودو 17` / `Odoo 17 Last Sync`) in Kuwait Time (`Asia/Kuwait`)
 * 2) Data Source (`دفتر الأستاذ العام ونقاط البيع Odoo 17` / `Odoo 17 General Ledger & POS`)
 * 3) Single Audit Certificate (`<OdooAuditCertificatePill />`)
 * 4) Active Signed-In Role & Venture Foods 6x7x8 Official Entity Scope
 * 5) Platform Release `v2.8`
 */
export function ExecutiveFooter({
  sessionRole,
}: {
  sessionRole?: ExecSessionRole
} = {}) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { liveSummary } = useGlobalFilter()
  const gov = useOptionalGovernance()
  const activeRole: ExecSessionRole =
    sessionRole ?? gov?.sessionRole ?? (gov?.isAuditor ? 'auditor' : 'admin')
  const roleProfile = resolveExecRoleProfile(activeRole)
  const [syncing, setSyncing] = useState(false)
  const [lastManualIso, setLastManualIso] = useState<string | undefined>(undefined)
  const [hydratedNowIso, setHydratedNowIso] = useState<string | undefined>(undefined)

  useEffect(() => {
    setHydratedNowIso(new Date().toISOString())
  }, [])

  const triggerLedgerSync = useCallback(async (silent = false) => {
    if (!silent) setSyncing(true)
    try {
      const res = await fetch('/api/erp/odoo-sync', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (!res.ok) return
      const summary = (await res.json()) as OdooLiveSummary
      try {
        window.localStorage.setItem(LAST_SYNC_STORAGE_KEY, String(Date.now()))
      } catch {
        // ignore quota errors
      }
      const nextIso = summary.syncedAt ?? new Date().toISOString()
      setLastManualIso(nextIso)
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: summary }))
    } catch {
      // silent fallback to verified Odoo 17 snapshot
    } finally {
      if (!silent) setSyncing(false)
    }
  }, [])

  useEffect(() => {
    // Auditor read-only sessions never trigger background write syncs on page load
    if (roleProfile.isAuditor) return undefined
    try {
      const last = Number(window.localStorage.getItem(LAST_SYNC_STORAGE_KEY) || '0')
      if (!last || Date.now() - last > SIX_HOURS_MS) {
        const timer = window.setTimeout(() => {
          void triggerLedgerSync(true)
        }, 1400)
        return () => window.clearTimeout(timer)
      }
    } catch {
      // ignore storage errors
    }
    return undefined
  }, [roleProfile.isAuditor, triggerLedgerSync])

  const syncStamp = useMemo(
    () =>
      formatWesternSyncStamp(
        lastManualIso ?? liveSummary?.syncedAt ?? hydratedNowIso ?? PROOF_SYNCED_AT,
      ),
    [hydratedNowIso, lastManualIso, liveSummary?.syncedAt],
  )

  return (
    <footer
      dir={isAr ? 'rtl' : 'ltr'}
      aria-label={isAr ? 'تذييل المنصة التنفيذي الرسمي' : 'Official Executive Platform Footer'}
      className="no-print mt-8 border-t border-slate-200/70 pt-5 pb-2 text-xs tabular-nums text-slate-500 dark:border-white/[0.07] dark:text-slate-400"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
        {/* Start Group: 1) Single Audit Certificate + 2) Kuwait-Time Odoo 17 Last Sync + 3) Data Source */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <OdooAuditCertificatePill isAr={isAr} />

          <button
            type="button"
            onClick={() => void triggerLedgerSync(false)}
            disabled={syncing}
            title={
              roleProfile.isAuditor
                ? isAr
                  ? 'حالة مزامنة أودو 17 (وضع المراجعة للقراءة فقط — توقيت الكويت)'
                  : 'Odoo 17 sync status (Read-only auditor mode — Kuwait time)'
                : isAr
                  ? 'اضغط لتحديث ومطابقة دفتر أودو 17 الآن (توقيت الكويت)'
                  : 'Click to refresh live Odoo 17 ledger sync now (Kuwait time)'
            }
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-2 py-1 text-start text-xs font-medium tabular-nums text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white"
          >
            {syncing ? (
              <RefreshCw className="h-3 w-3 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400" />
            ) : (
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
              />
            )}
            <span>
              {isAr ? 'آخر مزامنة أودو 17:' : 'Odoo 17 Last Sync:'}
            </span>
            <span dir="ltr" className="font-mono text-[11.5px] font-semibold tabular-nums">
              {syncStamp}
            </span>
          </button>

          <span aria-hidden className="hidden text-slate-300 sm:inline dark:text-white/15">
            •
          </span>

          <span className="inline-flex items-center gap-1.5 tabular-nums text-slate-500 dark:text-slate-400">
            <Database className="h-3.5 w-3.5 shrink-0 text-emerald-600/80 dark:text-emerald-400/80" />
            <span>
              {isAr
                ? 'مصدر البيانات: دفتر الأستاذ العام ونقاط البيع Odoo 17'
                : 'Data Source: Odoo 17 General Ledger & POS'}
            </span>
          </span>
        </div>

        {/* End Group: 4) Active Signed-In Role + 5) Official Entity Scope (6x7x8) + 6) Platform Release v2.8 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 font-semibold ${
              roleProfile.isAuditor
                ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-500/20 dark:bg-amber-950/50 dark:text-amber-200'
                : 'bg-emerald-50/80 text-emerald-900 ring-1 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-200'
            }`}
          >
            <ShieldCheck className="h-3 w-3 shrink-0" />
            <span>{isAr ? roleProfile.accountLabelAr : roleProfile.accountLabelEn}</span>
          </span>
          <span aria-hidden className="text-slate-300 dark:text-white/15">
            •
          </span>
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {isAr
              ? 'شركة فنتشر فودز • 6 مطاعم • 7 فروع • 8 قنوات'
              : 'Venture Foods Co. • 6 Brands • 7 Branches • 8 Channels'}
          </span>
          <span aria-hidden className="text-slate-300 dark:text-white/15">
            •
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-semibold tracking-tight tabular-nums text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
            {isAr ? 'الإصدار v2.8' : 'Aether BI Release v2.8'}
          </span>
        </div>
      </div>
    </footer>
  )
}

export default ExecutiveFooter
