'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { errorClass, inputClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import {
  createReturnSchema,
  planReturn,
  returnableQuantity,
  valueOfLines,
  type PurchaseOrderDetail,
  type PurchaseReturnDetail,
} from '@/modules/procurement/client'
import { WarehouseSelect } from '@/modules/procurement/ui/Selects'
import { Fact, FailureMessage, Field, dateTimeText, minorText, todayUtc, useIdempotencyKey, useRunner, type Phase } from '@/modules/procurement/ui/shared'

type Props = {
  /** Return goods of this order. */
  orderId?: string
  /** Open one recorded return. */
  returnId?: string
  onChanged: (message: MessageKey) => void
  onClose: () => void
  onBack: (orderId: string) => void
}

/**
 * Sends received goods back to the supplier from one warehouse, at the order's own price. Stock falls by the same rows the
 * return records, and on the receipt basis the ledger moves from GRNI back out of inventory, all in one transaction.
 */
export function ReturnDialog({ orderId, returnId, onChanged, onClose, onBack }: Props) {
  const { t } = useI18n()
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null)
  const [recorded, setRecorded] = useState<PurchaseReturnDetail | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [reloadCount, setReloadCount] = useState(0)

  const [warehouseId, setWarehouseId] = useState('')
  const [returnDate, setReturnDate] = useState(todayUtc)
  const [reason, setReason] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [done, setDone] = useState<PurchaseReturnDetail | null>(null)
  const key = useIdempotencyKey()
  const { pending, failure, run } = useRunner()

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    const load = returnId
      ? apiRequest<{ data: PurchaseReturnDetail }>(`/api/v1/procurement/returns/${returnId}`, { signal: controller.signal }).then((payload) => {
          setRecorded(payload.data)
        })
      : apiRequest<{ data: PurchaseOrderDetail }>(`/api/v1/procurement/orders/${orderId}`, { signal: controller.signal }).then((payload) => {
          setOrder(payload.data)
        })
    load
      .then(() => setPhase('ready'))
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [orderId, returnId, reloadCount])

  function reload() {
    setReloadCount((value) => value + 1)
  }

  const chosen = useMemo(() => {
    if (!order) return []
    return order.lines
      .map((line) => ({ orderLineId: line.id, text: (quantities[line.id] ?? '').trim() }))
      .filter((line) => line.text !== '' && line.text !== '0')
      .map((line) => ({ orderLineId: line.orderLineId, quantity: /^\d{1,7}$/.test(line.text) ? Number(line.text) : Number.NaN }))
  }, [order, quantities])

  /** What the return is worth at the order's prices, shown before it is recorded. */
  const value = useMemo(() => {
    if (!order) return null
    try {
      const lines = chosen
        .filter((line) => Number.isInteger(line.quantity))
        .map((line) => ({ quantity: line.quantity, unitCostMinor: order.lines.find((entry) => entry.id === line.orderLineId)?.unitCostMinor ?? 0 }))
      return lines.length > 0 ? valueOfLines(lines) : null
    } catch {
      return null
    }
  }, [order, chosen])

  function submit() {
    if (!order) return
    setErrors([])
    const parsed = createReturnSchema.safeParse({ orderId: order.id, warehouseId, returnDate, reason, lines: chosen })
    if (!parsed.success) {
      const keys = parsed.error.issues.map((issue): MessageKey => {
        if (issue.path[0] === 'warehouseId') return 'pro.err.form.warehouse'
        if (issue.path[0] === 'returnDate') return 'pro.err.form.date'
        if (issue.path[0] === 'reason') return 'pro.err.form.reason'
        if (issue.path[0] === 'lines' && issue.path.length > 1) return 'pro.err.form.quantity'
        return 'pro.err.form.returnLines'
      })
      setErrors(Array.from(new Set(keys)))
      return
    }
    try {
      planReturn(order.lines, parsed.data.lines)
    } catch (error) {
      setErrors([errorKey(error)])
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: PurchaseReturnDetail }>('/api/v1/procurement/returns', {
        method: 'POST',
        body: parsed.data,
        idempotencyKey: key.ref.current,
      })
      key.reset()
      setDone(result.data)
      onChanged('pro.msg.returnPosted')
    }, key)
  }

  if (phase === 'loading') return <p className="py-8 text-center text-sm text-gray-400">{t('erp.loading')}</p>
  if (phase === 'error') {
    return (
      <div className="space-y-3 py-6 text-center">
        <p role="alert" className={`${errorClass} inline-block`}>
          {t(loadError)}
        </p>
        <div>
          <button type="button" onClick={reload} className={secondaryButton}>
            {t('erp.retry')}
          </button>
        </div>
      </div>
    )
  }

  const shown = recorded ?? done
  if (shown) {
    return (
      <div className="space-y-5">
        {done ? (
          <p role="status" className={noticeClass}>
            {t('pro.ret.done')}
          </p>
        ) : null}
        <h3 className="text-lg font-bold text-gray-100">
          <Num className="text-blue-300">RT-{shown.number}</Num>
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label={t('pro.col.supplier')}>{shown.supplierName}</Fact>
          <Fact label={t('pro.rcv.order')}>
            <button type="button" onClick={() => onBack(shown.orderId)} className="text-blue-300 underline">
              <Num>PO-{shown.orderNumber}</Num>
            </button>
          </Fact>
          <Fact label={t('pro.ret.date')}>
            <Num>{shown.returnDate}</Num>
          </Fact>
          <Fact label={t('pro.ret.value')}>
            <Money value={minorText(shown.valueMinor)} className="font-semibold" />
          </Fact>
          <Fact label={t('pro.reason')}>{shown.reason}</Fact>
          <Fact label={t('pro.col.created')}>{dateTimeText(shown.createdAt)}</Fact>
          <Fact label={t('pro.ret.ledger')}>{shown.journalEntryId ? t('pro.ret.ledgerYes') : t('pro.ret.ledgerNo')}</Fact>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-start font-medium">{t('pro.line.no')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('erp.form.quantity')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('pro.line.unitCost')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.lines.map((line) => (
                <tr key={line.id} className="border-b border-[#30363d]/60 text-gray-200">
                  <td className="px-3 py-2">
                    <Num>{line.lineNo}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Num>{line.quantity.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Money value={minorText(line.unitCostMinor)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-400">{t('pro.ret.creditHint')}</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#30363d] pt-4">
          <button type="button" onClick={() => onBack(shown.orderId)} className={primaryButton}>
            {t('pro.backToOrder')}
          </button>
          <button type="button" onClick={onClose} className={secondaryButton}>
            {t('erp.close')}
          </button>
        </div>
      </div>
    )
  }

  if (!order) return null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Fact label={t('pro.rcv.order')}>
          <Num className="text-blue-300">PO-{order.number}</Num> · {order.supplierName}
        </Fact>
        <WarehouseSelect value={warehouseId} onChange={setWarehouseId} label={t('erp.form.warehouse')} />
        <Field label={t('pro.ret.date')}>
          <input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} dir="ltr" className={inputClass} />
        </Field>
        <Field label={t('pro.reason')} className="sm:col-span-3">
          <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className={inputClass} />
        </Field>
      </div>

      <p className="text-xs text-gray-400">{t('pro.ret.note')}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-gray-400">
            <tr className="border-b border-[#30363d]">
              <th className="px-3 py-2 text-start font-medium">{t('erp.form.description')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.ord.received')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.ord.returned')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.line.unitCost')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.ret.now')}</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => {
              const open = returnableQuantity(line)
              return (
                <tr key={line.id} className="border-b border-[#30363d]/60 text-gray-200">
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2">
                    <Num>{line.receivedQuantity.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Num>{line.returnedQuantity.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Money value={minorText(line.unitCostMinor)} />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={quantities[line.id] ?? ''}
                      onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))}
                      disabled={open === 0}
                      inputMode="numeric"
                      dir="ltr"
                      aria-label={`${t('pro.ret.now')} — ${line.description}`}
                      className={`${inputClass} mt-0 w-28`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {value !== null ? (
        <div className="rounded-xl border border-[#30363d] p-4">
          <Fact label={t('pro.ret.value')}>
            <Money value={minorText(value)} className="font-semibold" />
          </Fact>
        </div>
      ) : null}

      {errors.length > 0 ? (
        <ul role="alert" className={`${errorClass} list-disc space-y-1 ps-6`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
        </ul>
      ) : null}
      <FailureMessage failure={failure} onReload={reload} />

      <div className="flex flex-wrap justify-end gap-2 border-t border-[#30363d] pt-4">
        <button type="button" onClick={submit} disabled={pending} className={primaryButton}>
          {pending ? t('erp.loading') : t('pro.ret.confirm')}
        </button>
        <button type="button" onClick={() => onBack(order.id)} className={secondaryButton}>
          {t('pro.backToOrder')}
        </button>
      </div>
    </div>
  )
}
