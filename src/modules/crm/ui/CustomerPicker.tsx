'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { useDebounced, type ListPage } from '@/components/erp/common'
import { inputClass, labelClass, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Customer, CustomerRef } from '@/modules/crm/client'
import { CustomerStatusBadge } from '@/modules/crm/ui/shared'

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
        <span className={labelClass}>{label}</span>
        <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-sm text-gray-100">
            <span className="truncate font-semibold">{value.name}</span>
            <CustomerStatusBadge status={value.status} />
          </span>
          {disabled ? null : (
            <button type="button" onClick={() => onChange(null)} className="text-sm text-blue-400 hover:text-blue-300">
              {t('crm.picker.change')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className={labelClass}>
        {label}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('crm.picker.search')}
          className={inputClass}
          autoComplete="off"
        />
      </label>
      <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-[#30363d] bg-[#0d1117]">
        {searching && results.length === 0 ? <p className="px-3 py-3 text-sm text-gray-400">{t('erp.loading')}</p> : null}
        {failure ? <p className="px-3 py-3 text-sm text-red-300">{t(failure)}</p> : null}
        {!searching && !failure && results.length === 0 ? <p className="px-3 py-3 text-sm text-gray-400">{t('crm.picker.none')}</p> : null}
        <ul>
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => onChange({ id: customer.id, name: customer.name, status: customer.status })}
                className={`${secondaryButton} flex w-full items-center justify-between gap-3 rounded-none border-0 border-b border-[#30363d]/60 px-3 py-2 text-start last:border-b-0`}
              >
                <span className="truncate">{customer.name}</span>
                <CustomerStatusBadge status={customer.status} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
