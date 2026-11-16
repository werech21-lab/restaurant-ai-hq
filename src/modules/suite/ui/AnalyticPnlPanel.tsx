'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey } from '@/components/erp/api'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { formatInt, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { buildAnalyticMatrix, type AnalyticCell } from '@/modules/suite/domain/analytic-matrix'
import type { SuiteBoard } from '@/modules/suite/client'
import { SuiteMoney, suitePrimaryBtn, suiteSecondaryBtn } from '@/modules/suite/ui/shared'

type Mode = 'matrix' | 'brand' | 'branch'

const healthClass: Record<AnalyticCell['health'], string> = {
  good: 'border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] text-[var(--ds-positive)]',
  warn: 'border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]',
  bad: 'border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] text-[var(--ds-negative)]',
}

export default function AnalyticPnlPanel() {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [board, setBoard] = useState<SuiteBoard | null>(null)
  const [mode, setMode] = useState<Mode>('matrix')
  const [reloadTick, setReloadTick] = useState(0)

  const reload = useCallback(() => {
    setReloadTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    apiRequest<{ data: SuiteBoard }>('/api/v1/suite/analytic', { signal: controller.signal })
      .then((page) => {
        setBoard(page.data)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [reloadTick])

  const matrix = useMemo(() => {
    if (!board) return []
    return buildAnalyticMatrix(
      board.records.map((row) => ({
        brandName: row.brandName || '—',
        branchName: row.branchName || '—',
        amountMinor: Number(row.amountMinor || 0),
      })),
    )
  }, [board])

  const brands = useMemo(() => [...new Set(matrix.map((cell) => cell.brandName))], [matrix])
  const branches = useMemo(() => [...new Set(matrix.map((cell) => cell.branchName))], [matrix])

  const summaryRows = useMemo(() => {
    const acc = new Map<string, number>()
    for (const cell of matrix) {
      const key = mode === 'brand' ? cell.brandName : cell.branchName
      acc.set(key, (acc.get(key) ?? 0) + cell.netProfitMinor)
    }
    return [...acc.entries()].sort((a, b) => b[1] - a[1])
  }, [matrix, mode])

  if (phase === 'loading') {
    return (
      <SectionCard title={t('spec.analytic')} subtitle={t('fin.analytic.matrix')} locale={fmtLocale}>
        <StateBlock state="loading" locale={fmtLocale} title={t('suite.loading')} skeletonRows={4} />
      </SectionCard>
    )
  }

  if (phase === 'error') {
    const forbidden = error === 'erp.err.forbidden'
    return (
      <SectionCard title={t('spec.analytic')} subtitle={t('fin.analytic.matrix')} locale={fmtLocale}>
        <StateBlock
          state={forbidden ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(error)}
          onRetry={forbidden ? undefined : reload}
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title={t('spec.analytic')}
      subtitle={t('fin.analytic.matrix')}
      locale={fmtLocale}
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={mode === 'matrix' ? suitePrimaryBtn : suiteSecondaryBtn}
            onClick={() => setMode('matrix')}
          >
            {t('fin.analytic.matrix')}
          </button>
          <button
            type="button"
            className={mode === 'brand' ? suitePrimaryBtn : suiteSecondaryBtn}
            onClick={() => setMode('brand')}
          >
            {t('suite.facet.brand')}
          </button>
          <button
            type="button"
            className={mode === 'branch' ? suitePrimaryBtn : suiteSecondaryBtn}
            onClick={() => setMode('branch')}
          >
            {t('hr.facet.location')}
          </button>
        </div>
      }
    >
      {matrix.length === 0 ? (
        <StateBlock state="empty" locale={fmtLocale} title={t('suite.empty')} />
      ) : null}

      {mode === 'matrix' && matrix.length > 0 ? (
        <div className="space-y-2">
          <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
            <table className="w-full min-w-[740px] border-collapse text-xs sm:text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
                <tr>
                  <th className="px-3 py-2.5 text-start">{t('suite.facet.brand')}</th>
                  <th className="px-3 py-2.5 text-start">{t('hr.facet.location')}</th>
                  <th className="px-3 py-2.5 text-end">{t('fin.analytic.revenue')}</th>
                  <th className="px-3 py-2.5 text-end">{t('fin.analytic.foodCost')}</th>
                  <th className="px-3 py-2.5 text-end">{t('fin.analytic.payroll')}</th>
                  <th className="px-3 py-2.5 text-end">{t('fin.analytic.commission')}</th>
                  <th className="px-3 py-2.5 text-end">{t('fin.analytic.net')}</th>
                  <th className="px-3 py-2.5 text-start">{isAr ? 'الصحة' : 'Health'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {matrix.map((cell) => (
                  <tr
                    key={`${cell.brandName}:${cell.branchName}`}
                    className="hover:bg-[var(--ds-bg-hover)]"
                  >
                    <td className="px-3 py-2.5 font-medium text-[var(--ds-text-primary)]">
                      {cell.brandName}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--ds-text-secondary)]">
                      {cell.branchName}
                    </td>
                    <td className="px-3 py-2.5 text-end font-semibold text-[var(--ds-text-primary)]">
                      <SuiteMoney minor={cell.revenueMinor} />
                    </td>
                    <td className="px-3 py-2.5 text-end text-[var(--ds-text-secondary)]">
                      <SuiteMoney minor={cell.foodCostMinor} />
                    </td>
                    <td className="px-3 py-2.5 text-end text-[var(--ds-text-secondary)]">
                      <SuiteMoney minor={cell.payrollMinor} />
                    </td>
                    <td className="px-3 py-2.5 text-end text-[var(--ds-text-secondary)]">
                      <SuiteMoney minor={cell.commissionMinor} />
                    </td>
                    <td className="px-3 py-2.5 text-end font-bold text-[var(--ds-text-primary)]">
                      <SuiteMoney minor={cell.netProfitMinor} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${healthClass[cell.health]}`}
                      >
                        {t(`fin.analytic.health.${cell.health}` as MessageKey)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p dir="ltr" className="ds-num text-xs tabular-nums text-[var(--ds-text-muted)]">
            {formatInt(brands.length, fmtLocale)} × {formatInt(branches.length, fmtLocale)}
          </p>
        </div>
      ) : null}

      {mode !== 'matrix' && summaryRows.length > 0 ? (
        <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
          <table className="w-full min-w-[400px] border-collapse text-sm">
            <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
              <tr>
                <th className="px-3.5 py-2.5 text-start">
                  {mode === 'brand' ? t('suite.facet.brand') : t('hr.facet.location')}
                </th>
                <th className="px-3.5 py-2.5 text-end">{t('fin.analytic.net')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ds-border-hairline)]">
              {summaryRows.map(([label, amount]) => (
                <tr key={label} className="hover:bg-[var(--ds-bg-hover)]">
                  <td className="px-3.5 py-3 font-medium text-[var(--ds-text-primary)]">{label}</td>
                  <td className="px-3.5 py-3 text-end font-semibold text-[var(--ds-text-primary)]">
                    <SuiteMoney minor={amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </SectionCard>
  )
}
