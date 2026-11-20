'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayload,
} from 'recharts'
import { ChartFrame, formatAmount, useCompactChart } from '@/components/charts'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { DataScopeSwitcher, scopeToQuery, type DataScopeValue } from '@/components/erp/DataScopeSwitcher'
import { InvoiceForm } from '@/components/erp/InvoiceForm'
import { InvoicePanel } from '@/components/erp/InvoicePanel'
import { StatusBadge } from '@/components/erp/StatusBadge'
import { Num } from '@/components/ui'
import { StateBlock } from '@/components/ui/state-block'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
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

const SURFACE_CLS =
  'ds-surface relative overflow-visible min-w-0 rounded-2xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] p-4 sm:p-5 text-[var(--ds-text-primary)] shadow-xs'
const INPUT_CLS =
  'ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]'
const PRIMARY_BTN_CLS =
  'ds-focus-ring inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
const SECONDARY_BTN_CLS =
  'ds-focus-ring inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] transition hover:bg-[var(--ds-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'
const ERROR_ALERT_CLS =
  'rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-negative)]'

function resolveFinanceKpiGridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 md:grid-cols-2'
  if (count === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
}

function minorToKwd(minor: number | null | undefined, locale: FormatLocale): string {
  if (typeof minor !== 'number' || !Number.isFinite(minor)) return UNAVAILABLE_DASH
  return formatKwd(minor / 1000, locale)
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs text-slate-800 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100">
      {label ? (
        <p dir="ltr" className="mb-1.5 font-semibold text-slate-900 dark:text-white">
          {label}
        </p>
      ) : null}
      {payload.map((item) => (
        <p key={String(item.name)} className="flex items-center justify-between gap-4">
          <span className="min-w-0 truncate" style={{ color: item.color || item.payload?.fill }}>
            {item.name}
          </span>
          <span dir="ltr" className="ds-num shrink-0 whitespace-nowrap font-semibold tabular-nums">
            {formatAmount(item.value)}
          </span>
        </p>
      ))}
    </div>
  )
}

