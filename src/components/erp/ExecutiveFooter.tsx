'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, RefreshCw, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  resolveExecRoleProfile,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import { canTriggerManualOdooSync } from '@/lib/auth/role-access-policy'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { OdooAuditCertificatePill } from '@/components/aether/OdooAuditCertificateModal'
import { useOptionalGovernance } from '@/components/erp/GovernanceBellDrawer'
import ODOO_SNAPSHOT from '@/lib/odoo-live-snapshot.json'
import {
  computeOdooFreshnessStatus,
  DEFAULT_SNAPSHOT_LATEST_RECORD_ISO,
  resolveSnapshotLatestRecordInfo,
  type OdooLiveSummary,
} from '@/lib/odoo/live-sync-core'

const LAST_SYNC_STORAGE_KEY = 'vf_last_silent_odoo_sync_ts_v12'
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000

const SNAPSHOT_LATEST_RECORD_ISO =
  resolveSnapshotLatestRecordInfo(ODOO_SNAPSHOT).latestRecordAt ||
  DEFAULT_SNAPSHOT_LATEST_RECORD_ISO

/** Deterministic SSR reference timestamp so initial server & client HTML match byte-for-byte before post-mount clock refresh. */
const DETERMINISTIC_SSR_REF_NOW_MS = Date.parse('2026-11-14T08:45:00.000Z')

function toWesternDigits(value: string): string {
  return value.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
}

function formatWesternSyncStamp(iso: string): string {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) {
    return computeOdooFreshnessStatus(DEFAULT_SNAPSHOT_LATEST_RECORD_ISO, DETERMINISTIC_SSR_REF_NOW_MS)
      .kuwaitTimestamp
  }
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(target)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    const dd = get('day')
    const mm = get('month')
    const yyyy = get('year')
    const hh = get('hour') === '24' ? '00' : get('hour')
    const min = get('minute')
    if (dd && mm && yyyy && hh && min) {
      return toWesternDigits(`${dd}/${mm}/${yyyy} ${hh}:${min} UTC+3`)
    }
  } catch {
    // deterministic UTC+3 fallback
  }
  return computeOdooFreshnessStatus(iso, DETERMINISTIC_SSR_REF_NOW_MS).kuwaitTimestamp
}

/**
 * Clean Official Executive Footer (`src/components/erp/ExecutiveFooter.tsx`)
 * Single canonical home for:
 * 1) Honest Odoo 17 Latest POS Record Timestamp in Kuwait Time (`Asia/Kuwait`) — NEVER faked with `new Date()`
 * 2) Automatic >24h Red Stale-Data Alert (with 1-click `Sync Now` gated to `admin` / `gm` / `dgm`) or <24h Live Sync Pill
 * 3) Data Source (`دفتر الأستاذ العام ونقاط البيع Odoo 17` / `Odoo 17 General Ledger & POS`)
 * 4) Single Audit Certificate (`<OdooAuditCertificatePill />`)
 * 5) Active Signed-In Role & Venture Foods 6x7x8 Official Entity Scope + Platform Release `v2.8`
 */
