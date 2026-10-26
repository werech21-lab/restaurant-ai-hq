'use client'

import { FormEvent, useRef, useState } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { errorClass, inputClass, labelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { minorToInput, parseKwdToMinor, parseWholeNumber } from '@/lib/money'
import { createItemSchema, itemUnits, updateItemSchema, type Item, type ItemUnit } from '@/modules/inventory/client'

type Props = {
  item?: Item
  onSaved: (message: MessageKey) => void
  onCancel: () => void
}

function issueMessage(path: ReadonlyArray<PropertyKey>): MessageKey {
  switch (path[0]) {
    case 'sku':
      return 'inv.form.errSku'
    case 'name':
      return 'inv.form.errName'
    case 'unitCostMinor':
      return 'inv.form.errCost'
    case 'sellingPriceMinor':
      return 'inv.form.errPrice'
    case 'reorderLevel':
      return 'inv.form.errReorder'
    default:
      return 'erp.form.errGeneric'
  }
}

/** Create or edit a product. SKU and unit are fixed once the product exists. */
export function ItemForm({ item, onSaved, onCancel }: Props) {
  const { t } = useI18n()
  const [sku, setSku] = useState(item?.sku ?? '')
  const [name, setName] = useState(item?.name ?? '')
  const [unit, setUnit] = useState<ItemUnit>(item?.unit ?? 'piece')
  const [cost, setCost] = useState(item ? minorToInput(item.unitCostMinor) : '')
  const [price, setPrice] = useState(item ? minorToInput(item.sellingPriceMinor) : '')
  const [reorder, setReorder] = useState(item ? String(item.reorderLevel) : '0')
  const [active, setActive] = useState(item?.isActive ?? true)
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [pending, setPending] = useState(false)
  // One key per form session: a double click or a retry after a lost response replays instead of duplicating.
  const idempotencyKey = useRef(newIdempotencyKey())

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const shared = {
      name,
      unitCostMinor: parseKwdToMinor(cost) ?? Number.NaN,
      sellingPriceMinor: parseKwdToMinor(price) ?? Number.NaN,
      reorderLevel: parseWholeNumber(reorder) ?? Number.NaN,
      isActive: active,
    }
    const parsed = item
      ? updateItemSchema.safeParse({ ...shared, version: item.version })
      : createItemSchema.safeParse({ ...shared, sku, unit })
    if (!parsed.success) {
      setErrors(Array.from(new Set(parsed.error.issues.map((issue) => issueMessage(issue.path)))))
      return
    }
    setErrors([])
    setPending(true)
    try {
      if (item) {
        await apiRequest(`/api/v1/inventory/items/${item.id}`, { method: 'PATCH', body: parsed.data })
        onSaved('inv.msg.itemUpdated')
      } else {
        await apiRequest('/api/v1/inventory/items', { method: 'POST', body: parsed.data, idempotencyKey: idempotencyKey.current })
        idempotencyKey.current = newIdempotencyKey()
        onSaved('inv.msg.itemCreated')
      }
    } catch (error) {
      setErrors([errorKey(error)])
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          {t('inv.form.sku')}
          <input
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            disabled={item !== undefined}
            dir="ltr"
            maxLength={40}
            autoComplete="off"
            className={`${inputClass} disabled:opacity-60`}
          />
          <span className="mt-1 block text-xs text-gray-500">{t('inv.form.skuHint')}</span>
        </label>
        <label className={labelClass}>
          {t('inv.form.unit')}
          <select value={unit} onChange={(event) => setUnit(event.target.value as ItemUnit)} disabled={item !== undefined} className={`${inputClass} disabled:opacity-60`}>
            {itemUnits.map((value) => (
              <option key={value} value={value}>
                {t(`inv.unit.${value}`)}
              </option>
            ))}
          </select>
          {item ? <span className="mt-1 block text-xs text-gray-500">{t('inv.form.unitHint')}</span> : null}
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          {t('inv.form.name')}
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('inv.form.unitCost')}
          <input inputMode="decimal" dir="ltr" value={cost} onChange={(event) => setCost(event.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('inv.form.sellingPrice')}
          <input inputMode="decimal" dir="ltr" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('inv.form.reorder')}
          <input inputMode="numeric" dir="ltr" value={reorder} onChange={(event) => setReorder(event.target.value)} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-gray-200">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-blue-500" />
          {t('inv.form.active')}
        </label>
      </div>

      {errors.length > 0 ? (
        <ul role="alert" className={`${errorClass} space-y-1`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? t('erp.working') : item ? t('erp.save') : t('inv.form.create')}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t('erp.cancel')}
        </button>
      </div>
    </form>
  )
}
