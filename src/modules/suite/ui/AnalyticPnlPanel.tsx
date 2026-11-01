'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey } from '@/components/erp/api'
import { errorClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import { buildAnalyticMatrix, type AnalyticCell } from '@/modules/suite/domain/analytic-matrix'
import type { SuiteBoard } from '@/modules/suite/client'

type Mode = 'matrix' | 'brand' | 'branch'

const healthClass: Record<AnalyticCell['health'], string> = {
  good: 'bg-emerald-500/20 text-emerald-200',
  warn: 'bg-amber-500/20 text-amber-100',
  bad: 'bg-rose-500/20 text-rose-200',
}

export default function AnalyticPnlPanel() {
  const { t } = useI18n()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [board, setBoard] = useState<SuiteBoard | null>(null)
  const [mode, setMode] = useState<Mode>('matrix')

  useEffect(() => {
    const controller = new AbortController()
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
  }, [])

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

  if (phase === 'loading') return <p className="text-sm text-gray-400">{t('suite.loading')}</p>
  if (phase === 'error') return <p className={errorClass}>{t(error)}</p>

  return (
    <section className={`${panelClass} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('spec.analytic')}</h2>
          <p className="text-sm text-gray-400">{t('fin.analytic.matrix')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={mode === 'matrix' ? primaryButton : secondaryButton} onClick={() => setMode('matrix')}>{t('fin.analytic.matrix')}</button>
          <button type="button" className={mode === 'brand' ? primaryButton : secondaryButton} onClick={() => setMode('brand')}>{t('suite.facet.brand')}</button>
          <button type="button" className={mode === 'branch' ? primaryButton : secondaryButton} onClick={() => setMode('branch')}>{t('hr.facet.location')}</button>
        </div>
      </div>

      {matrix.length === 0 ? <p className="text-sm text-gray-400">{t('suite.empty')}</p> : null}

      {mode === 'matrix' && matrix.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-gray-400">
              <tr>
                <th className="px-2 py-2 text-start">{t('suite.facet.brand')}</th>
                <th className="px-2 py-2 text-start">{t('hr.facet.location')}</th>
                <th className="px-2 py-2 text-start">{t('fin.analytic.revenue')}</th>
                <th className="px-2 py-2 text-start">{t('fin.analytic.foodCost')}</th>
                <th className="px-2 py-2 text-start">{t('fin.analytic.payroll')}</th>
                <th className="px-2 py-2 text-start">{t('fin.analytic.commission')}</th>
                <th className="px-2 py-2 text-start">{t('fin.analytic.net')}</th>
                <th className="px-2 py-2 text-start" />
              </tr>
            </thead>
            <tbody>
              {matrix.map((cell) => (
                <tr key={`${cell.brandName}:${cell.branchName}`} className="border-t border-[#30363d]">
                  <td className="px-2 py-2 text-white">{cell.brandName}</td>
                  <td className="px-2 py-2 text-gray-300">{cell.branchName}</td>
                  <td className="px-2 py-2 text-gold-300">{formatMinor(cell.revenueMinor)} {t('admin.kwd')}</td>
                  <td className="px-2 py-2 text-gray-300">{formatMinor(cell.foodCostMinor)} {t('admin.kwd')}</td>
                  <td className="px-2 py-2 text-gray-300">{formatMinor(cell.payrollMinor)} {t('admin.kwd')}</td>
                  <td className="px-2 py-2 text-gray-300">{formatMinor(cell.commissionMinor)} {t('admin.kwd')}</td>
                  <td className="px-2 py-2 font-semibold text-white">{formatMinor(cell.netProfitMinor)} {t('admin.kwd')}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded-md px-2 py-0.5 ${healthClass[cell.health]}`}>{t(`fin.analytic.health.${cell.health}` as MessageKey)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-gray-500">{brands.length} × {branches.length}</p>
        </div>
      ) : null}

      {mode !== 'matrix' && summaryRows.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="text-gray-400">
            <tr>
              <th className="px-2 py-2 text-start">{mode === 'brand' ? t('suite.facet.brand') : t('hr.facet.location')}</th>
              <th className="px-2 py-2 text-start">{t('fin.analytic.net')}</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map(([label, amount]) => (
              <tr key={label} className="border-t border-[#30363d]">
                <td className="px-2 py-3 text-white">{label}</td>
                <td className="px-2 py-3 text-gold-300">{formatMinor(amount)} {t('admin.kwd')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}
