'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipPayload } from 'recharts'
import { ChartFrame, formatAmount, useCompactChart } from '@/components/charts'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { InvoiceForm } from '@/components/erp/InvoiceForm'
import { InvoicePanel } from '@/components/erp/InvoicePanel'
import { StatusBadge } from '@/components/erp/StatusBadge'
import { errorClass, inputClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import {
  invoiceSortKeys,
  invoiceStatuses,
  type Invoice,
  type InvoiceSortKey,
  type InvoiceStatus,
  type InvoiceSummary,
} from '@/modules/finance/client'

const PAGE_SIZE = 25

type Phase = 'loading' | 'ready' | 'error'
type Selection = { kind: 'new' } | { kind: 'invoice'; id: string } | null
type InvoicePage = { data: Invoice[]; nextCursor: string | null }

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#161b22] px-3 py-2.5 text-xs shadow-lift">
      {label ? (
        <p dir="ltr" className="mb-1.5 font-medium text-[#c9d1d9]">
          {label}
        </p>
      ) : null}
      {payload.map((item) => (
        <p key={String(item.name)} className="flex items-center justify-between gap-4 text-[#c9d1d9]">
          <span style={{ color: item.color || item.payload?.fill }}>{item.name}</span>
          <span dir="ltr" className="num font-semibold tabular-nums">
            {formatAmount(item.value)}
          </span>
        </p>
      ))}
    </div>
  )
}

