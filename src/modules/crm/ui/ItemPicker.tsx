'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { useDebounced, type ListPage } from '@/components/erp/common'
import { inputClass, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { Item } from '@/modules/inventory/client'

type Props = {
  value: Item | null
  onChange: (item: Item | null) => void
}

/** Live search over the active products. Each result shows the stock on hand across warehouses and the selling price. */
export function ItemPicker({ value, onChange }: Props) {
  const { t } = useI18n()
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
      <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-100">
        <span className="min-w-0 truncate">
          <Num className="font-semibold text-blue-300">{value.sku}</Num> · {value.name}
        </span>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 text-blue-400 hover:text-blue-300">
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
        className={inputClass}
        autoComplete="off"
      />
      {debounced !== '' ? (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-[#30363d] bg-[#0d1117]">
          {searching && results.length === 0 ? <p className="px-3 py-3 text-sm text-gray-400">{t('erp.loading')}</p> : null}
          {failure ? <p className="px-3 py-3 text-sm text-red-300">{t(failure)}</p> : null}
          {!searching && !failure && results.length === 0 ? <p className="px-3 py-3 text-sm text-gray-400">{t('crm.picker.none')}</p> : null}
          <ul>
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(item)
                    setQuery('')
                  }}
                  className={`${secondaryButton} flex w-full items-center justify-between gap-3 rounded-none border-0 border-b border-[#30363d]/60 px-3 py-2 text-start last:border-b-0`}
                >
                  <span className="min-w-0 truncate">
                    <Num className="font-semibold text-blue-300">{item.sku}</Num> · {item.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-gray-400">
                    <span>
                      {t('crm.qb.available')}: <Num>{item.currentStock.toLocaleString('en-US')}</Num>
                    </span>
                    <Money value={formatMinor(item.sellingPriceMinor)} />
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