export function ExecutiveFooter({
  isAuditor = false,
  sessionRole,
}: {
  isAuditor?: boolean
  sessionRole?: ExecSessionRole
} = {}) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { liveSummary, syncingOdoo, syncCooldownSec, triggerOdooSyncNow } = useGlobalFilter()
  const gov = useOptionalGovernance()
  const activeRole: ExecSessionRole =
    isAuditor || liveSummary?.readOnly === true
      ? 'auditor'
      : (sessionRole ?? gov?.sessionRole ?? (gov?.isAuditor ? 'auditor' : 'admin'))
  const roleProfile = resolveExecRoleProfile(activeRole)
  const isAdminRole = activeRole === 'admin'
  const [syncing, setSyncing] = useState(false)
  const [adminDiagOpen, setAdminDiagOpen] = useState(false)
  const [lastSyncedRecordIso, setLastSyncedRecordIso] = useState<string | undefined>(undefined)
  const [referenceNowMs, setReferenceNowMs] = useState<number>(DETERMINISTIC_SSR_REF_NOW_MS)

  useEffect(() => {
    setReferenceNowMs(Date.now())
  }, [
    lastSyncedRecordIso,
    liveSummary?.latestOdooRecordAt,
    liveSummary?.latestRecordAt,
    liveSummary?.syncedAt,
  ])

  const triggerLedgerSync = useCallback(async (silent = false) => {
    if (roleProfile.isAuditor || (!silent && !canTriggerManualOdooSync(activeRole))) return
    if (!silent) {
      setSyncing(true)
      try {
        await triggerOdooSyncNow()
        setReferenceNowMs(Date.now())
      } finally {
        setSyncing(false)
      }
      return
    }
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
      const honestRecordIso =
        summary.latestOdooRecordAt ??
        summary.latestRecordAt ??
        summary.syncedAt ??
        SNAPSHOT_LATEST_RECORD_ISO
      setLastSyncedRecordIso(honestRecordIso)
      setReferenceNowMs(Date.now())
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: summary }))
    } catch {
      // silent fallback to verified Odoo 17 snapshot
    }
  }, [roleProfile.isAuditor, triggerOdooSyncNow])

  useEffect(() => {
    // Auditor read-only sessions never trigger background write syncs; executives refresh silently every 15 minutes
    if (roleProfile.isAuditor) return undefined
    let initTimer: number | undefined
    try {
      const last = Number(window.localStorage.getItem(LAST_SYNC_STORAGE_KEY) || '0')
      if (!last || Date.now() - last > FIFTEEN_MINUTES_MS) {
        initTimer = window.setTimeout(() => {
          void triggerLedgerSync(true)
        }, 1400)
      }
    } catch {
      // ignore storage errors
    }
    const intervalId = window.setInterval(() => {
      void triggerLedgerSync(true)
    }, FIFTEEN_MINUTES_MS)
    return () => {
      if (initTimer !== undefined) window.clearTimeout(initTimer)
      window.clearInterval(intervalId)
    }
  }, [roleProfile.isAuditor, triggerLedgerSync])

  const activeLatestRecordIso =
    lastSyncedRecordIso ??
    liveSummary?.latestOdooRecordAt ??
    liveSummary?.latestRecordAt ??
    liveSummary?.syncedAt ??
    SNAPSHOT_LATEST_RECORD_ISO

  const syncStamp = useMemo(
    () => formatWesternSyncStamp(activeLatestRecordIso),
    [activeLatestRecordIso],
  )

  const freshness = useMemo(
    () => computeOdooFreshnessStatus(activeLatestRecordIso, referenceNowMs),
    [activeLatestRecordIso, referenceNowMs],
  )

  const cleanExecutiveStatusSentence = isAr
    ? `البيانات محدّثة حتى ${freshness.kuwaitDateArLong}`
    : `Data updated through ${freshness.kuwaitDateEn}`

  return (
    <footer
      dir={isAr ? 'rtl' : 'ltr'}
      aria-label={isAr ? 'تذييل المنصة التنفيذي الرسمي' : 'Official Executive Platform Footer'}
      className="no-print mt-8 space-y-3 border-t border-slate-200/70 pt-4 pb-2 text-[13px] tabular-nums text-slate-600 dark:border-white/[0.07] dark:text-slate-300"
    >
      {/* Single Calm Executive Data-Freshness Status Bar (ONLY location across all /erp/* pages) */}
      <div
        role="status"
        data-latest-odoo-record-at={freshness.kuwaitIso}
        data-odoo-freshness={
          freshness.isStaleOver24h
            ? 'stale'
            : liveSummary?.sourceMode === 'cached-live'
              ? 'cached'
              : 'live'
        }
        className={`relative flex flex-wrap items-center justify-between gap-2.5 rounded-2xl px-4 py-2.5 text-[13px] font-semibold ring-1 ${
          freshness.isStaleOver24h
            ? 'bg-slate-100/90 text-slate-800 ring-slate-900/10 dark:bg-[#101815] dark:text-slate-200 dark:ring-white/10'
            : liveSummary?.sourceMode === 'cached-live'
              ? 'bg-amber-50/90 text-amber-900 ring-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-500/30'
              : 'bg-emerald-50/85 text-emerald-900 ring-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-500/30'
        }`}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
              freshness.isStaleOver24h ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <span className="min-w-0 whitespace-normal break-words leading-snug">
            {cleanExecutiveStatusSentence}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Strictly Admin-Only (`role === 'admin'`) Technical Sync Diagnostics Popover */}
          {isAdminRole ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAdminDiagOpen((v) => !v)}
                aria-expanded={adminDiagOpen}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/10 transition-colors hover:bg-white dark:bg-[#141F1B] dark:text-emerald-200 dark:ring-emerald-400/20"
              >
                <span>{isAr ? 'تشخيص المزامنة' : 'Sync Diagnostics'}</span>
              </button>

              {adminDiagOpen ? (
                <div
                  role="dialog"
                  aria-label={isAr ? 'تفاصيل تشخيص مسؤول النظام' : 'System Admin Sync Diagnostics'}
                  className="absolute bottom-full end-0 z-50 mb-2 w-72 space-y-1.5 rounded-2xl bg-white p-3.5 text-xs font-medium text-slate-700 shadow-xl ring-1 ring-slate-900/10 dark:bg-[#101815] dark:text-slate-200 dark:ring-emerald-400/20"
                >
                  <div className="font-bold text-slate-900 dark:text-white">
                    {isAr ? 'تشخيص مسؤول النظام فقط' : 'Admin-Only Sync Telemetry'}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>{isAr ? 'الوضع:' : 'Mode:'}</span>
                    <span dir="ltr" className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                      {liveSummary?.sourceMode ?? 'verified-baseline'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>{isAr ? 'جدولة التحديث:' : 'Auto-Refresh:'}</span>
                    <span>{isAr ? 'كل 15 دقيقة' : 'Every 15 min'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>{isAr ? 'عمر آخر سجل:' : 'Record Age:'}</span>
                    <span dir="ltr" className="font-mono">
                      {freshness.hoursSinceLatestOdooRecord}h
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>{isAr ? 'تنبيه >24 ساعة:' : '>24h Watchdog:'}</span>
                    <span>Email + WhatsApp</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!roleProfile.isAuditor ? (
            canTriggerManualOdooSync(activeRole) ? (
              <button
                type="button"
                onClick={() => void triggerLedgerSync(false)}
                disabled={syncing || syncingOdoo || syncCooldownSec > 0}
                aria-label={isAr ? 'تحديث الربط الآن' : 'Refresh — Sync Odoo Now — Sync Now'}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition-colors disabled:opacity-60 ${
                  freshness.isStaleOver24h
                    ? 'bg-white text-slate-800 ring-1 ring-slate-900/10 hover:bg-slate-50 dark:bg-[#090E0C] dark:text-slate-100'
                    : liveSummary?.sourceMode === 'cached-live'
                      ? 'bg-white text-amber-900 ring-1 ring-amber-500/30 hover:bg-amber-100/70 dark:bg-[#141F1B] dark:text-amber-200'
                      : 'bg-white text-emerald-900 ring-1 ring-emerald-500/25 hover:bg-emerald-100/70 dark:bg-[#141F1B] dark:text-emerald-200'
                }`}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 shrink-0 ${syncing || syncingOdoo ? 'animate-spin' : ''}`}
                />
                <span>
                  {syncCooldownSec > 0
                    ? isAr
                      ? `تحديث (${syncCooldownSec}ث)`
                      : `Refresh (${syncCooldownSec}s)`
                    : isAr
                      ? 'تحديث'
                      : 'Refresh'}
                </span>
              </button>
            ) : null
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
        {/* Start Group: 1) Single Audit Certificate + 2) Honest Latest Odoo 17 Record Timestamp + 3) Data Source */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <OdooAuditCertificatePill isAr={isAr} />

          {roleProfile.isAuditor || !canTriggerManualOdooSync(activeRole) ? (
            <span
              title={
                isAr
                  ? 'تاريخ ووقت آخر فاتورة مسجلة فعلياً في أودو 17 (وضع المراجعة للقراءة فقط — توقيت الكويت)'
                  : 'Actual latest Odoo 17 POS record timestamp (Read-only auditor mode — Kuwait time)'
              }
              className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-start text-[13px] font-medium tabular-nums text-slate-600 dark:text-slate-300"
            >
              <span
                aria-hidden
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                  freshness.isStaleOver24h ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
              <span>
                {isAr ? 'آخر سجل من أودو:' : 'Last record from Odoo:'}
              </span>
              <span dir="ltr" className="font-mono text-xs font-semibold tabular-nums">
                {syncStamp}
              </span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void triggerLedgerSync(false)}
              disabled={syncing || syncingOdoo || syncCooldownSec > 0}
              title={
                isAr
                  ? 'اضغط لتحديث ومطابقة أحدث فواتير أودو 17 الآن (توقيت الكويت)'
                  : 'Click to pull latest live Odoo 17 POS & ledger records now (Kuwait time)'
              }
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-2 py-1 text-start text-[13px] font-medium tabular-nums text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white"
            >
              {syncing ? (
                <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400" />
              ) : (
                <span
                  aria-hidden
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    freshness.isStaleOver24h ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                />
              )}
              <span>
                {isAr ? 'آخر سجل من أودو:' : 'Last record from Odoo:'}
              </span>
              <span dir="ltr" className="font-mono text-xs font-semibold tabular-nums">
                {syncStamp}
              </span>
            </button>
          )}

          <span aria-hidden className="hidden text-slate-300 sm:inline dark:text-white/15">
            •
          </span>

          <span className="inline-flex items-center gap-1.5 tabular-nums text-slate-600 dark:text-slate-300">
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