export default function FinanceDashboard() {
  const { t } = useI18n()
  const compact = useCompactChart()

  const [summary, setSummary] = useState<InvoiceSummary | null>(null)
  const [summaryError, setSummaryError] = useState<MessageKey | null>(null)

  const [status, setStatus] = useState<InvoiceStatus | ''>('')
  const [search, setSearch] = useState('')
  const query = useDebounced(search.trim(), 300)
  const [sort, setSort] = useState<InvoiceSortKey>('createdAt')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')

  const [rows, setRows] = useState<Invoice[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [listError, setListError] = useState<MessageKey>('erp.err.generic')
  const [moreError, setMoreError] = useState<MessageKey | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const [reload, setReload] = useState(0)
  const keepRows = useRef(false)
  const [selection, setSelection] = useState<Selection>(null)

  const buildQuery = useCallback(
    (after: string | null) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), sort, direction })
      if (status) params.set('status', status)
      if (query) params.set('q', query)
      if (after) params.set('cursor', after)
      return `/api/v1/finance/invoices?${params.toString()}`
    },
    [status, query, sort, direction]
  )

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ data: InvoiceSummary }>('/api/v1/finance/invoices/summary', { signal: controller.signal })
      .then((result) => {
        setSummary(result.data)
        setSummaryError(null)
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setSummaryError(errorKey(error))
      })
    return () => controller.abort()
  }, [reload])

  useEffect(() => {
    const controller = new AbortController()
    const silent = keepRows.current
    keepRows.current = false
    if (!silent) {
      setRows([])
      setCursor(null)
    }
    setMoreError(null)
    setPhase((current) => (silent && current === 'ready' ? 'ready' : 'loading'))
    apiRequest<InvoicePage>(buildQuery(null), { signal: controller.signal })
      .then((page) => {
        setRows(page.data)
        setCursor(page.nextCursor)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setListError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [buildQuery, reload])

  useEffect(() => {
    if (!selection) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await apiRequest<InvoicePage>(buildQuery(cursor))
      setRows((current) => [...current, ...page.data])
      setCursor(page.nextCursor)
    } catch (error) {
      setMoreError(errorKey(error))
    } finally {
      setLoadingMore(false)
    }
  }

  function refresh() {
    keepRows.current = true
    setReload((value) => value + 1)
  }

  const threshold = summary?.approvalThresholdMinor ?? 0
  const axis = { fill: '#8b949e', fontSize: compact ? 11 : 12 }
  const chartRows = (summary?.months ?? []).map((month) => ({
    month: month.month,
    invoiced: month.invoicedMinor / 1000,
    collected: month.collectedMinor / 1000,
  }))

  return (
    <div>
      <Link href="/" className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300">
        {t('erp.back')}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mist-100">{t('erp.title')}</h1>
          <p className="mt-1 text-sm text-gray-400">{t('erp.subtitle')}</p>
        </div>
        <button type="button" onClick={() => setSelection({ kind: 'new' })} disabled={!summary} className={primaryButton}>
          {t('erp.new')}
        </button>
      </div>

      {summaryError ? (
        <p role="alert" className={`${errorClass} mb-4`}>
          {t(summaryError)}
        </p>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={panelClass}>
          <div className="text-sm text-gray-400">{t('erp.stat.outstanding')}</div>
          <div className="mt-2 text-2xl font-bold text-mist-100">{summary ? <Money value={formatMinor(summary.outstandingMinor)} /> : <Num>—</Num>}</div>
        </div>
        <div className={panelClass}>
          <div className="text-sm text-gray-400">{t('erp.stat.overdue')}</div>
          <div className="mt-2 text-2xl font-bold text-red-400">{summary ? <Money value={formatMinor(summary.overdueMinor)} /> : <Num>—</Num>}</div>
          {summary ? (
            <div className="mt-1 text-sm text-gray-400">
              <Num>{summary.overdueCount}</Num> {t('erp.unit.invoices')}
            </div>
          ) : null}
        </div>
        <div className={panelClass}>
          <div className="text-sm text-gray-400">{t('erp.stat.pending')}</div>
          <div className="mt-2 text-2xl font-bold text-yellow-300">
            <Num>{summary ? summary.countsByStatus.pending_approval : '—'}</Num>
          </div>
        </div>
        <div className={panelClass}>
          <div className="text-sm text-gray-400">{t('erp.stat.drafts')}</div>
          <div className="mt-2 text-2xl font-bold text-mist-100">
            <Num>{summary ? summary.countsByStatus.draft : '—'}</Num>
          </div>
        </div>
      </div>

      <div className={`${panelClass} mb-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-mist-100">{t('erp.chart.title')}</h3>
          <p className="text-xs text-gray-400">{t('erp.chart.unit')}</p>
        </div>
        <ChartFrame className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="month" stroke="#8b949e" tick={axis} tickLine={false} />
              <YAxis stroke="#8b949e" tick={axis} tickLine={false} width={compact ? 40 : 56} />
              <Tooltip content={(props) => <ChartTooltip active={props.active} payload={props.payload} label={typeof props.label === 'string' ? props.label : undefined} />} />
              <Legend wrapperStyle={{ color: '#c9d1d9', fontSize: 12 }} />
              <Bar dataKey="invoiced" name={t('erp.chart.invoiced')} fill="#58a6ff" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="collected" name={t('erp.chart.collected')} fill="#3fb950" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <div className={panelClass}>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('erp.filter.search')}
            aria-label={t('erp.filter.search')}
            className={`${inputClass} mt-0 lg:col-span-2`}
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as InvoiceStatus | '')}
            aria-label={t('erp.col.status')}
            className={`${inputClass} mt-0`}
          >
            <option value="">{t('erp.filter.allStatuses')}</option>
            {invoiceStatuses.map((item) => (
              <option key={item} value={item}>
                {t(`erp.status.${item}`)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select value={sort} onChange={(event) => setSort(event.target.value as InvoiceSortKey)} aria-label={t('erp.sortBy')} className={`${inputClass} mt-0`}>
              {invoiceSortKeys.map((item) => (
                <option key={item} value={item}>
                  {t(`erp.sort.${item}`)}
                </option>
              ))}
            </select>
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value as 'asc' | 'desc')}
              aria-label={t('erp.sortBy')}
              className={`${inputClass} mt-0`}
            >
              <option value="desc">{t('erp.sort.desc')}</option>
              <option value="asc">{t('erp.sort.asc')}</option>
            </select>
          </div>
        </div>

        {phase === 'loading' ? <p className="py-8 text-center text-sm text-gray-400">{t('erp.loading')}</p> : null}

        {phase === 'error' ? (
          <div className="space-y-3 py-6 text-center">
            <p role="alert" className={`${errorClass} inline-block`}>
              {t(listError)}
            </p>
            <div>
              <button type="button" onClick={refresh} className={secondaryButton}>
                {t('erp.retry')}
              </button>
            </div>
          </div>
        ) : null}

        {phase === 'ready' && rows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-gray-200">{t('erp.empty')}</p>
            <p className="mt-1 text-sm text-gray-400">{t('erp.emptyHint')}</p>
          </div>
        ) : null}

        {phase === 'ready' && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-gray-400">
                <tr className="border-b border-[#30363d]">
                  <th className="px-3 py-2 text-start font-medium">{t('erp.col.number')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('erp.col.customer')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('erp.col.status')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('erp.col.due')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('erp.col.total')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('erp.col.paid')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-[#30363d]/60 text-gray-200 hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelection({ kind: 'invoice', id: invoice.id })}
                        className="font-semibold text-blue-400 hover:text-blue-300"
                      >
                        <Num>{invoice.number}</Num>
                      </button>
                    </td>
                    <td className="px-3 py-2.5">{invoice.customerName}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Num>{invoice.dueDate}</Num>
                    </td>
                    <td className="px-3 py-2.5">
                      <Money value={formatMinor(invoice.totalMinor)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Money value={formatMinor(invoice.paidMinor)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {moreError ? (
          <p role="alert" className={`${errorClass} mt-3`}>
            {t(moreError)}
          </p>
        ) : null}
        {cursor && phase === 'ready' ? (
          <div className="mt-4 text-center">
            <button type="button" onClick={loadMore} disabled={loadingMore} className={secondaryButton}>
              {loadingMore ? t('erp.loading') : t('erp.loadMore')}
            </button>
          </div>
        ) : null}
      </div>

      {selection ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onClick={() => setSelection(null)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={selection.kind === 'new' ? t('erp.new') : t('erp.nav')}
            onClick={(event) => event.stopPropagation()}
            className="h-full w-full max-w-2xl overflow-y-auto border-s border-[#30363d] bg-[#161b22] p-5"
          >
            {selection.kind === 'new' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-100">{t('erp.new')}</h2>
                <InvoiceForm
                  approvalThresholdMinor={threshold}
                  onSaved={(created) => {
                    refresh()
                    setSelection({ kind: 'invoice', id: created.id })
                  }}
                  onCancel={() => setSelection(null)}
                />
              </>
            ) : (
              <InvoicePanel
                key={selection.id}
                invoiceId={selection.id}
                approvalThresholdMinor={threshold}
                onChanged={refresh}
                onClose={() => setSelection(null)}
              />
            )}
          </aside>
        </div>
      ) : null}
    </div>
  )
}
