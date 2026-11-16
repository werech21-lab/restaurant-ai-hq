'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { ContractAnalysis } from '@/modules/governance/client'
import type { Contract } from '@/modules/operations/client'

const selectClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)]'
const primaryBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
const noticeClass =
  'rounded-xl border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-positive)]'
const errorClass =
  'rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-negative)]'

function Workspace() {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const canAnalyze = useCan(permissions.govContractAnalyze)

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [analyses, setAnalyses] = useState<ContractAnalysis[]>([])
  const [selected, setSelected] = useState<string>('')
  const [reloadTick, setReloadTick] = useState(0)

  const reload = useCallback(() => {
    setReloadTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: Contract[] }>('/api/v1/operations/contracts', {
        signal: controller.signal,
      }),
      apiRequest<{ data: ContractAnalysis[] }>('/api/v1/governance/analyses', {
        signal: controller.signal,
      }),
    ])
      .then(([contractPage, analysisPage]) => {
        setContracts(contractPage.data)
        setAnalyses(analysisPage.data)
        setSelected((current) => current || contractPage.data[0]?.id || '')
        setPhase('ready')
        setError(null)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [reloadTick])

  const analysis = analyses.find((item) => item.contractId === selected) ?? null
  const contract = contracts.find((item) => item.id === selected) ?? null

  async function analyze() {
    if (!selected) return
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      await apiRequest('/api/v1/governance/analyses', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { contractId: selected },
      })
      setNotice(t('gov.saved'))
      reload()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <SectionCard title={t('hub.advisor')} subtitle={t('gov.summary')} locale={fmtLocale}>
        {notice ? (
          <p role="status" className={`${noticeClass} mb-4`}>
            {notice}
          </p>
        ) : null}

        {phase === 'loading' ? (
          <StateBlock state="loading" locale={fmtLocale} title={t('gov.loading')} skeletonRows={4} />
        ) : null}

        {phase === 'error' && error ? (
          <StateBlock
            state={error === 'erp.err.forbidden' ? 'forbidden' : 'error'}
            locale={fmtLocale}
            title={t(error)}
            onRetry={error === 'erp.err.forbidden' ? undefined : reload}
          />
        ) : null}

        {phase === 'ready' ? (
          <div className="space-y-4">
            {error ? (
              <p role="alert" className={errorClass}>
                {t(error)}
              </p>
            ) : null}

            {contracts.length === 0 ? (
              <StateBlock state="empty" locale={fmtLocale} title={t('gov.empty')} />
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <label className="block min-w-[220px] flex-1 text-sm font-medium text-[var(--ds-text-secondary)]">
                  {t('hub.branch.contracts')}
                  <select
                    className={selectClass}
                    value={selected}
                    onChange={(event) => setSelected(event.target.value)}
                  >
                    {contracts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} — {item.counterparty} —{' '}
                        {Number.isSafeInteger(item.valueMinor)
                          ? formatKwd(item.valueMinor / 1000, fmtLocale)
                          : UNAVAILABLE_DASH}
                      </option>
                    ))}
                  </select>
                </label>
                {canAnalyze && contract ? (
                  <button
                    className={primaryBtnClass}
                    type="button"
                    disabled={busy}
                    onClick={() => void analyze()}
                  >
                    {t('gov.analyze')}
                  </button>
                ) : null}
              </div>
            )}

            {analysis ? (
              <div className="space-y-3 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-4 text-sm text-[var(--ds-text-primary)]">
                <p className="font-semibold">
                  {t('gov.score')}:{' '}
                  <span dir="ltr" className="ds-num tabular-nums">
                    {typeof analysis.riskScore === 'number' && Number.isFinite(analysis.riskScore)
                      ? formatInt(analysis.riskScore, fmtLocale)
                      : (
                          <span
                            dir="ltr"
                            title={unavailableTooltip}
                            aria-label={unavailableTooltip}
                            data-unavailable="true"
                            style={{ color: 'var(--ds-unavailable)' }}
                          >
                            {UNAVAILABLE_DASH}
                          </span>
                        )}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">{t('gov.summary')}:</span>{' '}
                  {analysis.clausesSummaryAr}
                </p>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[var(--ds-text-muted)]">{t('gov.risks')}</p>
                  {analysis.risks.map((risk) => (
                    <p key={risk.code}>{risk.detailAr}</p>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[var(--ds-text-muted)]">
                    {t('gov.obligations')}
                  </p>
                  {analysis.obligations.map((item) => (
                    <p key={item.textAr}>{item.textAr}</p>
                  ))}
                </div>
                <p>
                  <span className="font-semibold">{t('gov.penalties')}:</span>{' '}
                  {analysis.penaltyClausesAr}
                </p>
                <p>
                  <span className="font-semibold">{t('gov.advice')}:</span>{' '}
                  {analysis.negotiationRecommendationsAr}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

export default function ContractsAdvisor({ permissions: held }: { permissions: readonly string[] }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace />
    </PermissionProvider>
  )
}
