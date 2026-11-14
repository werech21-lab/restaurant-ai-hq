'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  resolveExecRoleProfile,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import { canTriggerManualOdooSync } from '@/lib/auth/role-access-policy'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useOptionalGovernance } from '@/components/erp/GovernanceBellDrawer'
import ODOO_SNAPSHOT from '@/lib/odoo-live-snapshot.json'
import {
  computeOdooFreshnessStatus,
  DEFAULT_SNAPSHOT_LATEST_RECORD_ISO,
  resolveSnapshotLatestRecordInfo,
} from '@/lib/odoo/live-sync-core'

const SNAPSHOT_LATEST_RECORD_ISO =
  resolveSnapshotLatestRecordInfo(ODOO_SNAPSHOT).latestRecordAt ||
  DEFAULT_SNAPSHOT_LATEST_RECORD_ISO

/** Deterministic SSR reference clock so initial HTML never flickers on hydration. */
const DETERMINISTIC_SSR_REF_NOW_MS = Date.parse('2026-11-14T08:45:00.000Z')

export function OdooLiveStatusStrip({
  isAuditor = false,
  sessionRole,
}: {
  isAuditor?: boolean
  sessionRole?: ExecSessionRole
}) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { liveSummary, syncingOdoo, syncCooldownSec, triggerOdooSyncNow } = useGlobalFilter()
  const gov = useOptionalGovernance()

  const activeRole: ExecSessionRole =
    isAuditor || liveSummary?.readOnly === true
      ? 'auditor'
      : (sessionRole ?? gov?.sessionRole ?? (gov?.isAuditor ? 'auditor' : 'admin'))
  const roleProfile = resolveExecRoleProfile(activeRole)

  const [referenceNowMs, setReferenceNowMs] = useState<number>(DETERMINISTIC_SSR_REF_NOW_MS)

  useEffect(() => {
    setReferenceNowMs(Date.now())
  }, [
    liveSummary?.latestOdooRecordAt,
    liveSummary?.latestRecordAt,
    liveSummary?.syncedAt,
    liveSummary?.lastCheckedAt,
  ])

  const activeLatestIso =
    liveSummary?.latestOdooRecordAt ??
    liveSummary?.latestRecordAt ??
    liveSummary?.syncedAt ??
    SNAPSHOT_LATEST_RECORD_ISO

  const freshness = useMemo(
    () => computeOdooFreshnessStatus(activeLatestIso, referenceNowMs),
    [activeLatestIso, referenceNowMs],
  )

  const isCachedFallback = liveSummary?.sourceMode === 'cached-live'
  const isLiveConnectedAndFresh =
    Boolean(liveSummary?.connected || liveSummary?.sourceMode === 'odoo17-live') &&
    !freshness.isStaleOver24h &&
    !isCachedFallback
  const isHealthyUnder24h = !freshness.isStaleOver24h && !isCachedFallback

  const todayOrders = liveSummary?.todayOrders ?? liveSummary?.todayOrdersCount ?? 0
  const todaySalesKwd = liveSummary?.todaySalesKwd ?? 0

  const stripTone: 'live' | 'cached' | 'stale' =
    !freshness.isStaleOver24h && isCachedFallback
      ? 'cached'
      : isHealthyUnder24h
        ? 'live'
        : 'stale'

  const stripToneClasses =
    stripTone === 'live'
      ? 'bg-emerald-50/85 text-emerald-950 ring-emerald-500/25 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-500/30'
      : stripTone === 'cached'
        ? 'bg-amber-50/90 text-amber-950 ring-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-500/30'
        : 'bg-slate-100/90 text-slate-800 ring-slate-900/10 dark:bg-[#101C17] dark:text-slate-200 dark:ring-white/10'

  const statusText =
    stripTone === 'cached'
      ? isAr
        ? freshness.cachedSnapshotBadgeAr
        : freshness.cachedSnapshotBadgeEn
      : stripTone === 'live'
        ? isAr
          ? freshness.liveConnectedBadgeAr
          : freshness.liveConnectedBadgeEn
        : isAr
          ? freshness.badgeAr
          : freshness.badgeEn

  return (
    <div
      role="status"
      dir={isAr ? 'rtl' : 'ltr'}
      data-odoo-live-strip={stripTone}
      data-latest-odoo-record-at={freshness.kuwaitIso}
      className={`no-print flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-[12px] font-semibold tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 transition-colors duration-150 ${stripToneClasses}`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="min-w-0 whitespace-normal break-words leading-snug">
          {statusText}
        </span>

        {(isLiveConnectedAndFresh || isCachedFallback) && todayOrders > 0 ? (
          <span
            className={`inline-flex shrink-0 items-center rounded-lg bg-white/85 px-2.5 py-0.5 text-xs font-bold ring-1 dark:bg-[#101C17] ${
              isCachedFallback
                ? 'text-amber-900 ring-amber-500/25 dark:text-amber-200'
                : 'text-emerald-900 ring-emerald-500/20 dark:text-emerald-200'
            }`}
          >
            {isAr
              ? `اليوم: ${todayOrders.toLocaleString('en-US')} طلب • ${Math.round(todaySalesKwd).toLocaleString('en-US')} د.ك`
              : `Today: ${todayOrders.toLocaleString('en-US')} orders • ${Math.round(todaySalesKwd).toLocaleString('en-US')} KWD`}
          </span>
        ) : null}
      </div>

      {!roleProfile.isAuditor && canTriggerManualOdooSync(activeRole) ? (
        <button
          type="button"
          onClick={() => void triggerOdooSyncNow()}
          disabled={syncingOdoo || syncCooldownSec > 0}
          aria-label={isAr ? 'تحديث ربط أودو الآن' : 'Refresh — Sync Odoo Now'}
          title={isAr ? 'تحديث ربط أودو الآن' : 'Refresh — Sync Odoo Now'}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1 text-[13px] font-bold transition-colors disabled:opacity-60 ${
            stripTone === 'live'
              ? 'bg-white text-emerald-900 ring-1 ring-emerald-500/25 hover:bg-emerald-100/70 dark:bg-[#101C17] dark:text-emerald-200'
              : stripTone === 'cached'
                ? 'bg-white text-amber-900 ring-1 ring-amber-500/30 hover:bg-amber-100/70 dark:bg-[#101C17] dark:text-amber-200'
                : 'btn-colored bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:text-white'
          }`}
        >
          <RefreshCw className={`h-3 w-3 shrink-0 ${syncingOdoo ? 'animate-spin' : ''}`} />
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
  )
}
