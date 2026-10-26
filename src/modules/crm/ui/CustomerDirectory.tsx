'use client'

import { useMemo, useState } from 'react'
import { useDebounced } from '@/components/erp/common'
import { errorClass, inputClass, panelClass, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import { customerStatuses, type Customer, type CustomerStatus } from '@/modules/crm/client'
import { CustomerStatusBadge, customerStatusLabels, minorText } from '@/modules/crm/ui/shared'
import { usePagedList } from '@/modules/crm/ui/usePagedList'

type SortKey = 'name' | 'createdAt'

type Props = {
  reloadToken: number
  onOpen: (customer: Customer) => void
}

/** Customer directory with live server-side search, a status filter, sorting and cursor paging. */
export function CustomerDirectory({ reloadToken, onOpen }: Props) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CustomerStatus | ''>('')
  const [sort, setSort] = useState<SortKey>('name')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const q = useDebounced(search.trim(), 300)

  const path = useMemo(() => {
    const params = new URLSearchParams({ limit: '25', sort, direction })
    if (q !== '') params.set('q', q)
    if (status !== '') params.set('status', status)
    return `/api/v1/crm/customers?${params.toString()}`
  }, [q, status, sort, direction])

  const list = usePagedList<Customer>(path, reloadToken)

  return (
    <div className={panelClass}>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('crm.dir.search')}
          aria-label={t('crm.dir.search')}
          className={`${inputClass} mt-0 lg:col-span-6`}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as CustomerStatus | '')}
          aria-label={t('crm.col.status')}
          className={`${inputClass} mt-0 lg:col-span-2`}
        >
          <option value="">{t('crm.dir.allStatuses')}</option>
          {customerStatuses.map((value) => (
            <option key={value} value={value}>
              {t(customerStatusLabels[value])}
            </option>
          ))}
        </select>
        <div className="flex gap-2 lg:col-span-4">
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label={t('erp.sortBy')} className={`${inputClass} mt-0`}>
            <option value="name">{t('crm.sort.name')}</option>
            <option value="createdAt">{t('crm.sort.createdAt')}</option>
          </select>
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value as 'asc' | 'desc')}
            aria-label={t('erp.sortBy')}
            className={`${inputClass} mt-0`}
          >
            <option value="asc">{t('erp.sort.asc')}</option>
            <option value="desc">{t('erp.sort.desc')}</option>
          </select>
        </div>
      </div>

      {list.phase === 'loading' ? <p className="py-8 text-center text-sm text-gray-400">{t('erp.loading')}</p> : null}

      {list.phase === 'error' ? (
        <div className="space-y-3 py-6 text-center">
          <p role="alert" className={`${errorClass} inline-block`}>
            {t(list.error)}
          </p>
          <div>
            <button type="button" onClick={list.reload} className={secondaryButton}>
              {t('erp.retry')}
            </button>
          </div>
        </div>
      ) : null}

      {list.phase === 'ready' && list.rows.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-gray-200">{t('crm.dir.empty')}</p>
          <p className="mt-1 text-sm text-gray-400">{t('crm.dir.emptyHint')}</p>
        </div>
      ) : null}

      {list.phase === 'ready' && list.rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-start font-medium">{t('crm.col.name')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('crm.col.type')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('crm.col.contact')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('crm.col.credit')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('crm.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((customer) => (
                <tr
                  key={customer.id}
                  tabIndex={0}
                  onClick={() => onOpen(customer)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onOpen(customer)
                  }}
                  className="cursor-pointer border-b border-[#30363d]/60 text-gray-200 hover:bg-white/[0.04] focus:bg-white/[0.04] focus:outline-none"
                >
                  <td className="px-3 py-2.5 font-semibold text-blue-300">{customer.name}</td>
                  <td className="px-3 py-2.5">{t(customer.customerType === 'company' ? 'crm.ctype.company' : 'crm.ctype.individual')}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-300">
                    {customer.phone ? <Num>{customer.phone}</Num> : null}
                    {customer.phone && customer.email ? <br /> : null}
                    {customer.email ? <Num>{customer.email}</Num> : null}
                    {!customer.phone && !customer.email ? '—' : null}
                  </td>
                  <td className="px-3 py-2.5">
                    {customer.creditLimitMinor === null ? (
                      <span className="text-gray-400">{t('crm.dir.noLimit')}</span>
                    ) : (
                      <Money value={minorText(customer.creditLimitMinor)} />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <CustomerStatusBadge status={customer.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {list.moreError ? (
        <p role="alert" className={`${errorClass} mt-3`}>
          {t(list.moreError)}
        </p>
      ) : null}
      {list.hasMore && list.phase === 'ready' ? (
        <div className="mt-4 text-center">
          <button type="button" onClick={list.loadMore} disabled={list.loadingMore} className={secondaryButton}>
            {list.loadingMore ? t('erp.loading') : t('erp.loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
