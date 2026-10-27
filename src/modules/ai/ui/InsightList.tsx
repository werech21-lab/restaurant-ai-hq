'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { useDebounced, type ListPage, type Phase } from '@/components/erp/common'
import { errorClass, inputClass, noticeClass, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { insightCategories, insightSeverities, type Insight, type InsightCategory, type InsightSeverity } from '@/modules/ai/client'
import { InsightRow } from '@/modules/ai/ui/InsightRow'
import { categoryLabels, severityLabels } from '@/modules/ai/ui/labels'

const PAGE_SIZE = 20
const statusFilters = ['live', 'open', 'acknowledged', 'resolved', 'all'] as const
type StatusFilter = (typeof statusFilters)[number]

type Props = {
  reloadToken: number
  onChanged: () => void
}

/** Alerts and insights with server-side filters, search and paging, and the acknowledge and resolve actions. */
export function InsightList({ reloadToken, onChanged }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState<StatusFilter>('live')
  const [severity, setSeverity] = useState<InsightSeverity | ''>('')
  const [category, setCategory] = useState<InsightCategory | ''>('')
  const [search, setSearch] = useState('')
  const query = useDebounced(search.trim(), 300)

  const [rows, setRows] = useState<Insight[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [listError, setListError] = useState<MessageKey>('erp.err.generic')
  const [moreError, setMoreError] = useState<MessageKey | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reload, setReload] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)

  const buildQuery = useCallback(
    (after: string | null) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), status })
      if (severity) params.set('severity', severity)
      if (category) params.set('category', category)
      if (query) params.set('q', query)
      if (after) params.set('cursor', after)
      return `/api/v1/ai/insights?${params.toString()}`
    },
    [status, severity, category, query]
  )

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    setMoreError(null)
    apiRequest<ListPage<Insight>>(buildQuery(null), { signal: controller.signal })
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
  }, [buildQuery, reload, reloadToken])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await apiRequest<ListPage<Insight>>(buildQuery(cursor))
      setRows((current) => [...current, ...page.data])
      setCursor(page.nextCursor)
    } catch (error) {
      setMoreError(errorKey(error))
    } finally {
      setLoadingMore(false)
    }
  }

  async function move(insight: Insight, action: 'acknowledge' | 'resolve') {
    setBusyId(insight.id)
    setActionError(null)
    try {
      await apiRequest<{ data: Insight }>(`/api/v1/ai/insights/${insight.id}/${action}`, {
        method: 'POST',
        body: { version: insight.version },
      })
      setNotice(action === 'acknowledge' ? 'ai.notice.acknowledged' : 'ai.notice.resolved')
      setReload((value) => value + 1)
      onChanged()
    } catch (error) {
      setActionError(errorKey(error))
      if (error instanceof ApiError && (error.code === 'version_conflict' || error.code === 'invalid_transition')) {
        setReload((value) => value + 1)
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-label={t('ai.ins.title')} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm text-gray-400 lg:col-span-1">
          {t('ai.ins.search')}
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={100}
            className={inputClass}
          />
        </label>
        <label className="text-sm text-gray-400">
          {t('ai.ins.status')}
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className={inputClass}>
            {statusFilters.map((value) => (
              <option key={value} value={value}>
                {t(`ai.ist.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-400">
          {t('ai.ins.allSeverities')}
          <select value={severity} onChange={(event) => setSeverity(event.target.value as InsightSeverity | '')} className={inputClass}>
            <option value="">{t('ai.ins.allSeverities')}</option>
            {insightSeverities.map((value) => (
              <option key={value} value={value}>
                {t(severityLabels[value])}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-400">
          {t('ai.ins.allCategories')}
          <select value={category} onChange={(event) => setCategory(event.target.value as InsightCategory | '')} className={inputClass}>
            <option value="">{t('ai.ins.allCategories')}</option>
            {insightCategories.map((value) => (
              <option key={value} value={value}>
                {t(categoryLabels[value])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice ? (
        <p role="status" className={noticeClass}>
          {t(notice)}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className={errorClass}>
          {t(actionError)}
        </p>
      ) : null}

      {phase === 'loading' ? <p className="py-8 text-center text-sm text-gray-400">{t('ai.loading')}</p> : null}

      {phase === 'error' ? (
        <div className="space-y-3 rounded-xl border border-[#30363d] bg-[#1c2128] py-8 text-center">
          <p role="alert" className={`${errorClass} inline-block`}>
            {t(listError)}
          </p>
          <div>
            <button type="button" onClick={() => setReload((value) => value + 1)} className={secondaryButton}>
              {t('ai.retry')}
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'ready' && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#30363d] px-4 py-10 text-center text-sm text-gray-400">{t('ai.ins.empty')}</p>
      ) : null}

      {phase === 'ready' && rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((insight) => (
            <InsightRow
              key={insight.id}
              insight={insight}
              actions={{
                busy: busyId === insight.id,
                onAcknowledge: () => void move(insight, 'acknowledge'),
                onResolve: () => void move(insight, 'resolve'),
              }}
            />
          ))}
        </ul>
      ) : null}

      {moreError ? (
        <p role="alert" className={errorClass}>
          {t(moreError)}
        </p>
      ) : null}
      {phase === 'ready' && cursor ? (
        <div className="text-center">
          <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className={secondaryButton}>
            {loadingMore ? t('ai.loading') : t('ai.loadMore')}
          </button>
        </div>
      ) : null}
    </section>
  )
}
