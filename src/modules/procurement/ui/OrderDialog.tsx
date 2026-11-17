'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { ListPage } from '@/components/erp/common'
import { Num } from '@/components/ui'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import { formatDate, formatInt, formatPct, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { computeTotals } from '@/modules/finance/client'
import {
  canCancel,
  canInvoiceOrder,
  canReceive,
  createOrderSchema,
  isEditable,
  orderNeedsApproval,
  returnableQuantity,
  updateOrderSchema,
  type GoodsReceipt,
  type ProcurementSettings,
  type PurchaseOrderDetail,
  type PurchaseReturn,
  type SupplierInvoice,
} from '@/modules/procurement/client'
import {
  draftFromLine,
  emptyLine,
  LineEditor,
  lineIssue,
  orderLinesPayload,
  type LineDraft,
} from '@/modules/procurement/ui/LineEditor'
import { useCan } from '@/modules/procurement/ui/permissions'
import { SupplierSelect } from '@/modules/procurement/ui/Selects'
import {
  Fact,
  FailureMessage,
  Field,
  InvoiceStatusBadge,
  OrderStatusBadge,
  dateTimeText,
  formatMinorKwd,
  proDangerButton,
  proErrorClass,
  proInputClass,
  proNoticeClass,
  proPrimaryButton,
  proSecondaryButton,
  proSubtleClass,
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

/** A purchase order: edit a draft, move it through approval, and see receipts and bills. */
export function OrderDialog({
  orderId,
  onChanged,
  onClose,
  onReceive,
  onInvoice,
  onReturn,
  onOpenInvoice,
  onOpenReturn,
}: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
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
  const canSave = useCan(
    detail ? permissions.procurementOrderUpdate : permissions.procurementOrderCreate,
  )

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
    apiRequest<{ data: ProcurementSettings }>('/api/v1/procurement/settings', {
      signal: controller.signal,
    })
      .then((payload) => setSettings(payload.data))
      .catch(() => setSettings(null))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!orderId) return
    const controller = new AbortController()
    apiRequest<{ data: PurchaseOrderDetail }>(
      `/api/v1/procurement/orders/${orderId}`,
      { signal: controller.signal },
    )
      .then((payload) => {
        applyDetail(payload.data)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    apiRequest<ListPage<GoodsReceipt>>(
      `/api/v1/procurement/receipts?orderId=${orderId}&limit=50`,
      { signal: controller.signal },
    )
      .then((page) => setReceipts(page.data))
      .catch(() => setReceipts([]))
    apiRequest<ListPage<SupplierInvoice>>(
      `/api/v1/procurement/invoices?orderId=${orderId}&limit=50`,
      { signal: controller.signal },
    )
      .then((page) => setInvoices(page.data))
      .catch(() => setInvoices([]))
    apiRequest<ListPage<PurchaseReturn>>(
      `/api/v1/procurement/returns?orderId=${orderId}&limit=50`,
      { signal: controller.signal },
    )
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
    if (
      payload.some(
        (line) =>
          !Number.isFinite(line.quantity) ||
          !Number.isFinite(line.unitCostMinor) ||
          !Number.isFinite(line.taxRateBps),
      )
    ) {
      return null
    }
    try {
      return computeTotals(
        payload.map((line) => ({
          quantity: line.quantity,
          unitPriceMinor: line.unitCostMinor,
          taxRateBps: line.taxRateBps,
        })),
      )
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
      setErrors(
        Array.from(
          new Set(parsed.error.issues.map((issue) => formIssue(issue.path))),
        ),
      )
      return null
    }
    const saved = detail
      ? await apiRequest<{ data: PurchaseOrderDetail }>(
          `/api/v1/procurement/orders/${detail.id}`,
          { method: 'PATCH', body: parsed.data },
        )
      : await apiRequest<{ data: PurchaseOrderDetail }>(
          '/api/v1/procurement/orders',
          {
            method: 'POST',
            body: parsed.data,
            idempotencyKey: createKey.ref.current,
          },
        )
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

  function transition(
    action: 'submit' | 'approve' | 'cancel',
    message: MessageKey,
  ) {
    void run(
      async () => {
        let target = detail
        if (action === 'submit') {
          target = await persist()
          if (!target) return
        }
        if (!target) return
        const body =
          action === 'cancel'
            ? { version: target.version, reason }
            : { version: target.version }
        const result = await apiRequest<{ data: PurchaseOrderDetail }>(
          `/api/v1/procurement/orders/${target.id}/${action}`,
          { method: 'POST', body },
        )
        done(message, result.data)
      },
      action === 'submit' ? createKey : undefined,
    )
  }

  if (phase === 'loading') {
    return (
      <StateBlock
        state="loading"
        locale={fmtLocale}
        skeletonRows={5}
        title={t('erp.loading')}
      />
    )
  }
  if (phase === 'error') {
    return (
      <StateBlock
        state={loadError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
        locale={fmtLocale}
        title={t(loadError)}
        onRetry={loadError === 'erp.err.forbidden' ? undefined : reload}
      />
    )
  }

  const threshold = settings?.approvalThresholdMinor ?? null
  const needsApproval =
    totals !== null && orderNeedsApproval(totals.totalMinor, threshold)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
          {detail ? (
            <>
              <Num className="text-emerald-700 dark:text-emerald-300">
                PO-{detail.number}
              </Num>
              <OrderStatusBadge status={detail.status} />
            </>
          ) : (
            t('pro.ord.new')
          )}
        </h4>
        {detail ? (
          <div className="flex flex-wrap gap-2">
            {canReceive(detail.status) && canReceiveGoods ? (
              <button
                type="button"
                onClick={() => onReceive(detail.id)}
                className={proPrimaryButton}
              >
                {t('pro.ord.receive')}
              </button>
            ) : null}
            {canInvoiceOrder(detail.status) && canBill ? (
              <button
                type="button"
                onClick={() => onInvoice(detail.id)}
                className={proSecondaryButton}
              >
                {t('pro.ord.bill')}
              </button>
            ) : null}
            {canReturnGoods &&
            detail.lines.some((line) => returnableQuantity(line) > 0) ? (
              <button
                type="button"
                onClick={() => onReturn(detail.id)}
                className={proSecondaryButton}
              >
                {t('pro.ord.return')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className={proNoticeClass}>
          {t(notice)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {detail ? (
          <Fact label={t('pro.col.supplier')}>{detail.supplierName}</Fact>
        ) : (
          <SupplierSelect
            value={supplierId}
            onChange={setSupplierId}
            label={t('pro.col.supplier')}
          />
        )}
        <Field label={t('pro.ord.orderDate')}>
          <input
            type="date"
            value={orderDate}
            onChange={(event) => setOrderDate(event.target.value)}
            disabled={!editable}
            dir="ltr"
            className={proInputClass}
          />
        </Field>
        <Field label={t('pro.ord.expectedDate')}>
          <input
            type="date"
            value={expectedDate}
            onChange={(event) => setExpectedDate(event.target.value)}
            disabled={!editable}
            dir="ltr"
            className={proInputClass}
          />
        </Field>
        <Field label={t('erp.form.notes')} className="sm:col-span-3">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={!editable}
            maxLength={2000}
            rows={2}
            className={proInputClass}
          />
        </Field>
      </div>

      {detail && !editable ? (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-start">{t('erp.form.description')}</th>
                <th className="px-3 py-2 text-end">{t('pro.ord.ordered')}</th>
                <th className="px-3 py-2 text-end">{t('pro.ord.received')}</th>
                <th className="px-3 py-2 text-end">{t('pro.ord.invoiced')}</th>
                <th className="px-3 py-2 text-end">{t('pro.ord.returned')}</th>
                <th className="px-3 py-2 text-end">{t('pro.cn.credited')}</th>
                <th className="px-3 py-2 text-end">{t('pro.line.unitCost')}</th>
                <th className="px-3 py-2 text-end">{t('erp.form.tax')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ds-border-hairline)] text-slate-800 dark:text-slate-100">
              {detail.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.quantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.receivedQuantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.invoicedQuantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.returnedQuantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.creditedQuantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatMinorKwd(line.unitCostMinor, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>
                      {formatPct(line.taxRateBps / 100, {
                        locale: fmtLocale,
                        decimals: 2,
                      })}
                    </Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section aria-label={t('erp.form.lines')}>
          <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t('erp.form.lines')}
          </h4>
          <LineEditor
            lines={lines}
            onChange={setLines}
            priced
            disabled={!editable}
          />
        </section>
      )}

      {detail && !editable ? (
        <div className={`${proSubtleClass} grid grid-cols-1 gap-4 sm:grid-cols-3`}>
          <Fact label={t('erp.form.subtotal')}>
            <Num>{formatMinorKwd(detail.subtotalMinor, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('erp.form.taxTotal')}>
            <Num>{formatMinorKwd(detail.taxMinor, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('erp.form.total')}>
            <Num className="font-semibold">
              {formatMinorKwd(detail.totalMinor, fmtLocale)}
            </Num>
          </Fact>
        </div>
      ) : totals ? (
        <div className={`${proSubtleClass} space-y-2`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Fact label={t('erp.form.subtotal')}>
              <Num>{formatMinorKwd(totals.subtotalMinor, fmtLocale)}</Num>
            </Fact>
            <Fact label={t('erp.form.taxTotal')}>
              <Num>{formatMinorKwd(totals.taxMinor, fmtLocale)}</Num>
            </Fact>
            <Fact label={t('erp.form.total')}>
              <Num className="font-semibold">
                {formatMinorKwd(totals.totalMinor, fmtLocale)}
              </Num>
            </Fact>
          </div>
          {needsApproval && threshold !== null ? (
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {t('pro.ord.approvalNote')}{' '}
              <Num>{formatMinorKwd(threshold, fmtLocale)}</Num>
            </p>
          ) : null}
        </div>
      ) : null}

      {detail && (detail.submittedAt || detail.approvedAt || detail.cancelledAt) ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {detail.submittedAt ? (
            <Fact label={t('pro.ord.submittedAt')}>
              <Num>{dateTimeText(detail.submittedAt, fmtLocale)}</Num>
            </Fact>
          ) : null}
          {detail.approvedAt ? (
            <Fact label={t('pro.ord.approvedAt')}>
              <Num>{dateTimeText(detail.approvedAt, fmtLocale)}</Num>
            </Fact>
          ) : null}
          {detail.cancelledAt ? (
            <Fact label={t('pro.ord.cancelledAt')}>
              <Num>{dateTimeText(detail.cancelledAt, fmtLocale)}</Num>
            </Fact>
          ) : null}
          {detail.cancelledReason ? (
            <Fact label={t('pro.reason')}>{detail.cancelledReason}</Fact>
          ) : null}
        </div>
      ) : null}

      {receipts.length > 0 ? (
        <section aria-label={t('pro.ord.receipts')}>
          <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t('pro.ord.receipts')}
          </h4>
          <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
            {receipts.map((receipt) => (
              <li
                key={receipt.id}
                className="ds-surface-subtle flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
              >
                <Num className="font-semibold text-emerald-700 dark:text-emerald-300">
                  GR-{receipt.number}
                </Num>
                <Num>{formatDate(receipt.receiptDate, fmtLocale)}</Num>
                <span>
                  {t('pro.ord.units')}:{' '}
                  <Num>{formatInt(receipt.totalQuantity, fmtLocale)}</Num>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {returns.length > 0 ? (
        <section aria-label={t('pro.ord.returns')}>
          <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t('pro.ord.returns')}
          </h4>
          <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
            {returns.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onOpenReturn(entry.id)}
                  className="ds-surface-subtle ds-focus-ring flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-start hover:border-emerald-500/40"
                >
                  <Num className="font-semibold text-emerald-700 dark:text-emerald-300">
                    RT-{entry.number}
                  </Num>
                  <Num>{formatDate(entry.returnDate, fmtLocale)}</Num>
                  <span>
                    {t('pro.ord.units')}:{' '}
                    <Num>{formatInt(entry.totalQuantity, fmtLocale)}</Num>
                  </span>
                  <Num>{formatMinorKwd(entry.valueMinor, fmtLocale)}</Num>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {invoices.length > 0 ? (
        <section aria-label={t('pro.ord.invoices')}>
          <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t('pro.ord.invoices')}
          </h4>
          <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <button
                  type="button"
                  onClick={() => onOpenInvoice(invoice.id)}
                  className="ds-surface-subtle ds-focus-ring flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-start hover:border-emerald-500/40"
                >
                  <Num className="font-semibold text-emerald-700 dark:text-emerald-300">
                    SI-{invoice.number}
                  </Num>
                  <Num>{invoice.supplierInvoiceNumber}</Num>
                  <Num>{formatMinorKwd(invoice.totalMinor, fmtLocale)}</Num>
                  <InvoiceStatusBadge status={invoice.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cancelling ? (
        <section className={`${proSubtleClass} space-y-3`}>
          <Field label={t('pro.reason')}>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={2}
              className={proInputClass}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || reason.trim() === ''}
              onClick={() => transition('cancel', 'pro.msg.orderCancelled')}
              className={proDangerButton}
            >
              {t('pro.ord.cancel')}
            </button>
            <button
              type="button"
              onClick={() => setCancelling(false)}
              className={proSecondaryButton}
            >
              {t('erp.cancel')}
            </button>
          </div>
        </section>
      ) : null}

      {errors.length > 0 ? (
        <ul role="alert" className={`${proErrorClass} list-disc space-y-1 ps-6`}>
          {errors.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      ) : null}
      <FailureMessage failure={failure} onReload={reload} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ds-border-hairline)] pt-4">
        <div className="flex flex-wrap gap-2">
          {editable && canSave ? (
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className={proSecondaryButton}
            >
              {t('pro.save')}
            </button>
          ) : null}
          {editable && canSave && canSubmit ? (
            <button
              type="button"
              onClick={() => transition('submit', 'pro.msg.orderSubmitted')}
              disabled={pending}
              className={proPrimaryButton}
            >
              {t('pro.ord.submit')}
            </button>
          ) : null}
          {detail?.status === 'pending_approval' && canApprove ? (
            <button
              type="button"
              onClick={() => transition('approve', 'pro.msg.orderApproved')}
              disabled={pending}
              className={proPrimaryButton}
            >
              {t('pro.ord.approve')}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {detail && canCancel(detail.status) && canCancelOrder ? (
            <button
              type="button"
              onClick={() => setCancelling(true)}
              disabled={pending}
              className={proDangerButton}
            >
              {t('pro.ord.cancel')}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={proSecondaryButton}>
            {t('erp.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
