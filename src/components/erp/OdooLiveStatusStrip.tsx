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
import { computeOdooFreshnessStatus } from '@/lib/odoo/live-sync-core'

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

  const [referenceNowMs, setReferenceNowMs] = useState<number>(() => Date.now())

  useEffect(() => {
    setReferenceNowMs(Date.now())
  }, [
    liveSummary?.latestOdooRecordAt,
    liveSummary?.latestRecordAt,
    liveSummary?.syncedAt,
    liveSummary?.lastCheckedAt,
  ])

  const isConnected = Boolean(liveSummary?.connected)
  const activeLatestIso = isConnected
    ? (liveSummary?.latestOdooRecordAt ??
      liveSummary?.latestRecordAt ??
      liveSummary?.syncedAt ??
      null)
    : null

  const freshness = useMemo(
    () => (activeLatestIso ? computeOdooFreshnessStatus(activeLatestIso, referenceNowMs) : null),
    [activeLatestIso, referenceNowMs],
  )

  const isStale = Boolean(!isConnected || !freshness || freshness.isStaleOver24h || liveSummary?.isStale24h)
  const todayOrders = isConnected ? (liveSummary?.todayOrders ?? liveSummary?.todayOrdersCount ?? 0) : 0
  const todaySalesKwd = isConnected ? (liveSummary?.todaySalesKwd ?? 0) : 0

  const stripTone: 'connected' | 'stale' | 'disconnected' = !isConnected
    ? 'disconnected'
    : isStale
      ? 'stale'
      : 'connected'

  const stripToneClasses =
    stripTone === 'connected'
      ? 'bg-emerald-50/85 text-emerald-950 ring-emerald-500/25 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-500/30'
      : stripTone === 'stale'
        ? 'bg-amber-50/90 text-amber-950 ring-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-500/30'
        : 'bg-slate-100/90 text-slate-800 ring-slate-900/10 dark:bg-[#101C17] dark:text-slate-200 dark:ring-white/10'

  const statusText = !isConnected
    ? isAr
      ? 'لا توجد بيانات من Odoo لهذه الفترة — غير متصل بـ Odoo'
      : 'No data from Odoo for this period — Disconnected'
    : freshness
      ? isAr
        ? isStale
          ? `بيانات قديمة (>24 ساعة) • آخر سجل من Odoo: ${freshness.kuwaitTimestamp}`
          : `متصل بـ Odoo 17 • آخر سجل: ${freshness.kuwaitTimestamp}`
        : isStale
          ? `Stale (>24h) • Latest Odoo record: ${freshness.kuwaitTimestamp}`
          : `Connected to Odoo 17 • Latest record: ${freshness.kuwaitTimestamp}`
      : isAr
        ? 'جاري التحقق من اتصال Odoo 17...'
        : 'Checking Odoo 17 connection...'

  return (
    <div
      role="status"
      dir={isAr ? 'rtl' : 'ltr'}
      data-odoo-status-strip={stripTone}
      className={`no-print flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-[12px] font-semibold tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 transition-colors duration-150 ${stripToneClasses}`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="min-w-0 whitespace-normal break-words leading-snug">{statusText}</span>

        {isConnected && todayOrders > 0 ? (
          <span className="inline-flex shrink-0 items-center rounded-lg bg-white/85 px-2.5 py-0.5 text-xs font-bold text-emerald-900 ring-1 ring-emerald-500/20 dark:bg-[#101C17] dark:text-emerald-200">
            {isAr
              ? `اليوم: ${todayOrders.toLocaleString('en-US')} طلب • ${todaySalesKwd.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} د.ك`
              : `Today: ${todayOrders.toLocaleString('en-US')} orders • ${todaySalesKwd.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} KWD`}
          </span>
        ) : null}
      </div>

      {!roleProfile.isAuditor && canTriggerManualOdooSync(activeRole) ? (
        <button
          type="button"
          onClick={() => void triggerOdooSyncNow()}
          disabled={syncingOdoo || syncCooldownSec > 0}
          aria-label={isAr ? 'تحديث ربط أودو الآن' : 'Sync Odoo Now'}
          title={isAr ? 'تحديث ربط أودو الآن' : 'Sync Odoo Now'}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1 text-[13px] font-bold text-slate-800 ring-1 ring-slate-900/10 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:bg-[#101C17] dark:text-emerald-200"
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
