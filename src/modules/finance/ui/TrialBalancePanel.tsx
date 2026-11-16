'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { errorClass, inputClass, panelClass } from '@/components/erp/styles'
import { Badge, Money, Num, StateBlock } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { trialBalanceQuerySchema, type TrialBalance } from '@/modules/finance/client'
import { accountTypeLabels } from '@/modules/finance/ui/shared'
import { minorText, todayUtc } from '@/components/erp/actions'
import type { Phase } from '@/components/erp/common'

/**
 * The trial balance of the posted entries up to a date, with an optional opening date. The report comes from the server
 * already netted per account, so this screen only shows it; with a balanced ledger the two totals are equal to the fils.
 */
export function TrialBalancePanel({ reloadToken }: { reloadToken: number }) {
  const { locale, t } = useI18n()
  const resolvedLocale: 'ar' | 'en' = locale === 'en' ? 'en' : 'ar'
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(todayUtc)
  const [report, setReport] = useState<TrialBalance | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [retry, setRetry] = useState(0)

  // The same Zod schema the endpoint parses, so a half-typed date never becomes a request.
  const path = useMemo(() => {
    const parsed = trialBalanceQuerySchema.safeParse({ from: from === '' ? undefined : from, to })
    if (!parsed.success) return null
    const query = new URLSearchParams({ to: parsed.data.to })
    if (parsed.data.from) query.set('from', parsed.data.from)
    return `/api/v1/finance/reports/trial-balance?${query.toString()}`
  }, [from, to])

  useEffect(() => {
    if (path === null) return
    const controller = new AbortController()
    setPhase('loading')
    apiRequest<{ data: TrialBalance }>(path, { signal: controller.signal })
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
  }, [path, reloadToken, retry])

  return (
    <section className={panelClass} aria-label={t('led.tb.title')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-100">{t('led.tb.title')}</h3>
          <p className="mt-1 text-sm text-gray-300">{t('led.tb.hint')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs text-gray-300">
            {t('led.tb.from')}
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} dir="ltr" className={`${inputClass} w-auto`} />
          </label>
          <label className="block text-xs text-gray-300">
            {t('led.tb.to')}
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} dir="ltr" className={`${inputClass} w-auto`} />
          </label>
        </div>
      </div>

      {path === null ? (
        <p role="alert" className={`${errorClass} mt-4`}>
          {t('led.err.form.date')}
        </p>
      ) : null}

      {path !== null && phase === 'loading' ? (
        <div className="mt-4">
          <StateBlock state="loading" locale={resolvedLocale} compact title={t('erp.loading')} />
        </div>
      ) : null}

      {path !== null && phase === 'error' ? (
        <div className="mt-4">
          <StateBlock
            state="error"
            locale={resolvedLocale}
            description={t(loadError)}
            onRetry={() => setRetry((value) => value + 1)}
            retryLabel={t('erp.retry')}
            compact
          />
        </div>
      ) : null}

      {path !== null && phase === 'ready' && report ? (
        report.rows.length === 0 ? (
          <div className="mt-4">
            <StateBlock
              state="empty"
              locale={resolvedLocale}
              title={t('led.tb.empty')}
              description={t('led.tb.emptyHint')}
              compact
            />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-300">
              <span>
                {report.from === null ? t('led.tb.allTime') : <Num>{report.from}</Num>}
                {' → '}
                <Num>{report.to}</Num>
              </span>
              <Badge tone={report.balanced ? 'good' : 'bad'}>{t(report.balanced ? 'led.tb.balanced' : 'led.tb.unbalanced')}</Badge>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="text-gray-300">
                  <tr className="border-b border-[#30363d]">
                    <th className="px-3 py-2 text-start font-medium">{t('led.acc.code')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('led.acc.name')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('led.acc.type')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('led.line.debit')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('led.line.credit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.accountId} className="border-b border-[#30363d]/60 text-gray-200">
                      <td className="px-3 py-2">
                        <Num className="font-semibold text-blue-300">{row.code}</Num>
                      </td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{t(accountTypeLabels[row.type])}</td>
                      <td dir="ltr" className="px-3 py-2 text-end tabular-nums">
                        {row.debitMinor > 0 ? <Money value={minorText(row.debitMinor)} /> : '—'}
                      </td>
                      <td dir="ltr" className="px-3 py-2 text-end tabular-nums">
                        {row.creditMinor > 0 ? <Money value={minorText(row.creditMinor)} /> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#30363d] font-semibold text-gray-100">
                    <td className="px-3 py-2" colSpan={3}>
                      {t('led.tb.totals')}
                    </td>
                    <td dir="ltr" className="px-3 py-2 text-end tabular-nums">
                      <Money value={minorText(report.totalDebitMinor)} />
                    </td>
                    <td dir="ltr" className="px-3 py-2 text-end tabular-nums">
                      <Money value={minorText(report.totalCreditMinor)} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )
      ) : null}
    </section>
  )
}
