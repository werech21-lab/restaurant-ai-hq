'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey } from '@/components/erp/api'
import { errorClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { SuiteBoard } from '@/modules/suite/client'

type Mode = 'brand' | 'branch'

export default function AnalyticPnlPanel() {
  const { t } = useI18n()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [board, setBoard] = useState<SuiteBoard | null>(null)
  const [mode, setMode] = useState<Mode>('brand')

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

  const rows = useMemo(() => {
    if (!board) return []
    const acc = new Map<string, number>()
    for (const row of board.records) {
      const key = mode === 'brand' ? row.brandName || '—' : row.branchName || '—'
      acc.set(key, (acc.get(key) ?? 0) + Number(row.amountMinor || 0))
    }
    return [...acc.entries()].sort((a, b) => b[1] - a[1])
  }, [board, mode])

  if (phase === 'loading') return <p className="text-sm text-gray-400">{t('suite.loading')}</p>
  if (phase === 'error') return <p className={errorClass}>{t(error)}</p>

  return (
    <section className={`${panelClass} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('spec.analytic')}</h2>
          <p className="text-sm text-gray-400">{t('fin.analytic.lead')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={mode === 'brand' ? primaryButton : secondaryButton} onClick={() => setMode('brand')}>{t('suite.facet.brand')}</button>
          <button type="button" className={mode === 'branch' ? primaryButton : secondaryButton} onClick={() => setMode('branch')}>{t('hr.facet.location')}</button>
        </div>
      </div>
      {rows.length === 0 ? <p className="text-sm text-gray-400">{t('suite.empty')}</p> : (
        <table className="w-full text-sm">
          <thead className="text-gray-400">
            <tr>
              <th className="px-2 py-2 text-start">{mode === 'brand' ? t('suite.facet.brand') : t('hr.facet.location')}</th>
              <th className="px-2 py-2 text-start">{t('fin.analytic.pnl')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, amount]) => (
              <tr key={label} className="border-t border-[#30363d]">
                <td className="px-2 py-3 text-white">{label}</td>
                <td className="px-2 py-3 text-gold-300">{formatMinor(amount)} {t('admin.kwd')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
