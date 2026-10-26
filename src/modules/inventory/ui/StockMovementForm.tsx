'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest, errorDetail, errorKey, isAbort, newIdempotencyKey } from '@/components/erp/api'
import { errorClass, inputClass, labelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { parseWholeNumber } from '@/lib/money'
import {
  createMovementSchema,
  movementTypes,
  type Item,
  type MovementType,
  type StockBalance,
  type Warehouse,
} from '@/modules/inventory/client'
import { Quantity, type ListPage } from '@/modules/inventory/ui/shared'

type Props = {
  warehouses: Warehouse[]
  /** Pre-selects a product, for example from a catalog row. */
  initialItem?: Item
  onSaved: (message: MessageKey) => void
  onCancel: () => void
}

/** Stock entry (IN), issue or write-off (OUT) and transfer between warehouses (TRANSFER). */
export function StockMovementForm({ warehouses, initialItem, onSaved, onCancel }: Props) {
  const { t } = useI18n()
  const [type, setType] = useState<MovementType>('IN')
  const [items, setItems] = useState<Item[]>(initialItem ? [initialItem] : [])
  const [itemId, setItemId] = useState(initialItem?.id ?? '')
  const [warehouseId, setWarehouseId] = useState('')
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [onHand, setOnHand] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [detail, setDetail] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const idempotencyKey = useRef(newIdempotencyKey())

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<ListPage<Item>>('/api/v1/inventory/items?limit=100&status=active&sort=name&direction=asc', { signal: controller.signal })
      .then((page) => {
        setItems((current) => {
          const extra = current.filter((item) => !page.data.some((candidate) => candidate.id === item.id))
          return [...extra, ...page.data]
        })
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setErrors([errorKey(error)])
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!itemId) {
      setOnHand({})
      return
    }
    const controller = new AbortController()
    apiRequest<ListPage<StockBalance>>(`/api/v1/inventory/balances?itemId=${itemId}&limit=100`, { signal: controller.signal })
      .then((page) => setOnHand(Object.fromEntries(page.data.map((balance) => [balance.warehouseId, balance.onHand]))))
      .catch((error: unknown) => {
        if (!isAbort(error)) setOnHand({})
      })
    return () => controller.abort()
  }, [itemId])

  const activeWarehouses = useMemo(() => warehouses.filter((warehouse) => warehouse.status === 'active'), [warehouses])
  // A warehouse that is switched off cannot receive stock, but it can still be emptied.
  const sourceWarehouses = type === 'IN' ? activeWarehouses : warehouses
  const selectedItem = items.find((item) => item.id === itemId)
  const available = warehouseId ? onHand[warehouseId] ?? 0 : null
  const showAvailable = type !== 'IN' && itemId !== '' && warehouseId !== '' && available !== null

  function changeType(next: MovementType) {
    setType(next)
    setErrors([])
    setDetail(null)
    if (next === 'IN') {
      setWarehouseId((current) => (activeWarehouses.some((warehouse) => warehouse.id === current) ? current : ''))
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setDetail(null)
    const found: MessageKey[] = []
    const amount = parseWholeNumber(quantity)
    if (!itemId) found.push('inv.mv.errItem')
    if (!warehouseId || (type === 'TRANSFER' && !toWarehouseId)) found.push('inv.mv.errWarehouse')
    if (type === 'TRANSFER' && warehouseId && toWarehouseId && warehouseId === toWarehouseId) found.push('inv.mv.errSame')
    if (amount === null || amount < 1 || amount > 1_000_000) found.push('inv.mv.errQuantity')
    if (found.length === 0 && amount !== null && type !== 'IN' && (onHand[warehouseId] ?? 0) < amount) found.push('inv.mv.errExceeds')
    if (found.length > 0) {
      setErrors(found)
      return
    }

    const trimmed = note.trim()
    const candidate =
      type === 'TRANSFER'
        ? { type, itemId, fromWarehouseId: warehouseId, toWarehouseId, quantity: amount, note: trimmed === '' ? null : trimmed }
        : { type, itemId, warehouseId, quantity: amount, note: trimmed === '' ? null : trimmed }
    const parsed = createMovementSchema.safeParse(candidate)
    if (!parsed.success) {
      setErrors(['erp.form.errGeneric'])
      return
    }
    setErrors([])
    setPending(true)
    try {
      await apiRequest('/api/v1/inventory/movements', { method: 'POST', body: parsed.data, idempotencyKey: idempotencyKey.current })
      idempotencyKey.current = newIdempotencyKey()
      onSaved('inv.msg.moved')
    } catch (error) {
      setErrors([errorKey(error)])
      setDetail(errorDetail(error))
    } finally {
      setPending(false)
    }
  }

  if (warehouses.length === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">{t('inv.mv.noWarehouses')}</p>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t('erp.close')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <fieldset>
        <legend className={labelClass}>{t('inv.mv.type')}</legend>
        <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {movementTypes.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm transition ${
                type === value ? 'border-blue-500 bg-blue-500/10 text-blue-200' : 'border-[#30363d] text-gray-300 hover:bg-white/5'
              }`}
            >
              <input type="radio" name="movement-type" value={value} checked={type === value} onChange={() => changeType(value)} className="sr-only" />
              {t(`inv.mv.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={`${labelClass} block`}>
        {t('inv.mv.item')}
        <select value={itemId} onChange={(event) => setItemId(event.target.value)} className={inputClass}>
          <option value="">{t('inv.mv.selectItem')}</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.sku} · {item.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          {type === 'TRANSFER' ? t('inv.mv.from') : t('inv.mv.warehouse')}
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className={inputClass}>
            <option value="">{t('inv.mv.selectWarehouse')}</option>
            {sourceWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} · {warehouse.name}
              </option>
            ))}
          </select>
        </label>
        {type === 'TRANSFER' ? (
          <label className={labelClass}>
            {t('inv.mv.to')}
            <select value={toWarehouseId} onChange={(event) => setToWarehouseId(event.target.value)} className={inputClass}>
              <option value="">{t('inv.mv.selectWarehouse')}</option>
              {activeWarehouses
                .filter((warehouse) => warehouse.id !== warehouseId)
                .map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} · {warehouse.name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        <label className={labelClass}>
          {t('inv.mv.quantity')}
          <input inputMode="numeric" dir="ltr" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inputClass} />
        </label>
        {showAvailable && available !== null ? (
          <p className="self-end pb-2.5 text-sm text-gray-400">
            {t('inv.mv.onHand')}: <Quantity value={available} unit={selectedItem?.unit} />
          </p>
        ) : null}
      </div>

      <label className={`${labelClass} block`}>
        {t('inv.mv.note')}
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} className={inputClass} />
      </label>

      {errors.length > 0 ? (
        <ul role="alert" className={`${errorClass} space-y-1`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
          {detail ? (
            <li dir="ltr" className="text-start text-xs text-red-200">
              {detail}
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? t('erp.working') : t('inv.mv.submit')}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t('erp.cancel')}
        </button>
      </div>
    </form>
  )
}
