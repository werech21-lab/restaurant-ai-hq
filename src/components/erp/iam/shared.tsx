'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Failure } from '@/components/erp/actions'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { ListPage, Phase } from '@/components/erp/common'
import { usePagedList } from '@/components/erp/usePagedList'
import { StateBlock } from '@/components/ui/state-block'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import type { MessageKey } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n'
import type { Invitation } from '@/lib/iam/types'

const MAX_CATALOG_PAGES = 20

export const iamPanelClass = 'ds-surface w-full min-w-0 rounded-2xl p-4 sm:p-5'
export const iamInputClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]'
export const iamLabelClass = 'block text-sm font-medium text-[var(--ds-text-secondary)]'
export const iamPrimaryBtn =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
export const iamSecondaryBtn =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] transition hover:bg-[var(--ds-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'
export const iamDangerBtn =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-4 py-2 text-sm font-semibold text-[var(--ds-negative)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
export const iamErrorClass =
  'rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-negative)]'
export const iamNoticeClass =
  'rounded-xl border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-positive)]'

type PillTone = 'neutral' | 'info' | 'good' | 'bad' | 'warn' | 'gold'

const PILL_TONES: Record<PillTone, string> = {
  neutral:
    'border-slate-300/80 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200',
  info:
    'border-sky-300/80 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-950/50 dark:text-sky-200',
  good:
    'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-200',
  bad:
    'border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/50 dark:text-rose-200',
  warn:
    'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/50 dark:text-amber-200',
  gold:
    'border-amber-400/70 bg-amber-100 text-amber-950 dark:border-amber-400/35 dark:bg-amber-950/60 dark:text-amber-200',
}

export function IamPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: PillTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function IamField({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`${iamLabelClass} ${className}`}>
      {label}
      {children}
    </label>
  )
}

export function IamFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3">
      <p className="text-xs font-medium text-[var(--ds-text-muted)]">{label}</p>
      <div className="mt-1 text-sm font-medium text-[var(--ds-text-primary)]">{children}</div>
    </div>
  )
}

export function IamUnavailableDash({ locale }: { locale: FormatLocale }) {
  const tooltip = getUnavailableTooltip(locale)
  return (
    <span
      dir="ltr"
      title={tooltip}
      aria-label={tooltip}
      data-unavailable="true"
      className="ds-num tabular-nums"
      style={{ color: 'var(--ds-unavailable)' }}
    >
      {UNAVAILABLE_DASH}
    </span>
  )
}

export function formatIamDateTime(iso: string | null | undefined, locale: FormatLocale): string {
  return formatDateTime(iso, { locale })
}

const modalWidths = { md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const

export function IamModal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  size?: keyof typeof modalWidths
}) {
  const { t, locale } = useI18n()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        onClick={(event) => event.stopPropagation()}
        className={`my-8 w-full ${modalWidths[size]} rounded-2xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] p-5 text-[var(--ds-text-primary)] shadow-2xl`}
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--ds-border-hairline)] pb-3">
          <h2 className="text-lg font-bold text-[var(--ds-text-primary)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('erp.close')}
            title={t('erp.close')}
            className="ds-focus-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-xl leading-none text-[var(--ds-text-muted)] hover:bg-[var(--ds-bg-hover)] hover:text-[var(--ds-text-primary)]"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export type IamColumn<T> = { header: MessageKey; cell: (row: T) => ReactNode }

