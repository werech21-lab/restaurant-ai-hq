'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { useDebounced, type ListPage } from '@/components/erp/common'
import { Num } from '@/components/ui'
import { formatInt } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Item } from '@/modules/inventory/client'
import { CrmMoney, crmInputClass, crmSubcardClass } from '@/modules/crm/ui/shared'

type Props = {
  value: Item | null
  onChange: (item: Item | null) => void
}

/** Live search over the active products. Each result shows the stock on hand across warehouses and the selling price. */
export function ItemPicker({ value, onChange }: Props) {
  const { t, locale } = useI18n()
  const fmtLocale = locale === 'en' ? 'en' : 'ar'
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim(), 250)
  const [results, setResults] = useState<Item[]>([])
  const [searching, setSearching] = useState(false)
  const [failure, setFailure] = useState<MessageKey | null>(null)

  useEffect(() => {
    if (value || debounced === '') {
      setResults([])
      return
    }
    const controller = new AbortController()
    setSearching(true)
    setFailure(null)
    const params = new URLSearchParams({ limit: '6', sort: 'name', direction: 'asc', status: 'active', q: debounced })
    apiRequest<ListPage<Item>>(`/api/v1/inventory/items?${params.toString()}`, { signal: controller.signal })
      .then((page) => setResults(page.data))
      .catch((error: unknown) => {
        if (!isAbort(error)) setFailure(errorKey(error))
      })
      .finally(() => setSearching(false))
    return () => controller.abort()
  }, [debounced, value])

  if (value) {
    return (
      <div className={`${crmSubcardClass} mt-1.5 flex items-center justify-between gap-3 text-sm text-slate-900 dark:text-white`}>
        <span className="min-w-0 truncate">
          <Num className="font-semibold text-emerald-700 dark:text-emerald-300">{value.sku}</Num> · {value.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-emerald-300 dark:hover:bg-white/[0.06]"
        >
          {t('crm.picker.change')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('crm.qb.searchItem')}
        aria-label={t('crm.qb.searchItem')}
        className={crmInputClass}
        autoComplete="off"
      />
      {debounced !== '' ? (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-emerald-500/20 dark:bg-[#0B1410]">
          {searching && results.length === 0 ? <p className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{t('erp.loading')}</p> : null}
          {failure ? <p role="alert" className="px-3 py-3 text-sm text-rose-700 dark:text-rose-300">{t(failure)}</p> : null}
          {!searching && !failure && results.length === 0 ? <p className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{t('crm.picker.none')}</p> : null}
          <ul>
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(item)
                    setQuery('')
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-start text-sm text-slate-800 hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 last:border-b-0 dark:border-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.06]"
                >
                  <span className="min-w-0 truncate">
                    <Num className="font-semibold text-emerald-700 dark:text-emerald-300">{item.sku}</Num> · {item.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <span>
                      {t('crm.qb.available')}: <Num>{formatInt(item.currentStock, fmtLocale)}</Num>
                    </span>
                    <CrmMoney minor={item.sellingPriceMinor} className="font-semibold" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
