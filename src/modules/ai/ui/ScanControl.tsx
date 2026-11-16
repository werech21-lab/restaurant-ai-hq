'use client'

import { useState } from 'react'
import { apiRequest, errorKey } from '@/components/erp/api'
import { formatInt, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { ScanResult } from '@/modules/ai/client'
import { aiErrorClass, aiNoticeClass, aiPrimaryBtn } from '@/modules/ai/ui/labels'

const skipLabels = {
  missing_permission: 'ai.skip.missing_permission',
  invalid_condition: 'ai.skip.invalid_condition',
  inactive: 'ai.skip.inactive',
} as const satisfies Record<ScanResult['skipped'][number]['reason'], MessageKey>

/** What a scan did, in numbers, and which rules could not run. */
export function ScanSummary({ result }: { result: ScanResult }) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const stats: Array<{ label: MessageKey; value: number }> = [
    { label: 'ai.scan.created', value: result.insightsCreated },
    { label: 'ai.scan.updated', value: result.insightsUpdated },
    { label: 'ai.scan.resolved', value: result.insightsResolved },
    { label: 'ai.scan.requests', value: result.approvalsCreated },
    { label: 'ai.scan.withdrawn', value: result.approvalsWithdrawn },
  ]
  return (
    <div role="status" className={`${aiNoticeClass} space-y-2`}>
      <p className="font-semibold">{t('ai.cp.scanDone')}</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {stats.map((stat) => (
          <li key={stat.label}>
            {t(stat.label)}:{' '}
            <span dir="ltr" className="ds-num font-bold tabular-nums">
              {formatInt(stat.value, fmtLocale)}
            </span>
          </li>
        ))}
      </ul>
      {result.skipped.length > 0 ? (
        <div className="text-xs font-medium text-[var(--ds-warning)]">
          <span>{t('ai.scan.skipped')}: </span>
          {result.skipped
            .map((skip) => `${t(`ai.rulekey.${skip.ruleKey}`)} (${t(skipLabels[skip.reason])})`)
            .join(locale === 'en' ? ', ' : '، ')}
        </div>
      ) : null}
    </div>
  )
}

/** Runs the full system scan. It is safe to press again: a rescan updates what exists and never duplicates it. */
export function ScanButton({ onScanned }: { onScanned: (result: ScanResult) => void }) {
  const { t } = useI18n()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)

  async function run() {
    setRunning(true)
    setError(null)
    try {
      const payload = await apiRequest<{ data: ScanResult }>('/api/v1/ai/scan', {
        method: 'POST',
        body: {},
      })
      onScanned(payload.data)
    } catch (failure) {
      setError(errorKey(failure))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => void run()} disabled={running} className={aiPrimaryBtn}>
        {running ? t('ai.scan.running') : t('ai.scan.run')}
      </button>
      {error ? (
        <p role="alert" className={aiErrorClass}>
          {t(error)}
        </p>
      ) : null}
    </div>
  )
}
