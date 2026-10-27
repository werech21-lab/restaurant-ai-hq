'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { ListPage } from '@/components/erp/common'
import { dangerButton, errorClass, inputClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { computeTotals } from '@/modules/finance/client'
import {
  canCancel,
  canInvoiceOrder,
  canReceive,
  createOrderSchema,
  isEditable,
  orderNeedsApproval,
  updateOrderSchema,
  type GoodsReceipt,
  type ProcurementSettings,
  returnableQuantity,
  type PurchaseOrderDetail,
  type PurchaseReturn,
  type SupplierInvoice,
} from '@/modules/procurement/client'
import { useCan } from '@/modules/procurement/ui/permissions'
import { draftFromLine, emptyLine, LineEditor, lineIssue, orderLinesPayload, type LineDraft } from '@/modules/procurement/ui/LineEditor'
import { SupplierSelect } from '@/modules/procurement/ui/Selects'
import {
  Fact,
  FailureMessage,
  Field,
  InvoiceStatusBadge,
  OrderStatusBadge,
  dateTimeText,
  minorText,
  todayUtc,
  useIdempotencyKey,
  useRunner,
  type Phase,
} from '@/modules/procurement/ui/shared'

type Props = {
  orderId?: string
  onChanged: (message: MessageKey) => void
  onClose: () => void
  onReceive: (orderId: string) => void
  onInvoice: (orderId: string) => void
  onReturn: (orderId: string) => void
  onOpenInvoice: (invoiceId: string) => void
  onOpenReturn: (returnId: string) => void
}

function formIssue(path: ReadonlyArray<PropertyKey>): MessageKey {
  if (path[0] === 'supplierId') return 'pro.err.form.supplier'
  if (path[0] === 'orderDate' || path[0] === 'expectedDate') return 'pro.err.form.date'
  return lineIssue(path)
}

/** A purchase order: edit a draft, move it through approval, and see what is received and billed per line. */
export function OrderDialog({ orderId, onChanged, onClose, onReceive, onInvoice, onReturn, onOpenInvoice, onOpenReturn }: Props) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null)
  const [phase, setPhase] = useState<Phase>(orderId ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [reloadCount, setReloadCount] = useState(0)

  const [supplierId, setSupplierId] = useState('')
  const [orderDate, setOrderDate] = useState(todayUtc)
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>(() => [emptyLine()])
  const [settings, setSettings] = useState<ProcurementSettings | null>(null)
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([])
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [returns, setReturns] = useState<PurchaseReturn[]>([])
  const canReceiveGoods = useCan(permissions.procurementReceiptCreate)
  const canBill = useCan(permissions.procurementInvoiceCreate)
  const canReturnGoods = useCan(permissions.procurementReturnCreate)
  const canSubmit = useCan(permissions.procurementOrderSubmit)
  const canApprove = useCan(permissions.procurementOrderApprove)
  const canCancelOrder = useCan(permissions.procurementOrderCancel)
  const canSave = useCan(detail ? permissions.procurementOrderUpdate : permissions.procurementOrderCreate)

  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [notice, setNotice] = useState<MessageKey | null>(null)

  const createKey = useIdempotencyKey()
  const { pending, failure, run } = useRunner()
  const editable = detail === null || isEditable(detail.status)

  const applyDetail = useCallback((next: PurchaseOrderDetail) => {
    setDetail(next)
    setSupplierId(next.supplierId)
    setOrderDate(next.orderDate)
    setExpectedDate(next.expectedDate ?? '')
    setNotes(next.notes ?? '')
    setLines(next.lines.map(draftFromLine))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ data: ProcurementSettings }>('/api/v1/procurement/settings', { signal: controller.signal })
      .then((payload) => setSettings(payload.data))
      .catch(() => setSettings(null))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!orderId) return
    const controller = new AbortController()
    apiRequest<{ data: PurchaseOrderDetail }>(`/api/v1/procurement/orders/${orderId}`, { signal: controller.signal })
      .then((payload) => {
        applyDetail(payload.data)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    // The history sections are extra context: a user without those permissions still sees the order.
    apiRequest<ListPage<GoodsReceipt>>(`/api/v1/procurement/receipts?orderId=${orderId}&limit=50`, { signal: controller.signal })
      .then((page) => setReceipts(page.data))
      .catch(() => setReceipts([]))
    apiRequest<ListPage<SupplierInvoice>>(`/api/v1/procurement/invoices?orderId=${orderId}&limit=50`, { signal: controller.signal })
      .then((page) => setInvoices(page.data))
      .catch(() => setInvoices([]))
    apiRequest<ListPage<PurchaseReturn>>(`/api/v1/procurement/returns?orderId=${orderId}&limit=50`, { signal: controller.signal })
      .then((page) => setReturns(page.data))
      .catch(() => setReturns([]))
    return () => controller.abort()
  }, [orderId, reloadCount, applyDetail])

  const reload = useCallback(() => {
    setPhase('loading')
    setReloadCount((value) => value + 1)
  }, [])

  const totals = useMemo(() => {
    const payload = orderLinesPayload(lines)
    if (payload.some((line) => !Number.isFinite(line.quantity) || !Number.isFinite(line.unitCostMinor) || !Number.isFinite(line.taxRateBps))) return null
    try {
      return computeTotals(payload.map((line) => ({ quantity: line.quantity, unitPriceMinor: line.unitCostMinor, taxRateBps: line.taxRateBps })))
    } catch {
      return null
    }
  }, [lines])

  function done(message: MessageKey, next?: PurchaseOrderDetail) {
    if (next) applyDetail(next)
    setNotice(message)
    setCancelling(false)
    setReason('')
    onChanged(message)
  }

  async function persist(): Promise<PurchaseOrderDetail | null> {
    setErrors([])
    const base = {
      orderDate,
      expectedDate: expectedDate === '' ? null : expectedDate,
      notes: notes.trim() === '' ? null : notes,
      lines: orderLinesPayload(lines),
    }
    const parsed = detail
      ? updateOrderSchema.safeParse({ ...base, version: detail.version })
      : createOrderSchema.safeParse({ ...base, supplierId })
    if (!parsed.success) {
      setErrors(Array.from(new Set(parsed.error.issues.map((issue) => formIssue(issue.path)))))
      return null
    }
    const saved = detail
      ? await apiRequest<{ data: PurchaseOrderDetail }>(`/api/v1/procurement/orders/${detail.id}`, { method: 'PATCH', body: parsed.data })
      : await apiRequest<{ data: PurchaseOrderDetail }>('/api/v1/procurement/orders', {
          method: 'POST',
          body: parsed.data,
          idempotencyKey: createKey.ref.current,
        })
    createKey.reset()
    applyDetail(saved.data)
    return saved.data
  }

  function save() {
    void run(async () => {
      const saved = await persist()
      if (saved) done('pro.msg.orderSaved')
    }, createKey)
  }

  function transition(action: 'submit' | 'approve' | 'cancel', message: MessageKey) {
    void run(async () => {
      let target = detail
      if (action === 'submit') {
        target = await persist()
        if (!target) return
      }
      if (!target) return
      const body = action === 'cancel' ? { version: target.version, reason } : { version: target.version }
      const result = await apiRequest<{ data: PurchaseOrderDetail }>(`/api/v1/procurement/orders/${target.id}/${action}`, { method: 'POST', body })
      done(message, result.data)
    }, action === 'submit' ? createKey : undefined)
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

  const threshold = settings?.approvalThresholdMinor ?? null
  const needsApproval = totals !== null && orderNeedsApproval(totals.totalMinor, threshold)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-100">
          {detail ? (
            <>
              <Num className="text-blue-300">PO-{detail.number}</Num>
              <OrderStatusBadge status={detail.status} />
            </>
          ) : (
            t('pro.ord.new')
          )}
        </h3>
        {detail ? (
          <div className="flex flex-wrap gap-2">
            {canReceive(detail.status) && canReceiveGoods ? (
              <button type="button" onClick={() => onReceive(detail.id)} className={primaryButton}>
                {t('pro.ord.receive')}
              </button>
            ) : null}
            {canInvoiceOrder(detail.status) && canBill ? (
              <button type="button" onClick={() => onInvoice(detail.id)} className={secondaryButton}>
                {t('pro.ord.bill')}
              </button>
            ) : null}
            {canReturnGoods && detail.lines.some((line) => returnableQuantity(line) > 0) ? (
              <button type="button" onClick={() => onReturn(detail.id)} className={secondaryButton}>
                {t('pro.ord.return')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className={noticeClass}>
          {t(notice)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {detail ? (
          <Fact label={t('pro.col.supplier')}>{detail.supplierName}</Fact>
        ) : (
          <SupplierSelect value={supplierId} onChange={setSupplierId} label={t('pro.col.supplier')} />
        )}
        <Field label={t('pro.ord.orderDate')}>
          <input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} disabled={!editable} dir="ltr" className={inputClass} />
        </Field>
        <Field label={t('pro.ord.expectedDate')}>
          <input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} disabled={!editable} dir="ltr" className={inputClass} />
        </Field>
        <Field label={t('erp.form.notes')} className="sm:col-span-3">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!editable} maxLength={2000} rows={2} className={inputClass} />
        </Field>
      </div>

      {detail && !editable ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-start font-medium">{t('erp.form.description')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('pro.ord.ordered')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('pro.ord.received')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('pro.ord.invoiced')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('pro.ord.returned')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('pro.cn.credited')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('pro.line.unitCost')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('erp.form.tax')}</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line) => (
                <tr key={line.id} className="border-b border-[#30363d]/60 text-gray-200">
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2">
                    <Num>{line.quantity.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Num>{line.receivedQuantity.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Num>{line.invoicedQuantity.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Num>{line.returnedQuantity.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Num>{line.creditedQuantity.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Money value={minorText(line.unitCostMinor)} />
                  </td>
                  <td className="px-3 py-2">
                    <Num>{(line.taxRateBps / 100).toFixed(2)}%</Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section aria-label={t('erp.form.lines')}>
          <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('erp.form.lines')}</h4>
          <LineEditor lines={lines} onChange={setLines} priced disabled={!editable} />
        </section>
      )}

      {detail && !editable ? (
        <div className="grid grid-cols-3 gap-4 rounded-xl border border-[#30363d] p-4">
          <Fact label={t('erp.form.subtotal')}>
            <Money value={minorText(detail.subtotalMinor)} />
          </Fact>
          <Fact label={t('erp.form.taxTotal')}>
            <Money value={minorText(detail.taxMinor)} />
          </Fact>
          <Fact label={t('erp.form.total')}>
            <Money value={minorText(detail.totalMinor)} className="font-semibold" />
          </Fact>
        </div>
      ) : totals ? (
        <div className="space-y-2 rounded-xl border border-[#30363d] p-4">
          <div className="grid grid-cols-3 gap-4">
            <Fact label={t('erp.form.subtotal')}>
              <Money value={minorText(totals.subtotalMinor)} />
            </Fact>
            <Fact label={t('erp.form.taxTotal')}>
              <Money value={minorText(totals.taxMinor)} />
            </Fact>
            <Fact label={t('erp.form.total')}>
              <Money value={minorText(totals.totalMinor)} className="font-semibold" />
            </Fact>
          </div>
          {needsApproval && threshold !== null ? (
            <p className="text-sm text-amber-300">
              {t('pro.ord.approvalNote')} <Money value={minorText(threshold)} />
            </p>
          ) : null}
        </div>
      ) : null}

      {detail && (detail.submittedAt || detail.approvedAt || detail.cancelledAt) ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {detail.submittedAt ? <Fact label={t('pro.ord.submittedAt')}>{dateTimeText(detail.submittedAt)}</Fact> : null}
          {detail.approvedAt ? <Fact label={t('pro.ord.approvedAt')}>{dateTimeText(detail.approvedAt)}</Fact> : null}
          {detail.cancelledAt ? <Fact label={t('pro.ord.cancelledAt')}>{dateTimeText(detail.cancelledAt)}</Fact> : null}
          {detail.cancelledReason ? <Fact label={t('pro.reason')}>{detail.cancelledReason}</Fact> : null}
        </div>
      ) : null}

      {receipts.length > 0 ? (
        <section aria-label={t('pro.ord.receipts')}>
          <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('pro.ord.receipts')}</h4>
          <ul className="space-y-1.5 text-sm text-gray-300">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#30363d] px-3 py-2">
                <Num className="font-semibold text-blue-300">GR-{receipt.number}</Num>
                <Num>{receipt.receiptDate}</Num>
                <span>
                  {t('pro.ord.units')}: <Num>{receipt.totalQuantity.toLocaleString('en-US')}</Num>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {returns.length > 0 ? (
        <section aria-label={t('pro.ord.returns')}>
          <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('pro.ord.returns')}</h4>
          <ul className="space-y-1.5 text-sm text-gray-300">
            {returns.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onOpenReturn(entry.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-[#30363d] px-3 py-2 text-start hover:bg-white/[0.04]"
                >
                  <Num className="font-semibold text-blue-300">RT-{entry.number}</Num>
                  <Num>{entry.returnDate}</Num>
                  <span>
                    {t('pro.ord.units')}: <Num>{entry.totalQuantity.toLocaleString('en-US')}</Num>
                  </span>
                  <Money value={minorText(entry.valueMinor)} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {invoices.length > 0 ? (
        <section aria-label={t('pro.ord.invoices')}>
          <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('pro.ord.invoices')}</h4>
          <ul className="space-y-1.5 text-sm text-gray-300">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <button
                  type="button"
                  onClick={() => onOpenInvoice(invoice.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-[#30363d] px-3 py-2 text-start hover:bg-white/[0.04]"
                >
                  <Num className="font-semibold text-blue-300">SI-{invoice.number}</Num>
                  <Num>{invoice.supplierInvoiceNumber}</Num>
                  <Money value={minorText(invoice.totalMinor)} />
                  <InvoiceStatusBadge status={invoice.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cancelling ? (
        <section className="space-y-3 rounded-xl border border-[#30363d] p-4">
          <Field label={t('pro.reason')}>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} className={inputClass} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending || reason.trim() === ''} onClick={() => transition('cancel', 'pro.msg.orderCancelled')} className={dangerButton}>
              {t('pro.ord.cancel')}
            </button>
            <button type="button" onClick={() => setCancelling(false)} className={secondaryButton}>
              {t('erp.cancel')}
            </button>
          </div>
        </section>
      ) : null}

      {errors.length > 0 ? (
        <ul role="alert" className={`${errorClass} list-disc space-y-1 ps-6`}>
          {errors.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      ) : null}
      <FailureMessage failure={failure} onReload={reload} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#30363d] pt-4">
        <div className="flex flex-wrap gap-2">
          {editable && canSave ? (
            <button type="button" onClick={save} disabled={pending} className={secondaryButton}>
              {t('pro.save')}
            </button>
          ) : null}
          {editable && canSave && canSubmit ? (
            <button type="button" onClick={() => transition('submit', 'pro.msg.orderSubmitted')} disabled={pending} className={primaryButton}>
              {t('pro.ord.submit')}
            </button>
          ) : null}
          {detail?.status === 'pending_approval' && canApprove ? (
            <button type="button" onClick={() => transition('approve', 'pro.msg.orderApproved')} disabled={pending} className={primaryButton}>
              {t('pro.ord.approve')}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {detail && canCancel(detail.status) && canCancelOrder ? (
            <button type="button" onClick={() => setCancelling(true)} disabled={pending} className={dangerButton}>
              {t('pro.ord.cancel')}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={secondaryButton}>
            {t('erp.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
