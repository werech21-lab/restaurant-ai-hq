'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { useDebounced, type ListPage } from '@/components/erp/common'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Customer, CustomerRef } from '@/modules/crm/client'
import {
  CustomerStatusBadge,
  crmInputClass,
  crmLabelClass,
  crmSubcardClass,
} from '@/modules/crm/ui/shared'

type Props = {
  value: CustomerRef | null
  onChange: (customer: CustomerRef | null) => void
  label: string
  disabled?: boolean
}

/** Live customer search. Blocked customers are not offered because nothing new can be created for them. */
export function CustomerPicker({ value, onChange, label, disabled = false }: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim(), 250)
  const [results, setResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  const [failure, setFailure] = useState<MessageKey | null>(null)

  useEffect(() => {
    if (value) return
    const controller = new AbortController()
    setSearching(true)
    setFailure(null)
    const params = new URLSearchParams({ limit: '8', sort: 'name', direction: 'asc' })
    if (debounced !== '') params.set('q', debounced)
    apiRequest<ListPage<Customer>>(`/api/v1/crm/customers?${params.toString()}`, { signal: controller.signal })
      .then((page) => setResults(page.data.filter((customer) => customer.status !== 'blocked')))
      .catch((error: unknown) => {
        if (!isAbort(error)) setFailure(errorKey(error))
      })
      .finally(() => setSearching(false))
    return () => controller.abort()
  }, [debounced, value])

  if (value) {
    return (
      <div>
        <span className={crmLabelClass}>{label}</span>
        <div className={`${crmSubcardClass} mt-1.5 flex items-center justify-between gap-3`}>
          <span className="flex min-w-0 items-center gap-2 text-sm text-slate-900 dark:text-white">
            <span className="truncate font-semibold">{value.name}</span>
            <CustomerStatusBadge status={value.status} />
          </span>
          {disabled ? null : (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="cursor-pointer rounded-md px-1.5 py-0.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-emerald-300 dark:hover:bg-white/[0.06]"
            >
              {t('crm.picker.change')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className={crmLabelClass}>
        {label}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('crm.picker.search')}
          aria-label={t('crm.picker.search')}
          className={crmInputClass}
          autoComplete="off"
        />
      </label>
      <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-emerald-500/20 dark:bg-[#0B1410]">
        {searching && results.length === 0 ? <p className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{t('erp.loading')}</p> : null}
        {failure ? <p role="alert" className="px-3 py-3 text-sm text-rose-700 dark:text-rose-300">{t(failure)}</p> : null}
        {!searching && !failure && results.length === 0 ? <p className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{t('crm.picker.none')}</p> : null}
        <ul>
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => onChange({ id: customer.id, name: customer.name, status: customer.status })}
                className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-start text-sm text-slate-800 hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 last:border-b-0 dark:border-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.06]"
              >
                <span className="truncate font-medium">{customer.name}</span>
                <CustomerStatusBadge status={customer.status} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
