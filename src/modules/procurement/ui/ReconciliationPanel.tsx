'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { errorClass, panelClass, secondaryButton } from '@/components/erp/styles'
import { Badge, Money } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { ReconciliationCheck, ReconciliationReport } from '@/modules/procurement/client'
import { minorText, type Phase } from '@/modules/procurement/ui/shared'

const checkLabels: Record<ReconciliationCheck['key'], MessageKey> = {
  inventory: 'pro.rec.inventory',
  grni: 'pro.rec.grni',
  payable: 'pro.rec.payable',
}

/**
 * Compares what the ledger holds on the inventory, GRNI and payables accounts with what the documents say it must be. A
 * difference means a ledger entry and a document disagree, which is a finding for the accountant, never something to patch.
 */
export function ReconciliationPanel({ reloadToken }: { reloadToken: number }) {
  const { t } = useI18n()
  const [report, setReport] = useState<ReconciliationReport | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    apiRequest<{ data: ReconciliationReport }>('/api/v1/procurement/reconciliation', { signal: controller.signal })
      .then((payload) => {
        setReport(payload.data)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [reloadToken, retry])

  if (phase === 'loading') return <p className="py-8 text-center text-sm text-gray-400">{t('erp.loading')}</p>
  if (phase === 'error' || !report) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p role="alert" className={`${errorClass} inline-block`}>
          {t(loadError)}
        </p>
        <div>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className={secondaryButton}>
            {t('erp.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className={panelClass} aria-label={t('pro.rec.title')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-100">{t('pro.rec.title')}</h3>
          <p className="mt-1 text-sm text-gray-400">{t('pro.rec.hint')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info">{t(report.basis === 'receipt_basis' ? 'pro.acct.basis.receipt' : 'pro.acct.basis.invoice')}</Badge>
          <Badge tone={report.ok ? 'good' : 'bad'}>{t(report.ok ? 'pro.rec.ok' : 'pro.rec.mismatch')}</Badge>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="text-gray-400">
            <tr className="border-b border-[#30363d]">
              <th className="px-3 py-2 text-start font-medium">{t('pro.rec.account')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.rec.ledger')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.rec.documents')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.rec.difference')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {report.checks.map((check) => (
              <tr key={check.key} className="border-b border-[#30363d]/60 text-gray-200">
                <td className="px-3 py-2">{t(checkLabels[check.key])}</td>
                <td className="px-3 py-2">
                  <Money value={minorText(check.actualMinor)} />
                </td>
                <td className="px-3 py-2">
                  <Money value={minorText(check.expectedMinor)} />
                </td>
                <td className="px-3 py-2">
                  <Money value={minorText(check.differenceMinor)} />
                </td>
                <td className="px-3 py-2">
                  <Badge tone={check.ok ? 'good' : 'bad'}>{t(check.ok ? 'pro.rec.ok' : 'pro.rec.mismatch')}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">{t('pro.rec.note')}</p>
    </section>
  )
}
