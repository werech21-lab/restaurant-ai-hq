'use client'

import { useMemo, useState } from 'react'
import { useDebounced } from '@/components/erp/common'
import { errorClass, inputClass, panelClass, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import { effectiveStatus, quotationStatuses, type Quotation, type QuotationStatus } from '@/modules/crm/client'
import { minorText, QuotationStatusBadge, quotationStatusLabels, todayUtc } from '@/modules/crm/ui/shared'
import { usePagedList } from '@/modules/crm/ui/usePagedList'

type SortKey = 'createdAt' | 'validUntil' | 'totalMinor'

type Props = {
  reloadToken: number
  onOpen: (quotation: Quotation) => void
}

export function QuotationList({ reloadToken, onOpen }: Props) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<QuotationStatus | ''>('')
  const [sort, setSort] = useState<SortKey>('createdAt')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const q = useDebounced(search.trim(), 300)

  const path = useMemo(() => {
    const params = new URLSearchParams({ limit: '25', sort, direction })
    if (q !== '') params.set('q', q)
    if (status !== '') params.set('status', status)
    return `/api/v1/crm/quotations?${params.toString()}`
  }, [q, status, sort, direction])

  const list = usePagedList<Quotation>(path, reloadToken)
  const today = todayUtc()

  return (
    <div className={panelClass}>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('crm.q.search')}
          aria-label={t('crm.q.search')}
          className={`${inputClass} mt-0 lg:col-span-5`}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as QuotationStatus | '')}
          aria-label={t('crm.col.status')}
          className={`${inputClass} mt-0 lg:col-span-3`}
        >
          <option value="">{t('crm.q.allStatuses')}</option>
          {quotationStatuses.map((value) => (
            <option key={value} value={value}>
              {t(quotationStatusLabels[value])}
            </option>
          ))}
        </select>
        <div className="flex gap-2 lg:col-span-4">
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label={t('erp.sortBy')} className={`${inputClass} mt-0`}>
            <option value="createdAt">{t('crm.sort.createdAt')}</option>
            <option value="validUntil">{t('crm.sort.validUntil')}</option>
            <option value="totalMinor">{t('crm.sort.totalMinor')}</option>
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
          <p className="text-gray-200">{t('crm.q.empty')}</p>
          <p className="mt-1 text-sm text-gray-400">{t('crm.q.emptyHint')}</p>
        </div>
      ) : null}

      {list.phase === 'ready' && list.rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-start font-medium">{t('crm.col.number')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('crm.col.customer')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('crm.col.validUntil')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('crm.col.total')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('crm.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((quotation) => {
                const pastDue = effectiveStatus(quotation, today) === 'expired' && quotation.status === 'sent'
                return (
                  <tr
                    key={quotation.id}
                    tabIndex={0}
                    onClick={() => onOpen(quotation)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onOpen(quotation)
                    }}
                    className="cursor-pointer border-b border-[#30363d]/60 text-gray-200 hover:bg-white/[0.04] focus:bg-white/[0.04] focus:outline-none"
                  >
                    <td className="px-3 py-2.5 font-semibold text-blue-300">
                      <Num>{quotation.quoteNumber}</Num>
                    </td>
                    <td className="px-3 py-2.5">{quotation.customerName}</td>
                    <td className={`px-3 py-2.5 ${pastDue ? 'text-amber-300' : ''}`} title={pastDue ? t('crm.q.pastDue') : undefined}>
                      <Num>{quotation.validUntil}</Num>
                    </td>
                    <td className="px-3 py-2.5">
                      <Money value={minorText(quotation.totalMinor)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <QuotationStatusBadge quotation={quotation} />
                    </td>
                  </tr>
                )
              })}
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
