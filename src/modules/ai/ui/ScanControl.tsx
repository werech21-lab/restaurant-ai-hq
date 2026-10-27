'use client'

import { useState } from 'react'
import { apiRequest, errorKey } from '@/components/erp/api'
import { errorClass, noticeClass, primaryButton } from '@/components/erp/styles'
import { Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { ScanResult } from '@/modules/ai/client'

const skipLabels = {
  missing_permission: 'ai.skip.missing_permission',
  invalid_condition: 'ai.skip.invalid_condition',
  inactive: 'ai.skip.inactive',
} as const satisfies Record<ScanResult['skipped'][number]['reason'], MessageKey>

/** What a scan did, in numbers, and which rules could not run. */
export function ScanSummary({ result }: { result: ScanResult }) {
  const { t } = useI18n()
  const stats: Array<{ label: MessageKey; value: number }> = [
    { label: 'ai.scan.created', value: result.insightsCreated },
    { label: 'ai.scan.updated', value: result.insightsUpdated },
    { label: 'ai.scan.resolved', value: result.insightsResolved },
    { label: 'ai.scan.requests', value: result.approvalsCreated },
    { label: 'ai.scan.withdrawn', value: result.approvalsWithdrawn },
  ]
  return (
    <div role="status" className={`${noticeClass} space-y-2`}>
      <p className="font-semibold">{t('ai.cp.scanDone')}</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {stats.map((stat) => (
          <li key={stat.label}>
            {t(stat.label)}: <Num>{stat.value}</Num>
          </li>
        ))}
      </ul>
      {result.skipped.length > 0 ? (
        <div className="text-xs text-amber-200">
          <span>{t('ai.scan.skipped')}: </span>
          {result.skipped.map((skip) => `${t(`ai.rulekey.${skip.ruleKey}`)} (${t(skipLabels[skip.reason])})`).join('، ')}
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
      const payload = await apiRequest<{ data: ScanResult }>('/api/v1/ai/scan', { method: 'POST', body: {} })
      onScanned(payload.data)
    } catch (failure) {
      setError(errorKey(failure))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => void run()} disabled={running} className={primaryButton}>
        {running ? t('ai.scan.running') : t('ai.scan.run')}
      </button>
      {error ? (
        <p role="alert" className={errorClass}>
          {t(error)}
        </p>
      ) : null}
    </div>
  )
}
