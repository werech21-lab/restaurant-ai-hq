'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { Num } from '@/components/ui'
import { StateBlock } from '@/components/ui/state-block'
import { formatInt, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import {
  createReceiptSchema,
  planReceipt,
  type GoodsReceiptDetail,
  type PurchaseOrderDetail,
} from '@/modules/procurement/client'
import { WarehouseSelect } from '@/modules/procurement/ui/Selects'
import {
  Fact,
  FailureMessage,
  Field,
  proErrorClass,
  proInputClass,
  proNoticeClass,
  proPrimaryButton,
  proSecondaryButton,
  todayUtc,
  useIdempotencyKey,
  useRunner,
  type Phase,
} from '@/modules/procurement/ui/shared'

type Props = {
  orderId: string
  onChanged: (message: MessageKey) => void
  onClose: () => void
  onBack: (orderId: string) => void
}

/** Receives goods against an approved or partly received order. */
export function ReceiveDialog({ orderId, onChanged, onClose, onBack }: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [reloadCount, setReloadCount] = useState(0)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [warehouseId, setWarehouseId] = useState('')
  const [receiptDate, setReceiptDate] = useState(todayUtc)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [done, setDone] = useState<GoodsReceiptDetail | null>(null)
  const key = useIdempotencyKey()
  const { pending, failure, run } = useRunner()

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ data: PurchaseOrderDetail }>(
      `/api/v1/procurement/orders/${orderId}`,
      { signal: controller.signal },
    )
      .then((payload) => {
        setOrder(payload.data)
        setQuantities(
          Object.fromEntries(
            payload.data.lines.map((line) => [
              line.id,
              String(line.quantity - line.receivedQuantity),
            ]),
          ),
        )
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [orderId, reloadCount])

  function reload() {
    setPhase('loading')
    setReloadCount((value) => value + 1)
  }

  function submit() {
    if (!order) return
    setErrors([])
    const lines = order.lines
      .map((line) => ({
        orderLineId: line.id,
        text: (quantities[line.id] ?? '').trim(),
      }))
      .filter((line) => line.text !== '' && line.text !== '0')
      .map((line) => ({
        orderLineId: line.orderLineId,
        quantity: /^\d{1,7}$/.test(line.text) ? Number(line.text) : Number.NaN,
      }))
    const parsed = createReceiptSchema.safeParse({
      version: order.version,
      warehouseId,
      receiptDate,
      notes: notes.trim() === '' ? null : notes,
      lines,
    })
    if (!parsed.success) {
      const keys = parsed.error.issues.map((issue): MessageKey => {
        if (issue.path[0] === 'warehouseId') return 'pro.err.form.warehouse'
        if (issue.path[0] === 'receiptDate') return 'pro.err.form.date'
        if (issue.path[0] === 'lines' && issue.path.length > 1) {
          return 'pro.err.form.quantity'
        }
        return 'pro.err.form.receiptLines'
      })
      setErrors(Array.from(new Set(keys)))
      return
    }
    try {
      planReceipt(order.lines, parsed.data.lines)
    } catch {
      setErrors(['pro.err.over_receipt'])
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: GoodsReceiptDetail }>(
        `/api/v1/procurement/orders/${order.id}/receipts`,
        {
          method: 'POST',
          body: parsed.data,
          idempotencyKey: key.ref.current,
        },
      )
      key.reset()
      setDone(result.data)
      onChanged('pro.msg.received')
    }, key)
  }

  if (phase === 'loading') {
    return (
      <StateBlock
        state="loading"
        locale={fmtLocale}
        skeletonRows={4}
        title={t('erp.loading')}
      />
    )
  }
  if (phase === 'error' || !order) {
    return (
      <StateBlock
        state={loadError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
        locale={fmtLocale}
        title={t(loadError)}
        onRetry={loadError === 'erp.err.forbidden' ? undefined : reload}
      />
    )
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div role="status" className={`${proNoticeClass} space-y-1`}>
          <p className="font-semibold">{t('pro.rcv.done')}</p>
          <p>
            <Num>GR-{done.number}</Num> ·{' '}
            <Num>{formatInt(done.totalQuantity, fmtLocale)}</Num> {t('pro.ord.units')}
          </p>
          {done.journalEntryId ? (
            <p>
              {t('pro.rcv.ledger')}{' '}
              <Link
                href={`/erp/ledger?entry=${done.journalEntryId}`}
                className="font-semibold text-emerald-700 underline dark:text-emerald-300"
              >
                {t('pro.rcv.openLedger')}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onBack(order.id)}
            className={proPrimaryButton}
          >
            {t('pro.backToOrder')}
          </button>
          <button type="button" onClick={onClose} className={proSecondaryButton}>
            {t('erp.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Fact label={t('pro.rcv.order')}>
          <Num className="text-emerald-700 dark:text-emerald-300">
            PO-{order.number}
          </Num>{' '}
          · {order.supplierName}
        </Fact>
        <WarehouseSelect
          value={warehouseId}
          onChange={setWarehouseId}
          label={t('erp.form.warehouse')}
        />
        <Field label={t('pro.rcv.date')}>
          <input
            type="date"
            value={receiptDate}
            onChange={(event) => setReceiptDate(event.target.value)}
            dir="ltr"
            className={proInputClass}
          />
        </Field>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 text-start">{t('erp.form.description')}</th>
              <th className="px-3 py-2 text-end">{t('pro.ord.ordered')}</th>
              <th className="px-3 py-2 text-end">{t('pro.ord.received')}</th>
              <th className="px-3 py-2 text-start">{t('pro.rcv.now')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ds-border-hairline)] text-slate-800 dark:text-slate-100">
            {order.lines.map((line) => {
              const open = line.quantity - line.receivedQuantity
              return (
                <tr key={line.id}>
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.quantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.receivedQuantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={quantities[line.id] ?? ''}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [line.id]: event.target.value,
                        }))
                      }
                      disabled={open === 0}
                      inputMode="numeric"
                      dir="ltr"
                      aria-label={`${t('pro.rcv.now')} — ${line.description}`}
                      className={`${proInputClass} mt-0 w-28`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Field label={t('erp.form.notes')}>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={500}
          rows={2}
          className={proInputClass}
        />
      </Field>

      {errors.length > 0 ? (
        <ul role="alert" className={`${proErrorClass} list-disc space-y-1 ps-6`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
        </ul>
      ) : null}
      <FailureMessage failure={failure} onReload={reload} />

      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ds-border-hairline)] pt-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={proPrimaryButton}
        >
          {pending ? t('erp.loading') : t('pro.rcv.confirm')}
        </button>
        <button
          type="button"
          onClick={() => onBack(order.id)}
          className={proSecondaryButton}
        >
          {t('pro.backToOrder')}
        </button>
      </div>
    </div>
  )
}
