'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Failure } from '@/components/erp/actions'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { ListPage, Phase } from '@/components/erp/common'
import { errorClass, secondaryButton } from '@/components/erp/styles'
import { Badge } from '@/components/ui'
import type { MessageKey } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n'
import type { Invitation } from '@/lib/iam/types'

const MAX_CATALOG_PAGES = 20

export type Catalog<T> = {
  rows: T[]
  phase: Phase
  error: MessageKey
  truncated: boolean
  reload: () => void
}

export async function loadAllPages<T>(path: string, signal: AbortSignal): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  for (let page = 0; page < MAX_CATALOG_PAGES; page += 1) {
    const separator = path.includes('?') ? '&' : '?'
    const url: string = cursor === null ? path : `${path}${separator}cursor=${encodeURIComponent(cursor)}`
    const body: ListPage<T> = await apiRequest<ListPage<T>>(url, { signal })
    rows.push(...body.data)
    if (body.nextCursor === null || seen.has(body.nextCursor)) return { rows, truncated: false }
    seen.add(body.nextCursor)
    cursor = body.nextCursor
  }
  return { rows, truncated: true }
}

/** Every page of one list endpoint, for a picker. `enabled` skips the request when the user may not read it. */
export function useCatalog<T>(enabled: boolean, path: string, reloadToken: number): Catalog<T> {
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
  return <Badge tone={invitationTones[status]}>{t(`iam.inv.${status}`)}</Badge>
}

export function FormIssues({ issues }: { issues: readonly MessageKey[] }) {
  const { t } = useI18n()
  if (issues.length === 0) return null
  return (
    <ul role="alert" className={`${errorClass} list-disc space-y-1 ps-6`}>
      {issues.map((issue) => (
        <li key={issue}>{t(issue)}</li>
      ))}
    </ul>
  )
}

/** A failed request. A version race uses the access wording and offers a reload. */
export function RequestFailure({ failure, onReload }: { failure: Failure | null; onReload?: () => void }) {
  const { t } = useI18n()
  if (!failure) return null
  return (
    <div role="alert" className={errorClass}>
      <p>{t(failure.conflict ? 'iam.err.version_conflict' : failure.key)}</p>
      {failure.detail ? (
        <p className="mt-1 text-xs opacity-80" dir="auto">
          {failure.detail}
        </p>
      ) : null}
      {failure.conflict && onReload ? (
        <button type="button" onClick={onReload} className={`${secondaryButton} mt-2`}>
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
        <span role="alert" className="mt-1 block text-xs text-red-300">
          {t(catalog.error)}{' '}
          <button type="button" onClick={catalog.reload} className="underline">
            {t('erp.retry')}
          </button>
        </span>
      ) : null}
      {catalog.truncated ? <span className="mt-1 block text-xs text-gray-500">{t('iam.list.truncated')}</span> : null}
    </>
  )
}

export function fieldIssue(path: ReadonlyArray<PropertyKey>, fields: Record<string, MessageKey>): MessageKey {
  const head = path[0]
  if (typeof head === 'string' && head in fields) return fields[head] ?? 'iam.err.form.generic'
  return 'iam.err.form.generic'
}