export function IamPagedTable<T extends { id: string }>({
  path,
  reloadToken,
  columns,
  onOpen,
  emptyTitle,
  emptyHint,
  toolbar,
}: {
  path: string
  reloadToken: number
  columns: ReadonlyArray<IamColumn<T>>
  onOpen: (row: T) => void
  emptyTitle: MessageKey
  emptyHint?: MessageKey
  toolbar?: ReactNode
}) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const list = usePagedList<T>(path, reloadToken)

  return (
    <div className={iamPanelClass}>
      {toolbar ? <div className="mb-4 flex flex-wrap items-center gap-3">{toolbar}</div> : null}

      {list.phase === 'loading' ? (
        <StateBlock state="loading" locale={fmtLocale} skeletonRows={4} title={t('erp.loading')} />
      ) : null}

      {list.phase === 'error' ? (
        <StateBlock
          state={list.error === 'erp.err.forbidden' ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(list.error)}
          onRetry={list.error === 'erp.err.forbidden' ? undefined : list.reload}
        />
      ) : null}

      {list.phase === 'ready' && list.rows.length === 0 ? (
        <StateBlock
          state="empty"
          compact
          locale={fmtLocale}
          title={t(emptyTitle)}
          description={emptyHint ? t(emptyHint) : undefined}
        />
      ) : null}

      {list.phase === 'ready' && list.rows.length > 0 ? (
        <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
              <tr>
                {columns.map((column) => (
                  <th key={column.header} className="px-3.5 py-3 text-start">
                    {t(column.header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ds-border-hairline)] text-[var(--ds-text-primary)]">
              {list.rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => onOpen(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onOpen(row)
                  }}
                  className="ds-focus-ring cursor-pointer transition-colors hover:bg-[var(--ds-bg-hover)] focus-visible:bg-[var(--ds-bg-hover)]"
                >
                  {columns.map((column) => (
                    <td key={column.header} className="px-3.5 py-3">
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {list.moreError ? (
        <p role="alert" className={`${iamErrorClass} mt-3`}>
          {t(list.moreError)}
        </p>
      ) : null}
      {list.hasMore && list.phase === 'ready' ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={list.loadMore}
            disabled={list.loadingMore}
            className={iamSecondaryBtn}
          >
            {list.loadingMore ? t('erp.loading') : t('erp.loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export type Catalog<T> = {
  rows: T[]
  phase: Phase
  error: MessageKey
  truncated: boolean
  reload: () => void
}

export async function loadAllPages<T>(
  path: string,
  signal: AbortSignal,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  for (let page = 0; page < MAX_CATALOG_PAGES; page += 1) {
    const separator = path.includes('?') ? '&' : '?'
    const url: string =
      cursor === null ? path : `${path}${separator}cursor=${encodeURIComponent(cursor)}`
    const body: ListPage<T> = await apiRequest<ListPage<T>>(url, { signal })
    rows.push(...body.data)
    if (body.nextCursor === null || seen.has(body.nextCursor)) return { rows, truncated: false }
    seen.add(body.nextCursor)
    cursor = body.nextCursor
  }
  return { rows, truncated: true }
}

/** Every page of one list endpoint, for a picker. `enabled` skips the request when the user may not read it. */
export function useCatalog<T>(
  enabled: boolean,
  path: string,
  reloadToken: number,
): Catalog<T> {
  const [rows, setRows] = useState<T[]>([])
  const [phase, setPhase] = useState<Phase>(enabled ? 'loading' : 'ready')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [truncated, setTruncated] = useState(false)
  const [retry, setRetry] = useState(0)
  const reload = useCallback(() => setRetry((value) => value + 1), [])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setPhase((current) => (current === 'ready' ? 'ready' : 'loading'))
    loadAllPages<T>(path, controller.signal)
      .then((result) => {
        setRows(result.rows)
        setTruncated(result.truncated)
        setPhase('ready')
      })
      .catch((failure: unknown) => {
        if (isAbort(failure)) return
        setError(errorKey(failure))
        setPhase('error')
      })
    return () => controller.abort()
  }, [enabled, path, reloadToken, retry])

  return { rows, phase, error, truncated, reload }
}

const invitationTones = {
  pending: 'info',
  accepted: 'good',
  revoked: 'bad',
  expired: 'warn',
} as const satisfies Record<Invitation['status'], 'info' | 'good' | 'bad' | 'warn'>

export function InvitationStatusBadge({ status }: { status: Invitation['status'] }) {
  const { t } = useI18n()
  return <IamPill tone={invitationTones[status]}>{t(`iam.inv.${status}`)}</IamPill>
}

export function FormIssues({ issues }: { issues: readonly MessageKey[] }) {
  const { t } = useI18n()
  if (issues.length === 0) return null
  return (
    <ul role="alert" className={`${iamErrorClass} list-disc space-y-1 ps-6`}>
      {issues.map((issue) => (
        <li key={issue}>{t(issue)}</li>
      ))}
    </ul>
  )
}

/** A failed request. A version race uses the access wording and offers a reload. */
export function RequestFailure({
  failure,
  onReload,
}: {
  failure: Failure | null
  onReload?: () => void
}) {
  const { t } = useI18n()
  if (!failure) return null
  return (
    <div role="alert" className={iamErrorClass}>
      <p>{t(failure.conflict ? 'iam.err.version_conflict' : failure.key)}</p>
      {failure.detail ? (
        <p className="mt-1 text-xs opacity-80" dir="auto">
          {failure.detail}
        </p>
      ) : null}
      {failure.conflict && onReload ? (
        <button type="button" onClick={onReload} className={`${iamSecondaryBtn} mt-2`}>
          {t('iam.reload')}
        </button>
      ) : null}
    </div>
  )
}

export function CatalogNote({ catalog }: { catalog: Catalog<unknown> }) {
  const { t } = useI18n()
  return (
    <>
      {catalog.phase === 'error' ? (
        <span role="alert" className="mt-1 block text-xs text-[var(--ds-negative)]">
          {t(catalog.error)}{' '}
          <button
            type="button"
            onClick={catalog.reload}
            className="ds-focus-ring cursor-pointer underline"
          >
            {t('erp.retry')}
          </button>
        </span>
      ) : null}
      {catalog.truncated ? (
        <span className="mt-1 block text-xs text-[var(--ds-text-muted)]">
          {t('iam.list.truncated')}
        </span>
      ) : null}
    </>
  )
}

export function fieldIssue(
  path: ReadonlyArray<PropertyKey>,
  fields: Record<string, MessageKey>,
): MessageKey {
  const head = path[0]
  if (typeof head === 'string' && head in fields) return fields[head] ?? 'iam.err.form.generic'
  return 'iam.err.form.generic'
}