/** initialInvoiceId opens that invoice's panel on arrival, for links from the command center. */
export default function FinanceDashboard({
  initialInvoiceId = null,
}: {
  initialInvoiceId?: string | null
}) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const compact = useCompactChart()

  const [summary, setSummary] = useState<InvoiceSummary | null>(null)
  const [summaryError, setSummaryError] = useState<MessageKey | null>(null)

  const [status, setStatus] = useState<InvoiceStatus | ''>('')
  const [search, setSearch] = useState('')
  const query = useDebounced(search.trim(), 300)
  const [sort, setSort] = useState<InvoiceSortKey>('createdAt')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [scope, setScope] = useState<DataScopeValue>({ scope: 'hot', from: '', to: '' })

  const [rows, setRows] = useState<Invoice[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [listError, setListError] = useState<MessageKey>('erp.err.generic')
  const [moreError, setMoreError] = useState<MessageKey | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const [reload, setReload] = useState(0)
  const keepRows = useRef(false)
  const [selection, setSelection] = useState<Selection>(
    initialInvoiceId ? { kind: 'invoice', id: initialInvoiceId } : null,
  )

  const buildQuery = useCallback(
    (after: string | null) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        sort,
        direction,
        ...scopeToQuery(scope),
      })
      if (status) params.set('status', status)
      if (query) params.set('q', query)
      if (after) params.set('cursor', after)
      return `/api/v1/finance/invoices?${params.toString()}`
    },
    [status, query, sort, direction, scope],
  )

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ data: InvoiceSummary }>('/api/v1/finance/invoices/summary', {
      signal: controller.signal,
    })
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
  const axis = { fill: '#64748b', fontSize: 12 }
  const chartRows = useMemo(
    () =>
      (summary?.months ?? []).map((month) => ({
        month: month.month,
        invoiced: month.invoicedMinor / 1000,
        collected: month.collectedMinor / 1000,
      })),
    [summary?.months],
  )

  const kpiCards = useMemo(() => {
    const cards: Array<{ key: string; node: React.ReactNode }> = []

    cards.push({
      key: 'outstanding',
      node: (
        <article className={SURFACE_CLS}>
          <p className="min-w-0 truncate text-xs font-semibold text-[var(--ds-text-secondary)]">
            {t('erp.stat.outstanding')}
          </p>
          <div
            dir="ltr"
            data-unavailable={!summary ? 'true' : undefined}
            title={!summary ? unavailableTooltip : undefined}
            aria-label={!summary ? unavailableTooltip : undefined}
            className="ds-num mt-2 text-2xl font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {summary ? minorToKwd(summary.outstandingMinor, fmtLocale) : UNAVAILABLE_DASH}
          </div>
        </article>
      ),
    })

    if (!summary || summary.overdueMinor > 0 || summary.overdueCount > 0) {
      cards.push({
        key: 'overdue',
        node: (
          <article className={SURFACE_CLS}>
            <p className="min-w-0 truncate text-xs font-semibold text-[var(--ds-text-secondary)]">
              {t('erp.stat.overdue')}
            </p>
            <div
              dir="ltr"
              data-unavailable={!summary ? 'true' : undefined}
              title={!summary ? unavailableTooltip : undefined}
              aria-label={!summary ? unavailableTooltip : undefined}
              className="ds-num mt-2 text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-300"
            >
              {summary ? minorToKwd(summary.overdueMinor, fmtLocale) : UNAVAILABLE_DASH}
            </div>
            {summary && summary.overdueCount > 0 ? (
              <p className="mt-1 text-xs font-medium text-[var(--ds-text-muted)] tabular-nums">
                <Num>{formatInt(summary.overdueCount, fmtLocale)}</Num> {t('erp.unit.invoices')}
              </p>
            ) : null}
          </article>
        ),
      })
    }

    if (!summary || summary.countsByStatus.pending_approval > 0) {
      cards.push({
        key: 'pending',
        node: (
          <article className={SURFACE_CLS}>
            <p className="min-w-0 truncate text-xs font-semibold text-[var(--ds-text-secondary)]">
              {t('erp.stat.pending')}
            </p>
            <div
              dir="ltr"
              data-unavailable={!summary ? 'true' : undefined}
              title={!summary ? unavailableTooltip : undefined}
              aria-label={!summary ? unavailableTooltip : undefined}
              className="ds-num mt-2 text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-300"
            >
              {summary
                ? formatInt(summary.countsByStatus.pending_approval, fmtLocale)
                : UNAVAILABLE_DASH}
            </div>
          </article>
        ),
      })
    }

    if (!summary || summary.countsByStatus.draft > 0) {
      cards.push({
        key: 'drafts',
        node: (
          <article className={SURFACE_CLS}>
            <p className="min-w-0 truncate text-xs font-semibold text-[var(--ds-text-secondary)]">
              {t('erp.stat.drafts')}
            </p>
            <div
              dir="ltr"
              data-unavailable={!summary ? 'true' : undefined}
              title={!summary ? unavailableTooltip : undefined}
              aria-label={!summary ? unavailableTooltip : undefined}
              className="ds-num mt-2 text-2xl font-bold tabular-nums text-[var(--ds-text-primary)]"
            >
              {summary ? formatInt(summary.countsByStatus.draft, fmtLocale) : UNAVAILABLE_DASH}
            </div>
          </article>
        ),
      })
    }

    return cards
  }, [fmtLocale, summary, t, unavailableTooltip])

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <div>
        <Link
          href="/erp"
          className="ds-focus-ring inline-flex items-center text-sm font-semibold text-[var(--ds-accent)] hover:underline"
        >
          {t('erp.back')}
        </Link>
      </div>

      <div className={`${SURFACE_CLS} flex flex-wrap items-start justify-between gap-3`}>
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-bold text-[var(--ds-text-primary)] sm:text-2xl">
            {t('erp.title')}
          </h2>
          <p className="text-sm text-[var(--ds-text-muted)]">{t('erp.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setSelection({ kind: 'new' })}
          disabled={!summary}
          className={PRIMARY_BTN_CLS}
        >
          {t('erp.new')}
        </button>
      </div>

      {summaryError ? (
        <p role="alert" className={ERROR_ALERT_CLS}>
          {t(summaryError)}
        </p>
      ) : null}

      <div>
        <DataScopeSwitcher value={scope} onChange={setScope} />
      </div>

      {kpiCards.length > 0 ? (
        <div className={`grid gap-4 ${resolveFinanceKpiGridCols(kpiCards.length)}`}>
          {kpiCards.map((card) => (
            <React.Fragment key={card.key}>{card.node}</React.Fragment>
          ))}
        </div>
      ) : null}

      {chartRows.length > 0 ? (
        <div className={SURFACE_CLS}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-[var(--ds-text-primary)]">
              {t('erp.chart.title')}
            </h3>
            <p className="text-xs text-[var(--ds-text-muted)]">{t('erp.chart.unit')}</p>
          </div>
          <ChartFrame className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="month" stroke="#64748b" tick={axis} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  tick={axis}
                  tickLine={false}
                  width={compact ? 44 : 58}
                />
                <Tooltip
                  content={(props) => (
                    <ChartTooltip
                      active={props.active}
                      payload={props.payload}
                      label={typeof props.label === 'string' ? props.label : undefined}
                    />
                  )}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="invoiced"
                  name={t('erp.chart.invoiced')}
                  fill="#0284c7"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="collected"
                  name={t('erp.chart.collected')}
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </div>
      ) : null}

      <div className={SURFACE_CLS}>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('erp.filter.search')}
            aria-label={t('erp.filter.search')}
            className={`${INPUT_CLS} lg:col-span-2`}
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as InvoiceStatus | '')}
            aria-label={t('erp.col.status')}
            className={INPUT_CLS}
          >
            <option value="">{t('erp.filter.allStatuses')}</option>
            {invoiceStatuses.map((item) => (
              <option key={item} value={item}>
                {t(`erp.status.${item}`)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as InvoiceSortKey)}
              aria-label={t('erp.sortBy')}
              className={INPUT_CLS}
            >
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
              className={INPUT_CLS}
            >
              <option value="desc">{t('erp.sort.desc')}</option>
              <option value="asc">{t('erp.sort.asc')}</option>
            </select>
          </div>
        </div>

        {phase === 'loading' ? (
          <StateBlock state="loading" locale={fmtLocale} skeletonRows={4} title={t('erp.loading')} />
        ) : null}

        {phase === 'error' ? (
          <StateBlock
            state={listError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
            locale={fmtLocale}
            title={t(listError)}
            onRetry={listError === 'erp.err.forbidden' ? undefined : refresh}
          />
        ) : null}

        {phase === 'ready' && rows.length === 0 ? (
          <StateBlock
            state="empty"
            compact
            locale={fmtLocale}
            title={t('erp.empty')}
            description={t('erp.emptyHint')}
          />
        ) : null}

        {phase === 'ready' && rows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
                <tr>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-start">{t('erp.col.number')}</th>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-start">{t('erp.col.customer')}</th>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-start">{t('erp.col.status')}</th>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-start">{t('erp.col.due')}</th>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-end">{t('erp.col.total')}</th>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-end">{t('erp.col.paid')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)] tabular-nums">
                {rows.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="transition-colors hover:bg-[var(--ds-bg-hover)]"
                  >
                    <td className="whitespace-nowrap px-3.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelection({ kind: 'invoice', id: invoice.id })}
                        className="ds-focus-ring cursor-pointer font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                      >
                        <Num>{invoice.number}</Num>
                      </button>
                    </td>
                    <td className="max-w-[240px] truncate px-3.5 py-2.5 font-medium text-[var(--ds-text-primary)]">
                      {invoice.customerName}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5">
                      <span className="inline-flex shrink-0 whitespace-nowrap">
                        <StatusBadge status={invoice.status} />
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5">
                      <Num>{invoice.dueDate}</Num>
                    </td>
                    <td dir="ltr" className="whitespace-nowrap px-3.5 py-2.5 text-end font-semibold tabular-nums">
                      {minorToKwd(invoice.totalMinor, fmtLocale)}
                    </td>
                    <td dir="ltr" className="whitespace-nowrap px-3.5 py-2.5 text-end tabular-nums">
                      {minorToKwd(invoice.paidMinor, fmtLocale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {moreError ? (
          <p role="alert" className={`${ERROR_ALERT_CLS} mt-3`}>
            {t(moreError)}
          </p>
        ) : null}
        {cursor && phase === 'ready' ? (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className={SECONDARY_BTN_CLS}
            >
              {loadingMore ? t('erp.loading') : t('erp.loadMore')}
            </button>
          </div>
        ) : null}
      </div>

      {selection ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setSelection(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={selection.kind === 'new' ? t('erp.new') : t('erp.nav')}
            onClick={(event) => event.stopPropagation()}
            className="h-full w-full max-w-2xl overflow-y-auto border-s border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] p-5 text-[var(--ds-text-primary)] shadow-2xl"
          >
            {selection.kind === 'new' ? (
              <>
                <h2 className="mb-4 text-lg font-bold text-[var(--ds-text-primary)]">
                  {t('erp.new')}
                </h2>
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
