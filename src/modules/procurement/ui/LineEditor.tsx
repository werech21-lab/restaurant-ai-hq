'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { useDebounced, type ListPage } from '@/components/erp/common'
import { inputClass, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { bpsToInput, minorToInput, parseKwdToMinor, parsePercentToBps } from '@/lib/money'
import type { Item } from '@/modules/inventory/client'
import { minorText } from '@/modules/procurement/ui/shared'

export type LineDraft = {
  key: string
  itemId: string
  sku: string
  description: string
  quantity: string
  /** Unit cost in KWD as typed. Unused on a request. */
  price: string
  /** Tax percent as typed. Unused on a request. */
  tax: string
}

let lineCounter = 0

export function emptyLine(): LineDraft {
  lineCounter += 1
  return { key: `pl-${lineCounter}`, itemId: '', sku: '', description: '', quantity: '1', price: '', tax: '0' }
}

export function draftFromLine(line: { itemId: string; description: string; quantity: number; unitCostMinor?: number; taxRateBps?: number }): LineDraft {
  return {
    ...emptyLine(),
    itemId: line.itemId,
    description: line.description,
    quantity: String(line.quantity),
    price: line.unitCostMinor === undefined ? '' : minorToInput(line.unitCostMinor),
    tax: line.taxRateBps === undefined ? '0' : bpsToInput(line.taxRateBps),
  }
}

function quantityOf(line: LineDraft): number {
  return /^\d{1,7}$/.test(line.quantity.trim()) ? Number(line.quantity.trim()) : Number.NaN
}

export function requestLinesPayload(lines: readonly LineDraft[]) {
  return lines.map((line) => ({ itemId: line.itemId, description: line.description, quantity: quantityOf(line) }))
}

export function orderLinesPayload(lines: readonly LineDraft[]) {
  return lines.map((line) => ({
    itemId: line.itemId,
    description: line.description,
    quantity: quantityOf(line),
    unitCostMinor: parseKwdToMinor(line.price) ?? Number.NaN,
    taxRateBps: parsePercentToBps(line.tax) ?? Number.NaN,
  }))
}

/** The one message a failed schema path maps to. */
export function lineIssue(path: ReadonlyArray<PropertyKey>): MessageKey {
  const [root, , field] = path
  if (root === 'lines' && path.length === 1) return 'pro.err.form.lines'
  if (root === 'lines' && field === 'itemId') return 'pro.err.form.item'
  if (root === 'lines' && field === 'description') return 'pro.err.form.description'
  if (root === 'lines' && field === 'quantity') return 'pro.err.form.quantity'
  if (root === 'lines' && field === 'unitCostMinor') return 'pro.err.form.price'
  if (root === 'lines' && field === 'taxRateBps') return 'pro.err.form.tax'
  return 'pro.err.form.generic'
}

type PickerProps = { onPick: (item: Item) => void }

/** Live search over the active stock items. A purchase can only name an active item. */
function ItemSearch({ onPick }: PickerProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim(), 250)
  const [results, setResults] = useState<Item[]>([])
  const [searching, setSearching] = useState(false)
  const [failure, setFailure] = useState<MessageKey | null>(null)

  useEffect(() => {
    if (debounced === '') {
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
  }, [debounced])

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('pro.line.searchItem')}
        aria-label={t('pro.line.searchItem')}
        className={inputClass}
        autoComplete="off"
      />
      {debounced !== '' ? (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-[#30363d] bg-[#0d1117]">
          {searching && results.length === 0 ? <p className="px-3 py-3 text-sm text-gray-400">{t('erp.loading')}</p> : null}
          {failure ? <p className="px-3 py-3 text-sm text-red-300">{t(failure)}</p> : null}
          {!searching && !failure && results.length === 0 ? <p className="px-3 py-3 text-sm text-gray-400">{t('pro.line.noItems')}</p> : null}
          <ul>
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(item)
                    setQuery('')
                  }}
                  className={`${secondaryButton} flex w-full items-center justify-between gap-3 rounded-none border-0 border-b border-[#30363d]/60 px-3 py-2 text-start last:border-b-0`}
                >
                  <span className="min-w-0 truncate">
                    <Num className="font-semibold text-blue-300">{item.sku}</Num> · {item.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-gray-400">
                    <span>
                      {t('pro.line.onHand')}: <Num>{item.currentStock.toLocaleString('en-US')}</Num>
                    </span>
                    <Money value={minorText(item.unitCostMinor)} />
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

type Props = {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  /** A purchase order line carries a unit cost and a tax rate. A request line does not. */
  priced: boolean
  disabled?: boolean
}

/** The editable lines of a purchase request or order. Every line is a stock item picked from the catalogue. */
export function LineEditor({ lines, onChange, priced, disabled = false }: Props) {
  const { t } = useI18n()

  function update(key: string, patch: Partial<LineDraft>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function pick(key: string, item: Item) {
    update(key, {
      itemId: item.id,
      sku: item.sku,
      description: item.name,
      // The item's current cost is only a starting point. The buyer enters the price the supplier quotes.
      ...(priced ? { price: minorToInput(item.unitCostMinor) } : {}),
    })
  }

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div key={line.key} className="rounded-xl border border-[#30363d] bg-[#0d1117]/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">
              {t('pro.line.no')} <Num>{index + 1}</Num>
            </span>
            {!disabled && lines.length > 1 ? (
              <button
                type="button"
                onClick={() => onChange(lines.filter((candidate) => candidate.key !== line.key))}
                className="text-xs text-red-400 hover:text-red-300"
              >
                {t('erp.form.removeLine')}
              </button>
            ) : null}
          </div>

          {line.itemId === '' ? (
            disabled ? null : <ItemSearch onPick={(item) => pick(line.key, item)} />
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-100">
              <span className="min-w-0 truncate">
                {line.sku !== '' ? <Num className="font-semibold text-blue-300">{line.sku}</Num> : null}
                {line.sku !== '' ? ' · ' : null}
                {line.description}
              </span>
              {!disabled ? (
                <button type="button" onClick={() => update(line.key, { itemId: '', sku: '' })} className="shrink-0 text-blue-400 hover:text-blue-300">
                  {t('pro.line.change')}
                </button>
              ) : null}
            </div>
          )}

          <div className={`mt-2 grid grid-cols-2 gap-3 ${priced ? 'sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
            <label className={`col-span-2 text-xs text-gray-400 ${priced ? 'sm:col-span-1' : ''}`}>
              {t('erp.form.description')}
              <input
                value={line.description}
                onChange={(event) => update(line.key, { description: event.target.value })}
                disabled={disabled}
                maxLength={300}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-gray-400">
              {t('erp.form.quantity')}
              <input
                value={line.quantity}
                onChange={(event) => update(line.key, { quantity: event.target.value })}
                disabled={disabled}
                inputMode="numeric"
                dir="ltr"
                className={inputClass}
              />
            </label>
            {priced ? (
              <>
                <label className="text-xs text-gray-400">
                  {t('pro.line.unitCost')}
                  <input
                    value={line.price}
                    onChange={(event) => update(line.key, { price: event.target.value })}
                    disabled={disabled}
                    inputMode="decimal"
                    dir="ltr"
                    className={inputClass}
                  />
                </label>
                <label className="text-xs text-gray-400">
                  {t('erp.form.tax')}
                  <input
                    value={line.tax}
                    onChange={(event) => update(line.key, { tax: event.target.value })}
                    disabled={disabled}
                    inputMode="decimal"
                    dir="ltr"
                    className={inputClass}
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>
      ))}
      {!disabled && lines.length < 200 ? (
        <button type="button" onClick={() => onChange([...lines, emptyLine()])} className={secondaryButton}>
          {t('erp.form.addLine')}
        </button>
      ) : null}
    </div>
  )
}
