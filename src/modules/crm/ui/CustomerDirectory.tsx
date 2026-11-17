'use client'

import { useMemo, useState } from 'react'
import { useDebounced } from '@/components/erp/common'
import { Num, StateBlock } from '@/components/ui'
import { UNAVAILABLE_DASH, getUnavailableTooltip } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { customerStatuses, type Customer, type CustomerStatus } from '@/modules/crm/client'
import {
  CrmMoney,
  CustomerStatusBadge,
  crmErrorClass,
  crmInputClass,
  crmPanelClass,
  crmSecondaryBtn,
  customerStatusLabels,
} from '@/modules/crm/ui/shared'
import { usePagedList } from '@/modules/crm/ui/usePagedList'

type SortKey = 'name' | 'createdAt'

type Props = {
  reloadToken: number
  onOpen: (customer: Customer) => void
}

/** Customer directory with live server-side search, a status filter, sorting and cursor paging. */
export function CustomerDirectory({ reloadToken, onOpen }: Props) {
  const { t, locale } = useI18n()
  const fmtLocale = locale === 'en' ? 'en' : 'ar'
  const unavailableTip = getUnavailableTooltip(fmtLocale)
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
    <div className={crmPanelClass}>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('crm.dir.search')}
          aria-label={t('crm.dir.search')}
          className={`${crmInputClass} mt-0 lg:col-span-6`}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as CustomerStatus | '')}
          aria-label={t('crm.col.status')}
          className={`${crmInputClass} mt-0 lg:col-span-2`}
        >
          <option value="">{t('crm.dir.allStatuses')}</option>
          {customerStatuses.map((value) => (
            <option key={value} value={value}>
              {t(customerStatusLabels[value])}
            </option>
          ))}
        </select>
        <div className="flex gap-2 lg:col-span-4">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label={t('erp.sortBy')}
            className={`${crmInputClass} mt-0`}
          >
            <option value="name">{t('crm.sort.name')}</option>
            <option value="createdAt">{t('crm.sort.createdAt')}</option>
          </select>
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value as 'asc' | 'desc')}
            aria-label={t('erp.sortBy')}
            className={`${crmInputClass} mt-0`}
          >
            <option value="asc">{t('erp.sort.asc')}</option>
            <option value="desc">{t('erp.sort.desc')}</option>
          </select>
        </div>
      </div>

      {list.phase === 'loading' ? (
        <StateBlock state="loading" locale={fmtLocale} title={t('erp.loading')} />
      ) : null}

      {list.phase === 'error' ? (
        <StateBlock
          state="error"
          locale={fmtLocale}
          title={t(list.error)}
          onRetry={list.reload}
          retryLabel={t('erp.retry')}
        />
      ) : null}

      {list.phase === 'ready' && list.rows.length === 0 ? (
        <StateBlock
          state="empty"
          locale={fmtLocale}
          title={t('crm.dir.empty')}
          description={t('crm.dir.emptyHint')}
        />
      ) : null}

      {list.phase === 'ready' && list.rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-slate-600 dark:text-slate-300">
              <tr className="border-b border-slate-200 dark:border-emerald-500/15">
                <th className="px-3 py-2.5 text-start font-semibold">{t('crm.col.name')}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t('crm.col.type')}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t('crm.col.contact')}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t('crm.col.credit')}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t('crm.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((customer) => (
                <tr
                  key={customer.id}
                  tabIndex={0}
                  onClick={() => onOpen(customer)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onOpen(customer)
                    }
                  }}
                  className="cursor-pointer border-b border-slate-100 text-slate-800 hover:bg-emerald-50/50 focus-visible:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.04]"
                >
                  <td className="px-3 py-2.5 font-semibold text-emerald-700 dark:text-emerald-300">
                    {customer.name}
                  </td>
                  <td className="px-3 py-2.5">
                    {t(customer.customerType === 'company' ? 'crm.ctype.company' : 'crm.ctype.individual')}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                    {customer.phone ? <Num>{customer.phone}</Num> : null}
                    {customer.phone && customer.email ? <br /> : null}
                    {customer.email ? <Num>{customer.email}</Num> : null}
                    {!customer.phone && !customer.email ? (
                      <span title={unavailableTip}>{UNAVAILABLE_DASH}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    {customer.creditLimitMinor === null ? (
                      <span className="text-slate-600 dark:text-slate-300">{t('crm.dir.noLimit')}</span>
                    ) : (
                      <CrmMoney minor={customer.creditLimitMinor} className="font-semibold" />
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
        <p role="alert" className={`${crmErrorClass} mt-3`}>
          {t(list.moreError)}
        </p>
      ) : null}
      {list.hasMore && list.phase === 'ready' ? (
        <div className="mt-4 text-center">
          <button type="button" onClick={list.loadMore} disabled={list.loadingMore} className={crmSecondaryBtn}>
            {list.loadingMore ? t('erp.loading') : t('erp.loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
