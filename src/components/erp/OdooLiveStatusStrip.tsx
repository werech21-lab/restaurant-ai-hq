'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  resolveExecRoleProfile,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
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
const DETERMINISTIC_SSR_REF_NOW_MS = Date.parse('2026-11-12T12:00:00.000Z')

export function OdooLiveStatusStrip({
  isAuditor = false,
  sessionRole,
}: {
  isAuditor?: boolean
  sessionRole?: ExecSessionRole
}) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { liveSummary, syncingOdoo, triggerOdooSyncNow } = useGlobalFilter()
  const gov = useOptionalGovernance()

  const activeRole: ExecSessionRole = isAuditor
    ? 'auditor'
    : (sessionRole ?? gov?.sessionRole ?? (gov?.isAuditor ? 'auditor' : 'admin'))
  const roleProfile = resolveExecRoleProfile(activeRole)

  const [referenceNowMs, setReferenceNowMs] = useState<number>(DETERMINISTIC_SSR_REF_NOW_MS)

  useEffect(() => {
    setReferenceNowMs(Date.now())
  }, [liveSummary?.latestRecordAt, liveSummary?.syncedAt, liveSummary?.lastCheckedAt])

  const activeLatestIso =
    liveSummary?.latestRecordAt ?? liveSummary?.syncedAt ?? SNAPSHOT_LATEST_RECORD_ISO

  const freshness = useMemo(
    () => computeOdooFreshnessStatus(activeLatestIso, referenceNowMs),
    [activeLatestIso, referenceNowMs],
  )

  const isLiveConnectedAndFresh =
    Boolean(liveSummary?.connected || liveSummary?.source === 'live') &&
    !freshness.isStaleOver24h
  const isHealthyUnder24h = !freshness.isStaleOver24h
  const missingServerEnv =
    liveSummary !== null && liveSummary.envConfigured === false && !liveSummary.connected

  const todayOrders = liveSummary?.todayOrdersCount ?? 0
  const todaySalesKwd = liveSummary?.todaySalesKwd ?? 0

  return (
    <div
      role="status"
      dir={isAr ? 'rtl' : 'ltr'}
      data-odoo-live-strip={isHealthyUnder24h ? 'live' : 'stale'}
      className={`no-print flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-[12px] font-semibold tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 transition-colors duration-150 ${
        isHealthyUnder24h
          ? 'bg-emerald-50/85 text-emerald-950 ring-emerald-500/25 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-500/30'
          : 'bg-rose-50/90 text-rose-950 ring-rose-500/25 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-500/30'
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="min-w-0 whitespace-normal break-words leading-snug">
          {isLiveConnectedAndFresh || isHealthyUnder24h
            ? isAr
              ? freshness.liveConnectedBadgeAr
              : freshness.liveConnectedBadgeEn
            : isAr
              ? freshness.badgeAr
              : freshness.badgeEn}
        </span>

        {isLiveConnectedAndFresh && todayOrders > 0 ? (
          <span className="inline-flex shrink-0 items-center rounded-lg bg-white/85 px-2 py-0.5 text-[11px] font-bold text-emerald-900 ring-1 ring-emerald-500/20 dark:bg-[#101C17] dark:text-emerald-200">
            {isAr
              ? `اليوم: ${todayOrders.toLocaleString('en-US')} طلب • ${Math.round(todaySalesKwd).toLocaleString('en-US')} د.ك`
              : `Today: ${todayOrders.toLocaleString('en-US')} orders • ${Math.round(todaySalesKwd).toLocaleString('en-US')} KWD`}
          </span>
        ) : null}

        {missingServerEnv ? (
          <span className="text-[11px] font-medium text-rose-800/90 dark:text-rose-200/90">
            {isAr
              ? '• لتفعيل الربط الحي تلقائياً أضف مفاتيح أودو في إعدادات البيئة على Vercel'
              : '• Add ODOO_URL, ODOO_DB, ODOO_USERNAME & ODOO_API_KEY in Vercel env vars for live sync'}
          </span>
        ) : null}
      </div>

      {!roleProfile.isAuditor ? (
        <button
          type="button"
          onClick={() => void triggerOdooSyncNow()}
          disabled={syncingOdoo}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1 text-[11.5px] font-bold transition-colors disabled:opacity-60 ${
            isHealthyUnder24h
              ? 'bg-white text-emerald-900 ring-1 ring-emerald-500/25 hover:bg-emerald-100/70 dark:bg-[#101C17] dark:text-emerald-200'
              : 'btn-colored bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:text-white'
          }`}
        >
          <RefreshCw className={`h-3 w-3 shrink-0 ${syncingOdoo ? 'animate-spin' : ''}`} />
          <span>{isAr ? 'تحديث ربط أودو الآن' : 'Sync Odoo Now'}</span>
        </button>
      ) : null}
    </div>
  )
}
