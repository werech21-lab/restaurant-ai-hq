'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest, errorKey, isAbort, newIdempotencyKey } from '@/components/erp/api'
import type { ListPage, Phase } from '@/components/erp/common'
import { StateBlock } from '@/components/ui/state-block'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Approval, ApprovalStatus, ScenarioOptionKey } from '@/modules/ai/client'
import {
  ActionBadge,
  AiMoney,
  ApprovalStatusBadge,
  Impact,
  aiCardClass,
  aiDangerBtn,
  aiErrorClass,
  aiInputClass,
  aiLabelClass,
  aiNoticeClass,
  aiPrimaryBtn,
  aiSecondaryBtn,
  formatAiDateTime,
  recordHref,
  refLabels,
} from '@/modules/ai/ui/labels'

type StatusFilter = ApprovalStatus | 'all'

const filters: readonly StatusFilter[] = ['pending', 'executed', 'rejected', 'all']
const PAGE_SIZE = 20
// After these errors the request on screen is out of date, so the list is read again.
const refreshCodes: ReadonlySet<string> = new Set([
  'version_conflict',
  'invalid_transition',
  'not_found',
  'proposal_stale',
])

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
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] p-3.5 text-sm">
      <p className="font-medium text-[var(--ds-positive)]">{result.summaryAr}</p>
      {result.refs.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {result.refs.map((ref) => (
            <li key={`${ref.type}:${ref.id}`}>
              <Link
                href={recordHref(ref.type, ref.id)}
                className={`${aiSecondaryBtn} min-h-8 px-2.5 py-1 text-xs`}
              >
                {t(refLabels[ref.type])}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--ds-text-muted)]">{t('ai.dec.message')}</p>
          <pre
            dir="rtl"
            className="whitespace-pre-wrap rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] p-3 font-cairo text-sm leading-7 text-[var(--ds-text-primary)]"
          >
            {message.textAr}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void copy()} className={aiSecondaryBtn}>
              {copied ? t('ai.dec.copied') : t('ai.dec.copy')}
            </button>
            {message.whatsappUrl && isWhatsappUrl(message.whatsappUrl) ? (
              <a
                href={message.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={aiPrimaryBtn}
              >
                {t('ai.dec.whatsapp')}
              </a>
            ) : (
              <span className="text-xs text-[var(--ds-text-muted)]">{t('ai.dec.noPhone')}</span>
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
  onApprove: (approval: Approval, note: string, optionKey: ScenarioOptionKey | null) => void
  onReject: (approval: Approval, note: string) => void
}

type ScenarioChoice = {
  key: ScenarioOptionKey
  titleAr: string
  summaryAr: string
  impactMinor: number
}

function scenarioChoices(payload: Record<string, unknown>): ScenarioChoice[] {
  const raw = payload.options
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (
      (row.key !== 'renegotiate' && row.key !== 'adjust_menu' && row.key !== 'reduce_waste') ||
      typeof row.titleAr !== 'string' ||
      typeof row.summaryAr !== 'string' ||
      typeof row.impactMinor !== 'number'
    ) {
      return []
    }
    return [
      {
        key: row.key,
        titleAr: row.titleAr,
        summaryAr: row.summaryAr,
        impactMinor: row.impactMinor,
      },
    ]
  })
}

function ApprovalCard({ approval, busy, error, onApprove, onReject }: CardProps) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const choices =
    approval.actionType === 'scenario_choice' ? scenarioChoices(approval.payloadJson) : []
  const [optionKey, setOptionKey] = useState<ScenarioOptionKey | null>(choices[0]?.key ?? null)
  const pending = approval.status === 'pending'

  return (
    <li className={aiCardClass} data-approval-id={approval.id} data-status={approval.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ActionBadge type={approval.actionType} />
            <ApprovalStatusBadge status={approval.status} />
          </div>
          <h3 className="font-semibold text-[var(--ds-text-primary)]">{approval.titleAr}</h3>
          <p className="mt-1 text-sm leading-7 text-[var(--ds-text-secondary)]">
            {approval.summaryAr}
          </p>
          <p className="mt-2 text-xs text-[var(--ds-text-muted)]">
            {t('ai.dec.requested')}:{' '}
            <span dir="ltr" className="ds-num tabular-nums">
              {formatAiDateTime(approval.requestedByAiAt, fmtLocale)}
            </span>
            {approval.decidedAt ? (
              <>
                {' · '}
                {t('ai.dec.decided')}:{' '}
                <span dir="ltr" className="ds-num tabular-nums">
                  {formatAiDateTime(approval.decidedAt, fmtLocale)}
                </span>
              </>
            ) : null}
          </p>
          {approval.decisionNote ? (
            <p className="mt-1 text-xs text-[var(--ds-text-secondary)]">{approval.decisionNote}</p>
          ) : null}
        </div>
        <div className="text-end">
          <div className="text-xs text-[var(--ds-text-muted)]">{t('ai.dec.impact')}</div>
          <div className="mt-1 text-lg">
            <Impact minor={approval.estimatedImpactFils} />
          </div>
        </div>
      </div>

      {approval.status === 'executed' ? <Result approval={approval} /> : null}

      {error ? (
        <p role="alert" className={`${aiErrorClass} mt-3`}>
          {t(error)}
        </p>
      ) : null}

      {pending ? (
        <div className="mt-4 space-y-3">
          {choices.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[var(--ds-text-secondary)]">
                {t('ai.scenario.choose')}
              </legend>
              {choices.map((choice) => (
                <label
                  key={choice.key}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3 text-sm text-[var(--ds-text-primary)]"
                >
                  <input
                    type="radio"
                    name={`scenario-${approval.id}`}
                    value={choice.key}
                    checked={optionKey === choice.key}
                    disabled={busy}
                    className="mt-1 accent-emerald-600"
                    onChange={() => setOptionKey(choice.key)}
                  />
                  <span className="min-w-0">
                    <span className="font-semibold">{choice.titleAr}</span>
                    <span className="mt-1 block text-[var(--ds-text-secondary)]">
                      {choice.summaryAr}
                    </span>
                    <span className="mt-1 block">
                      <AiMoney minor={choice.impactMinor} signed />
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {noteOpen ? (
            <label className={aiLabelClass}>
              {t('ai.dec.note')}
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={2}
                className={aiInputClass}
                disabled={busy}
              />
            </label>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || (choices.length > 0 && optionKey === null)}
              onClick={() => onApprove(approval, note, optionKey)}
              className={aiPrimaryBtn}
            >
              {busy ? t('ai.dec.working') : t('ai.dec.approve')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onReject(approval, note)}
              className={aiDangerBtn}
            >
              {t('ai.dec.reject')}
            </button>
            {!noteOpen ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setNoteOpen(true)}
                className="ds-focus-ring cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]"
              >
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
export function DecisionsPanel({
  initialStatus = 'pending',
  showFilter = false,
  reloadToken,
  onChanged,
}: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
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
    [status],
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

  async function decide(
    approval: Approval,
    decision: 'approve' | 'reject',
    note: string,
    optionKey: ScenarioOptionKey | null = null,
  ) {
    const id = approval.id
    setBusyFor(id, true)
    setErrors((current) => {
      const { [id]: _removed, ...rest } = current
      return rest
    })
    const trimmed = note.trim()
    const body = {
      version: approval.version,
      ...(trimmed === '' ? {} : { note: trimmed }),
      ...(decision === 'approve' && optionKey ? { optionKey } : {}),
    }
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
      if (error instanceof ApiError && refreshCodes.has(error.code)) {
        setReload((value) => value + 1)
      }
    } finally {
      setBusyFor(id, false)
    }
  }

  const rowIds = new Set(rows.map((row) => row.id))
  const extra =
    status === 'pending'
      ? Object.values(finished).filter((approval) => !rowIds.has(approval.id))
      : []
  const shown = [...extra, ...rows.map((row) => finished[row.id] ?? row)]

  return (
    <section aria-label={t('ai.dec.title')} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ds-text-primary)]">{t('ai.dec.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ds-text-muted)]">{t('ai.dec.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {showFilter ? (
            <label className={aiLabelClass}>
              {t('ai.dec.filter')}
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                className={`${aiInputClass} mt-1 w-auto min-w-[8rem]`}
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
            className={aiSecondaryBtn}
          >
            {t('ai.refresh')}
          </button>
        </div>
      </div>

      {notice ? (
        <p role="status" className={aiNoticeClass}>
          {t(notice)}
        </p>
      ) : null}

      {phase === 'loading' ? (
        <StateBlock state="loading" locale={fmtLocale} title={t('ai.loading')} skeletonRows={3} />
      ) : null}

      {phase === 'error' ? (
        <StateBlock
          state={listError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(listError)}
          onRetry={
            listError === 'erp.err.forbidden' ? undefined : () => setReload((value) => value + 1)
          }
          retryLabel={t('ai.retry')}
        />
      ) : null}

      {phase === 'ready' && shown.length === 0 ? (
        <StateBlock
          state="empty"
          locale={fmtLocale}
          title={t(status === 'pending' ? 'ai.dec.empty' : 'ai.dec.emptyFiltered')}
        />
      ) : null}

      {phase === 'ready' && shown.length > 0 ? (
        <ul className="space-y-3">
          {shown.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              busy={busy.has(approval.id)}
              error={errors[approval.id] ?? null}
              onApprove={(item, note, optionKey) => void decide(item, 'approve', note, optionKey)}
              onReject={(item, note) => void decide(item, 'reject', note)}
            />
          ))}
        </ul>
      ) : null}

      {moreError ? (
        <p role="alert" className={aiErrorClass}>
          {t(moreError)}
        </p>
      ) : null}
      {phase === 'ready' && cursor ? (
        <div className="text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className={aiSecondaryBtn}
          >
            {loadingMore ? t('ai.loading') : t('ai.loadMore')}
          </button>
        </div>
      ) : null}
    </section>
  )
}
