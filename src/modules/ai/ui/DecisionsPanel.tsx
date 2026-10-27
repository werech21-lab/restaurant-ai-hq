'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest, errorKey, isAbort, newIdempotencyKey } from '@/components/erp/api'
import { dateTimeText, type ListPage, type Phase } from '@/components/erp/common'
import { dangerButton, errorClass, inputClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Approval, ApprovalStatus } from '@/modules/ai/client'
import { ActionBadge, ApprovalStatusBadge, Impact, recordHref, refLabels } from '@/modules/ai/ui/labels'

type StatusFilter = ApprovalStatus | 'all'

const filters: readonly StatusFilter[] = ['pending', 'executed', 'rejected', 'all']
const PAGE_SIZE = 20
// After these errors the request on screen is out of date, so the list is read again.
const refreshCodes: ReadonlySet<string> = new Set(['version_conflict', 'invalid_transition', 'not_found'])

function isWhatsappUrl(value: string): boolean {
  return value.startsWith('https://wa.me/')
}

function Result({ approval }: { approval: Approval }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const result = approval.resultJson
  if (!result) return null
  const message = result.message

  async function copy() {
    if (!message) return
    try {
      await navigator.clipboard.writeText(message.textAr)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
      <p className="text-emerald-200">{result.summaryAr}</p>
      {result.refs.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {result.refs.map((ref) => (
            <li key={`${ref.type}:${ref.id}`}>
              <Link href={recordHref(ref.type, ref.id)} className="rounded-lg border border-[#30363d] px-2.5 py-1 text-xs text-blue-300 hover:bg-white/5">
                {t(refLabels[ref.type])}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">{t('ai.dec.message')}</p>
          <pre dir="rtl" className="whitespace-pre-wrap rounded-lg border border-[#30363d] bg-[#0d1117] p-3 font-cairo text-sm leading-7 text-gray-100">
            {message.textAr}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void copy()} className={secondaryButton}>
              {copied ? t('ai.dec.copied') : t('ai.dec.copy')}
            </button>
            {message.whatsappUrl && isWhatsappUrl(message.whatsappUrl) ? (
              <a href={message.whatsappUrl} target="_blank" rel="noopener noreferrer" className={primaryButton}>
                {t('ai.dec.whatsapp')}
              </a>
            ) : (
              <span className="text-xs text-gray-500">{t('ai.dec.noPhone')}</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type CardProps = {
  approval: Approval
  busy: boolean
  error: MessageKey | null
  onApprove: (approval: Approval, note: string) => void
  onReject: (approval: Approval, note: string) => void
}

function ApprovalCard({ approval, busy, error, onApprove, onReject }: CardProps) {
  const { t } = useI18n()
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const pending = approval.status === 'pending'

  return (
    <li className="rounded-xl border border-[#30363d] bg-[#1c2128] p-4" data-approval-id={approval.id} data-status={approval.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ActionBadge type={approval.actionType} />
            <ApprovalStatusBadge status={approval.status} />
          </div>
          <h3 className="font-semibold text-gray-100">{approval.titleAr}</h3>
          <p className="mt-1 text-sm leading-7 text-gray-400">{approval.summaryAr}</p>
          <p className="mt-2 text-xs text-gray-500">
            {t('ai.dec.requested')}: {dateTimeText(approval.requestedByAiAt)}
            {approval.decidedAt ? ` · ${t('ai.dec.decided')}: ${dateTimeText(approval.decidedAt)}` : ''}
          </p>
          {approval.decisionNote ? <p className="mt-1 text-xs text-gray-400">{approval.decisionNote}</p> : null}
        </div>
        <div className="text-end">
          <div className="text-xs text-gray-400">{t('ai.dec.impact')}</div>
          <div className="mt-1 text-lg">
            <Impact minor={approval.estimatedImpactFils} />
          </div>
        </div>
      </div>

      {approval.status === 'executed' ? <Result approval={approval} /> : null}

      {error ? (
        <p role="alert" className={`${errorClass} mt-3`}>
          {t(error)}
        </p>
      ) : null}

      {pending ? (
        <div className="mt-4 space-y-3">
          {noteOpen ? (
            <label className="block text-sm text-gray-400">
              {t('ai.dec.note')}
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={2}
                className={inputClass}
                disabled={busy}
              />
            </label>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => onApprove(approval, note)} className={primaryButton}>
              {busy ? t('ai.dec.working') : t('ai.dec.approve')}
            </button>
            <button type="button" disabled={busy} onClick={() => onReject(approval, note)} className={dangerButton}>
              {t('ai.dec.reject')}
            </button>
            {!noteOpen ? (
              <button type="button" disabled={busy} onClick={() => setNoteOpen(true)} className="text-xs text-gray-400 hover:text-gray-200">
                {t('ai.dec.addNote')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  )
}

type Props = {
  /** Which decisions to start with. The executive command center shows only pending ones. */
  initialStatus?: StatusFilter
  showFilter?: boolean
  reloadToken: number
  /** Called after a decision went through, so the numbers around the list refresh. */
  onChanged: () => void
}

/** Live `ai_action_approvals`: approve-and-execute and reject buttons, the result of what was executed, and the history. */
export function DecisionsPanel({ initialStatus = 'pending', showFilter = false, reloadToken, onChanged }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState<StatusFilter>(initialStatus)
  const [rows, setRows] = useState<Approval[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [listError, setListError] = useState<MessageKey>('erp.err.generic')
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<MessageKey | null>(null)
  const [reload, setReload] = useState(0)
  // Decisions made on this screen stay visible, with their result, even after the list is read again without them.
  const [finished, setFinished] = useState<Record<string, Approval>>({})
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, MessageKey>>({})
  const [notice, setNotice] = useState<MessageKey | null>(null)
  // One key per request on screen, kept across a network failure so a retry cannot execute twice.
  const keys = useRef(new Map<string, string>())

  const buildQuery = useCallback(
    (after: string | null) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), status })
      if (status === 'pending') {
        params.set('sort', 'impact')
        params.set('direction', 'desc')
      }
      if (after) params.set('cursor', after)
      return `/api/v1/ai/approvals?${params.toString()}`
    },
    [status]
  )

  useEffect(() => {
    const controller = new AbortController()
    setPhase((current) => (current === 'ready' ? 'ready' : 'loading'))
    setMoreError(null)
    apiRequest<ListPage<Approval>>(buildQuery(null), { signal: controller.signal })
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
      const page = await apiRequest<ListPage<Approval>>(buildQuery(cursor))
      setRows((current) => [...current, ...page.data])
      setCursor(page.nextCursor)
    } catch (error) {
      setMoreError(errorKey(error))
    } finally {
      setLoadingMore(false)
    }
  }

  function setBusyFor(id: string, value: boolean) {
    setBusy((current) => {
      const next = new Set(current)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function decide(approval: Approval, decision: 'approve' | 'reject', note: string) {
    const id = approval.id
    setBusyFor(id, true)
    setErrors((current) => {
      const { [id]: _removed, ...rest } = current
      return rest
    })
    const trimmed = note.trim()
    const body = trimmed === '' ? { version: approval.version } : { version: approval.version, note: trimmed }
    try {
      let key = keys.current.get(id)
      if (!key) {
        key = newIdempotencyKey()
        keys.current.set(id, key)
      }
      const result = await apiRequest<{ data: Approval }>(`/api/v1/ai/approvals/${id}/${decision}`, {
        method: 'POST',
        body,
        idempotencyKey: decision === 'approve' ? key : undefined,
      })
      keys.current.delete(id)
      setFinished((current) => ({ ...current, [id]: result.data }))
      setNotice(decision === 'approve' ? 'ai.notice.executed' : 'ai.notice.rejected')
      onChanged()
    } catch (error) {
      // A network failure keeps the key. Any answer from the server means the attempt is over.
      if (!(error instanceof ApiError && error.status === 0)) keys.current.delete(id)
      setErrors((current) => ({ ...current, [id]: errorKey(error) }))
      if (error instanceof ApiError && refreshCodes.has(error.code)) setReload((value) => value + 1)
    } finally {
      setBusyFor(id, false)
    }
  }

  const rowIds = new Set(rows.map((row) => row.id))
  const extra = status === 'pending' ? Object.values(finished).filter((approval) => !rowIds.has(approval.id)) : []
  const shown = [...extra, ...rows.map((row) => finished[row.id] ?? row)]

  return (
    <section aria-label={t('ai.dec.title')} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">{t('ai.dec.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('ai.dec.subtitle')}</p>
        </div>
        <div className="flex items-end gap-2">
          {showFilter ? (
            <label className="text-sm text-gray-400">
              {t('ai.dec.filter')}
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                className={`${inputClass} mt-1 w-auto min-w-[8rem]`}
              >
                {filters.map((value) => (
                  <option key={value} value={value}>
                    {t(`ai.dec.status.${value}`)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setFinished({})
              setReload((value) => value + 1)
            }}
            className={secondaryButton}
          >
            {t('ai.refresh')}
          </button>
        </div>
      </div>

      {notice ? (
        <p role="status" className={noticeClass}>
          {t(notice)}
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

      {phase === 'ready' && shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#30363d] px-4 py-10 text-center text-sm text-gray-400">
          {t(status === 'pending' ? 'ai.dec.empty' : 'ai.dec.emptyFiltered')}
        </p>
      ) : null}

      {phase === 'ready' && shown.length > 0 ? (
        <ul className="space-y-3">
          {shown.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              busy={busy.has(approval.id)}
              error={errors[approval.id] ?? null}
              onApprove={(item, note) => void decide(item, 'approve', note)}
              onReject={(item, note) => void decide(item, 'reject', note)}
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
