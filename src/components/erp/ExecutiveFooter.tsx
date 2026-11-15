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
import { useOptionalGovernance } from '@/components/erp/GovernanceBellDrawer'
import {
  computeOdooFreshnessStatus,
  type OdooLiveSummary,
} from '@/lib/odoo/live-sync-core'

const LAST_SYNC_STORAGE_KEY = 'vf_last_silent_odoo_sync_ts_v12'
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000

function toWesternDigits(value: string): string {
  return value.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
}

function formatWesternSyncStamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return null
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
  } catch {}
  return null
}

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
  const [referenceNowMs, setReferenceNowMs] = useState<number>(() => Date.now())

  useEffect(() => {
    setReferenceNowMs(Date.now())
  }, [
    lastSyncedRecordIso,
    liveSummary?.latestOdooRecordAt,
    liveSummary?.latestRecordAt,
    liveSummary?.syncedAt,
  ])

  const triggerLedgerSync = useCallback(
    async (silent = false) => {
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
        } catch {}
        const honestRecordIso =
          summary.latestOdooRecordAt ?? summary.latestRecordAt ?? summary.syncedAt ?? undefined
        if (honestRecordIso) {
          setLastSyncedRecordIso(honestRecordIso)
        }
        setReferenceNowMs(Date.now())
        window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: summary }))
      } catch {}
    },
    [activeRole, roleProfile.isAuditor, triggerOdooSyncNow],
  )

  useEffect(() => {
    if (roleProfile.isAuditor) return undefined
    let initTimer: number | undefined
    try {
      const last = Number(window.localStorage.getItem(LAST_SYNC_STORAGE_KEY) || '0')
      if (!last || Date.now() - last > FIFTEEN_MINUTES_MS) {
        initTimer = window.setTimeout(() => {
          void triggerLedgerSync(true)
        }, 1400)
      }
    } catch {}
    const intervalId = window.setInterval(() => {
      void triggerLedgerSync(true)
    }, FIFTEEN_MINUTES_MS)
    return () => {
      if (initTimer !== undefined) window.clearTimeout(initTimer)
      window.clearInterval(intervalId)
    }
  }, [roleProfile.isAuditor, triggerLedgerSync])

  const isConnected = Boolean(liveSummary?.connected)
  const activeLatestRecordIso = isConnected
    ? (lastSyncedRecordIso ??
      liveSummary?.latestOdooRecordAt ??
      liveSummary?.latestRecordAt ??
      liveSummary?.syncedAt ??
      null)
    : null

  const syncStamp = useMemo(
    () => formatWesternSyncStamp(activeLatestRecordIso),
    [activeLatestRecordIso],
  )

  const freshness = useMemo(
    () =>
      activeLatestRecordIso
        ? computeOdooFreshnessStatus(activeLatestRecordIso, referenceNowMs)
        : null,
    [activeLatestRecordIso, referenceNowMs],
  )

  const isStale = Boolean(!isConnected || !freshness || freshness.isStaleOver24h || liveSummary?.isStale24h)

  const statusSentence = !isConnected
    ? isAr
      ? 'لا توجد بيانات من Odoo لهذه الفترة — الاتصال بـ Odoo غير متاح حالياً'
      : 'No data from Odoo for this period — Odoo connection unavailable'
    : freshness
      ? isAr
        ? freshness.isStaleOver24h
          ? `بيانات قديمة (>24 ساعة) — آخر سجل من Odoo حتى ${freshness.kuwaitDateArLong}`
          : `آخر سجل مستلم من Odoo حتى ${freshness.kuwaitDateArLong}`
        : freshness.isStaleOver24h
          ? `Stale data (>24h) — latest Odoo record through ${freshness.kuwaitDateEn}`
          : `Latest record from Odoo through ${freshness.kuwaitDateEn}`
      : isAr
        ? 'بانتظار استجابة المزامنة من Odoo 17'
        : 'Awaiting sync response from Odoo 17'

  return (
    <footer
      dir={isAr ? 'rtl' : 'ltr'}
      aria-label={isAr ? 'تذييل المنصة التنفيذي' : 'Executive Platform Footer'}
      className="no-print mt-8 space-y-3 border-t border-slate-200/70 pt-4 pb-2 text-[13px] tabular-nums text-slate-600 dark:border-white/[0.07] dark:text-slate-300"
    >
      <div
        role="status"
        data-odoo-freshness={!isConnected ? 'disconnected' : isStale ? 'stale' : 'connected'}
        className={`relative flex flex-wrap items-center justify-between gap-2.5 rounded-2xl px-4 py-2.5 text-[13px] font-semibold ring-1 ${
          !isConnected || isStale
            ? 'bg-amber-50/90 text-amber-900 ring-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-500/30'
            : 'bg-emerald-50/85 text-emerald-900 ring-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-500/30'
        }`}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
              !isConnected ? 'bg-rose-500' : isStale ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <span className="min-w-0 whitespace-normal break-words leading-snug">
            {statusSentence}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
                  className="absolute end-0 bottom-full z-50 mb-2 w-72 space-y-1.5 rounded-2xl bg-white p-3.5 text-xs font-medium text-slate-700 shadow-xl ring-1 ring-slate-900/10 dark:bg-[#101815] dark:text-slate-200 dark:ring-emerald-400/20"
                >
                  <div className="font-bold text-slate-900 dark:text-white">
                    {isAr ? 'تشخيص مسؤول النظام فقط' : 'Admin-Only Sync Telemetry'}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>{isAr ? 'حالة الربط:' : 'Connection:'}</span>
                    <span className="font-mono font-semibold">
                      {isConnected
                        ? isAr
                          ? 'متصل بـ Odoo 17'
                          : 'Connected to Odoo 17'
                        : isAr
                          ? 'غير متصل'
                          : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>{isAr ? 'جدولة التحديث:' : 'Auto-Refresh:'}</span>
                    <span>{isAr ? 'كل 15 دقيقة' : 'Every 15 min'}</span>
                  </div>
                  {freshness ? (
                    <div className="flex items-center justify-between gap-2">
                      <span>{isAr ? 'عمر آخر سجل:' : 'Record Age:'}</span>
                      <span className="font-mono">
                        {isAr
                          ? `${freshness.hoursSinceLatestOdooRecord} ساعة`
                          : `${freshness.hoursSinceLatestOdooRecord}h`}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {!roleProfile.isAuditor && canTriggerManualOdooSync(activeRole) ? (
            <button
              type="button"
              onClick={() => void triggerLedgerSync(false)}
              disabled={syncing || syncingOdoo || syncCooldownSec > 0}
              aria-label={isAr ? 'تحديث الربط الآن' : 'Sync Odoo Now'}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1 text-xs font-bold text-slate-800 ring-1 ring-slate-900/10 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:bg-[#141F1B] dark:text-emerald-200"
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
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-start text-[13px] font-medium tabular-nums text-slate-600 dark:text-slate-300">
            <span
              aria-hidden
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                !isConnected ? 'bg-rose-500' : isStale ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <span>{isAr ? 'آخر سجل من أودو:' : 'Last record from Odoo:'}</span>
            <span dir="ltr" className="font-mono text-xs font-semibold tabular-nums">
              {syncStamp ?? (isAr ? 'غير متصل' : 'Disconnected')}
            </span>
          </span>

          <span aria-hidden className="hidden text-slate-300 sm:inline dark:text-white/15">
            •
          </span>

          <span className="inline-flex items-center gap-1.5 tabular-nums text-slate-600 dark:text-slate-300">
            <Database className="h-3.5 w-3.5 shrink-0 text-emerald-600/80 dark:text-emerald-400/80" />
            <span>
              {isAr
                ? 'مصدر البيانات: دفتر الأستاذ العام ونقاط البيع في أودو 17'
                : 'Data Source: Odoo 17 General Ledger & POS'}
            </span>
          </span>
        </div>

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
              ? 'شركة فنتشر فودز • 6 علامات تجارية • 7 فروع (+ غير منسوب لفرع)'
              : 'Venture Foods Co. • 6 Brands • 7 Branches (+ Unattributed)'}
          </span>
        </div>
      </div>
    </footer>
  )
}

export default ExecutiveFooter
