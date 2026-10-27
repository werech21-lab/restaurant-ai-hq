'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { ListPage } from '@/components/erp/common'
import type { MessageKey } from '@/lib/i18n'
import type { Account, AccountType } from '@/modules/finance/client'

const PAGE_SIZE = 100
/** The most a picker reads of the chart of accounts: ten pages of the list endpoint. */
const MAX_PAGES = 10

/** Which active accounts a picker needs: one type, every type, or none at all (the screen is not picking one). */
export type AccountScope = AccountType | 'all' | 'none'

export type AccountChoices = {
  accounts: Account[]
  loading: boolean
  failure: MessageKey | null
  /** True when the chart is larger than MAX_PAGES, so the picker holds only its first accounts by code. */
  truncated: boolean
}

const idle: AccountChoices = { accounts: [], loading: false, failure: null, truncated: false }

/**
 * The active accounts for a picker, in code order. The list endpoint has no text search and a page holds 100 rows, so the
 * cursor is followed until the chart ends or MAX_PAGES is reached, which the picker then says out loud.
 */
export function useAccounts(scope: AccountScope): AccountChoices {
  const [state, setState] = useState<AccountChoices>(scope === 'none' ? idle : { ...idle, loading: true })

  useEffect(() => {
    if (scope === 'none') {
      setState(idle)
      return
    }
    const controller = new AbortController()
    setState({ ...idle, loading: true })

    const read = async () => {
      const collected: Account[] = []
      let cursor: string | null = null
      let page = 0
      do {
        const query = new URLSearchParams({ limit: String(PAGE_SIZE), status: 'active' })
        if (scope !== 'all') query.set('type', scope)
        if (cursor) query.set('cursor', cursor)
        const result: ListPage<Account> = await apiRequest<ListPage<Account>>(`/api/v1/finance/accounts?${query.toString()}`, {
          signal: controller.signal,
        })
        collected.push(...result.data)
        cursor = result.nextCursor
        page += 1
      } while (cursor !== null && page < MAX_PAGES)
      if (!controller.signal.aborted) {
        setState({ accounts: collected, loading: false, failure: null, truncated: cursor !== null })
      }
    }

    read().catch((error: unknown) => {
      if (isAbort(error) || controller.signal.aborted) return
      setState({ ...idle, failure: errorKey(error) })
    })

    return () => controller.abort()
  }, [scope])

  return state
}

export type OneAccount = { account: Account | null; loading: boolean; failure: MessageKey | null }

/** One account by id, for a screen that holds only its id (the parent of an account). */
export function useAccount(id: string | null): OneAccount {
  const [state, setState] = useState<OneAccount>({ account: null, loading: id !== null, failure: null })

  useEffect(() => {
    if (id === null) {
      setState({ account: null, loading: false, failure: null })
      return
    }
    const controller = new AbortController()
    setState({ account: null, loading: true, failure: null })
    apiRequest<{ data: Account }>(`/api/v1/finance/accounts/${id}`, { signal: controller.signal })
      .then((payload) => setState({ account: payload.data, loading: false, failure: null }))
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setState({ account: null, loading: false, failure: errorKey(error) })
      })
    return () => controller.abort()
  }, [id])

  return state
}
