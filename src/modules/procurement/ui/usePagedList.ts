'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { ListPage, Phase } from '@/components/erp/common'
import type { MessageKey } from '@/lib/i18n'

type PagedList<T> = {
  rows: T[]
  phase: Phase
  error: MessageKey
  hasMore: boolean
  loadingMore: boolean
  moreError: MessageKey | null
  reload: () => void
  loadMore: () => void
}

/**
 * A cursor-paginated list from an /api/v1 endpoint. `path` carries every filter and sort (without the cursor); when it
 * or `reloadToken` changes the list reloads from the first page. A filter change never keeps rows of the old query.
 */
export function usePagedList<T>(path: string, reloadToken: number): PagedList<T> {
  const [rows, setRows] = useState<T[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<MessageKey | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    setMoreError(null)
    apiRequest<ListPage<T>>(path, { signal: controller.signal })
      .then((page) => {
        setRows(page.data)
        setCursor(page.nextCursor)
        setPhase('ready')
      })
      .catch((failure: unknown) => {
        if (isAbort(failure)) return
        setError(errorKey(failure))
        setPhase('error')
      })
    return () => controller.abort()
  }, [path, reloadToken, retry])

  const loadMore = useCallback(() => {
    if (!cursor) return
    setLoadingMore(true)
    setMoreError(null)
    const separator = path.includes('?') ? '&' : '?'
    apiRequest<ListPage<T>>(`${path}${separator}cursor=${encodeURIComponent(cursor)}`)
      .then((page) => {
        setRows((current) => [...current, ...page.data])
        setCursor(page.nextCursor)
      })
      .catch((failure: unknown) => setMoreError(errorKey(failure)))
      .finally(() => setLoadingMore(false))
  }, [cursor, path])

  const reload = useCallback(() => setRetry((value) => value + 1), [])

  return { rows, phase, error, hasMore: cursor !== null, loadingMore, moreError, reload, loadMore }
}
