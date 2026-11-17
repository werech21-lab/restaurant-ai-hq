'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { Badge, Num } from '@/components/ui'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type {
  ReconciliationCheck,
  ReconciliationReport,
} from '@/modules/procurement/client'
import { formatMinorKwd, type Phase } from '@/modules/procurement/ui/shared'

const checkLabels: Record<ReconciliationCheck['key'], MessageKey> = {
  inventory: 'pro.rec.inventory',
  grni: 'pro.rec.grni',
  payable: 'pro.rec.payable',
}

/** Compares ledger balances with procurement document totals. */
export function ReconciliationPanel({ reloadToken }: { reloadToken: number }) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const [report, setReport] = useState<ReconciliationReport | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    apiRequest<{ data: ReconciliationReport }>('/api/v1/procurement/reconciliation', {
      signal: controller.signal,
    })
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

  if (phase === 'loading') {
    return (
      <StateBlock
        state="loading"
        locale={fmtLocale}
        skeletonRows={4}
        title={t('erp.loading')}
      />
    )
  }
  if (phase === 'error' || !report) {
    return (
      <StateBlock
        state={loadError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
        locale={fmtLocale}
        title={t(loadError)}
        onRetry={
          loadError === 'erp.err.forbidden'
            ? undefined
            : () => setRetry((value) => value + 1)
        }
      />
    )
  }

  return (
    <SectionCard
      locale={fmtLocale}
      ariaLabel={t('pro.rec.title')}
      title={t('pro.rec.title')}
      subtitle={t('pro.rec.hint')}
      actions={
        <div className="flex items-center gap-2">
          <Badge tone="info">
            {t(
              report.basis === 'receipt_basis'
                ? 'pro.acct.basis.receipt'
                : 'pro.acct.basis.invoice',
            )}
          </Badge>
          <Badge tone={report.ok ? 'good' : 'bad'}>
            {t(report.ok ? 'pro.rec.ok' : 'pro.rec.mismatch')}
          </Badge>
        </div>
      }
      footer={t('pro.rec.note')}
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 text-start">{t('pro.rec.account')}</th>
              <th className="px-3 py-2 text-end">{t('pro.rec.ledger')}</th>
              <th className="px-3 py-2 text-end">{t('pro.rec.documents')}</th>
              <th className="px-3 py-2 text-end">{t('pro.rec.difference')}</th>
              <th className="px-3 py-2 text-start">{t('pro.col.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ds-border-hairline)] text-slate-800 dark:text-slate-100">
            {report.checks.map((check) => (
              <tr key={check.key}>
                <td className="px-3 py-2">{t(checkLabels[check.key])}</td>
                <td className="px-3 py-2 text-end">
                  <Num>{formatMinorKwd(check.actualMinor, fmtLocale)}</Num>
                </td>
                <td className="px-3 py-2 text-end">
                  <Num>{formatMinorKwd(check.expectedMinor, fmtLocale)}</Num>
                </td>
                <td className="px-3 py-2 text-end font-semibold">
                  <Num>{formatMinorKwd(check.differenceMinor, fmtLocale)}</Num>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={check.ok ? 'good' : 'bad'}>
                    {t(check.ok ? 'pro.rec.ok' : 'pro.rec.mismatch')}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
