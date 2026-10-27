'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { ListPage } from '@/components/erp/common'
import { dangerButton, errorClass, inputClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Badge, Money, Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { minorToInput, parseKwdToMinor } from '@/lib/money'
import {
  createPaymentSchema,
  paymentMethods,
  planPayment,
  voidPaymentSchema,
  type PaymentMethod,
  type SupplierInvoice,
  type SupplierPaymentDetail,
} from '@/modules/procurement/client'
import { useCan } from '@/modules/procurement/ui/permissions'
import { AccountSelect, SupplierSelect } from '@/modules/procurement/ui/Selects'
import { Fact, FailureMessage, Field, dateTimeText, minorText, todayUtc, useIdempotencyKey, useRunner, type Phase } from '@/modules/procurement/ui/shared'

const methodLabels: Record<PaymentMethod, MessageKey> = {
  cash: 'pro.pay.method.cash',
  bank_transfer: 'pro.pay.method.bank_transfer',
  cheque: 'pro.pay.method.cheque',
}

type Props = {
  /** Open one recorded payment. */
  paymentId?: string
  /** Start a new payment with this supplier and this invoice's open balance filled in. */
  start?: { supplierId: string; invoiceId: string }
  onChanged: (message: MessageKey) => void
  onClose: () => void
  onOpenInvoice: (invoiceId: string) => void
}

/**
 * Pays one supplier. The payment is spread in full over that supplier's open invoices, each within its balance, so a partial
 * payment is an allocation below the balance. The amount is the sum of the allocations and cannot disagree with them.
 */
export function PaymentDialog({ paymentId, start, onChanged, onClose, onOpenInvoice }: Props) {
  const { t } = useI18n()
  const canVoid = useCan(permissions.procurementPaymentVoid)
  const [payment, setPayment] = useState<SupplierPaymentDetail | null>(null)
  const [phase, setPhase] = useState<Phase>(paymentId ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [reloadCount, setReloadCount] = useState(0)

  const [supplierId, setSupplierId] = useState(start?.supplierId ?? '')
  const [open, setOpen] = useState<SupplierInvoice[]>([])
  const [openPhase, setOpenPhase] = useState<Phase>('ready')
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [paymentDate, setPaymentDate] = useState(todayUtc)
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer')
  const [reference, setReference] = useState('')
  const [paidFromId, setPaidFromId] = useState('')
  const [notes, setNotes] = useState('')

  const [voiding, setVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidDate, setVoidDate] = useState(todayUtc)
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const key = useIdempotencyKey()
  const { pending, failure, run } = useRunner()

  useEffect(() => {
    if (!paymentId) return
    const controller = new AbortController()
    setPhase('loading')
    apiRequest<{ data: SupplierPaymentDetail }>(`/api/v1/procurement/payments/${paymentId}`, { signal: controller.signal })
      .then((payload) => {
        setPayment(payload.data)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [paymentId, reloadCount])

  // The open invoices of the chosen supplier. Changing the supplier clears what was typed against the old one.
  useEffect(() => {
    if (paymentId || supplierId === '') {
      setOpen([])
      return
    }
    const controller = new AbortController()
    setOpenPhase('loading')
    apiRequest<ListPage<SupplierInvoice>>(`/api/v1/procurement/invoices?limit=100&status=posted&settlement=open&supplierId=${supplierId}`, {
      signal: controller.signal,
    })
      .then((page) => {
        setOpen(page.data)
        setAllocations(
          start && start.supplierId === supplierId
            ? Object.fromEntries(page.data.filter((invoice) => invoice.id === start.invoiceId).map((invoice) => [invoice.id, minorToInput(invoice.balanceMinor)]))
            : {}
        )
        setOpenPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setOpenPhase('error')
      })
    return () => controller.abort()
  }, [paymentId, supplierId, start, reloadCount])

  const chosen = useMemo(
    () =>
      open
        .map((invoice) => ({ invoiceId: invoice.id, text: (allocations[invoice.id] ?? '').trim() }))
        .filter((entry) => entry.text !== '' && entry.text !== '0')
        .map((entry) => ({ invoiceId: entry.invoiceId, amountMinor: parseKwdToMinor(entry.text) ?? Number.NaN })),
    [open, allocations]
  )
  const total = useMemo(() => chosen.reduce((sum, entry) => (Number.isInteger(entry.amountMinor) ? sum + entry.amountMinor : sum), 0), [chosen])

  function submit() {
    setErrors([])
    const parsed = createPaymentSchema.safeParse({
      supplierId,
      paymentDate,
      amountMinor: total,
      currency: 'KWD',
      method,
      reference: reference.trim() === '' ? null : reference,
      paidFromAccountId: paidFromId,
      notes: notes.trim() === '' ? null : notes,
      allocations: chosen,
    })
    if (!parsed.success) {
      const keys = parsed.error.issues.map((issue): MessageKey => {
        if (issue.path[0] === 'supplierId') return 'pro.err.form.supplier'
        if (issue.path[0] === 'paymentDate') return 'pro.err.form.date'
        if (issue.path[0] === 'paidFromAccountId') return 'pro.err.form.paidFrom'
        if (issue.path[0] === 'reference') return 'pro.err.form.reference'
        if (issue.path[0] === 'allocations' && issue.path.length > 1) return 'pro.err.form.allocation'
        return 'pro.err.form.allocations'
      })
      setErrors(Array.from(new Set(keys)))
      return
    }
    try {
      planPayment(
        supplierId,
        paymentDate,
        parsed.data.amountMinor,
        parsed.data.allocations,
        open.map((invoice) => ({
          id: invoice.id,
          supplierId: invoice.supplierId,
          status: invoice.status,
          invoiceDate: invoice.invoiceDate,
          balanceMinor: invoice.balanceMinor,
        }))
      )
    } catch (error) {
      setErrors([errorKey(error)])
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: SupplierPaymentDetail }>('/api/v1/procurement/payments', {
        method: 'POST',
        body: parsed.data,
        idempotencyKey: key.ref.current,
      })
      key.reset()
      setPayment(result.data)
      setNotice('pro.msg.paymentPosted')
      onChanged('pro.msg.paymentPosted')
    }, key)
  }

  function voidPayment() {
    if (!payment) return
    setErrors([])
    const parsed = voidPaymentSchema.safeParse({ version: payment.version, reason: voidReason, entryDate: voidDate })
    if (!parsed.success) {
      setErrors(['pro.err.form.void'])
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: SupplierPaymentDetail }>(`/api/v1/procurement/payments/${payment.id}/void`, { method: 'POST', body: parsed.data })
      setPayment(result.data)
      setVoiding(false)
      setNotice('pro.msg.paymentVoided')
      onChanged('pro.msg.paymentVoided')
    })
  }

  if (phase === 'loading') return <p className="py-8 text-center text-sm text-gray-400">{t('erp.loading')}</p>
  if (phase === 'error') {
    return (
      <div className="space-y-3 py-6 text-center">
        <p role="alert" className={`${errorClass} inline-block`}>
          {t(loadError)}
        </p>
        <div>
          <button type="button" onClick={() => setReloadCount((value) => value + 1)} className={secondaryButton}>
            {t('erp.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (payment) {
    return (
      <div className="space-y-5">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-100">
          <Num className="text-blue-300">PAY-{payment.number}</Num>
          <Badge tone={payment.status === 'posted' ? 'good' : 'neutral'}>{t(payment.status === 'posted' ? 'pro.pstatus.posted' : 'pro.pstatus.void')}</Badge>
        </h3>
        {notice ? (
          <p role="status" className={noticeClass}>
            {t(notice)}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label={t('pro.col.supplier')}>{payment.supplierName}</Fact>
          <Fact label={t('pro.pay.date')}>
            <Num>{payment.paymentDate}</Num>
          </Fact>
          <Fact label={t('pro.pay.method')}>{t(methodLabels[payment.method])}</Fact>
          <Fact label={t('pro.pay.reference')}>{payment.reference ? <Num>{payment.reference}</Num> : '—'}</Fact>
          <Fact label={t('pro.pay.amount')}>
            <Money value={minorText(payment.amountMinor)} className="font-semibold" />
          </Fact>
          <Fact label={t('pro.col.created')}>{dateTimeText(payment.createdAt)}</Fact>
          {payment.notes ? <Fact label={t('erp.form.notes')}>{payment.notes}</Fact> : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-start font-medium">{t('pro.cn.invoice')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('pro.inv.supplierNumber')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('pro.pay.allocated')}</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((allocation) => (
                <tr key={allocation.id} className="border-b border-[#30363d]/60 text-gray-200">
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => onOpenInvoice(allocation.invoiceId)} className="text-blue-300 underline">
                      <Num>SI-{allocation.invoiceNumber}</Num>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <Num>{allocation.supplierInvoiceNumber}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Money value={minorText(allocation.amountMinor)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payment.status === 'void' ? (
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#30363d] p-4">
            {payment.voidedAt ? <Fact label={t('pro.inv.voidedAt')}>{dateTimeText(payment.voidedAt)}</Fact> : null}
            {payment.voidReason ? <Fact label={t('pro.reason')}>{payment.voidReason}</Fact> : null}
          </div>
        ) : null}

        {voiding ? (
          <section className="space-y-3 rounded-xl border border-red-500/30 p-4">
            <p className="text-sm text-gray-300">{t('pro.pay.voidHint')}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('pro.inv.voidDate')}>
                <input type="date" value={voidDate} onChange={(event) => setVoidDate(event.target.value)} dir="ltr" className={inputClass} />
              </Field>
              <Field label={t('pro.reason')}>
                <input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={500} className={inputClass} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={voidPayment} disabled={pending || voidReason.trim() === ''} className={dangerButton}>
                {t('pro.pay.void')}
              </button>
              <button type="button" onClick={() => setVoiding(false)} className={secondaryButton}>
                {t('erp.cancel')}
              </button>
            </div>
          </section>
        ) : null}

        {errors.length > 0 ? (
          <ul role="alert" className={`${errorClass} list-disc space-y-1 ps-6`}>
            {errors.map((message) => (
              <li key={message}>{t(message)}</li>
            ))}
          </ul>
        ) : null}
        <FailureMessage failure={failure} onReload={() => setReloadCount((value) => value + 1)} />

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#30363d] pt-4">
          {payment.status === 'posted' && canVoid && !voiding ? (
            <button type="button" onClick={() => setVoiding(true)} className={dangerButton}>
              {t('pro.pay.void')}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={secondaryButton}>
            {t('erp.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SupplierSelect value={supplierId} onChange={setSupplierId} label={t('pro.col.supplier')} />
        <Field label={t('pro.pay.date')}>
          <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} dir="ltr" className={inputClass} />
        </Field>
        <Field label={t('pro.pay.method')}>
          <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={inputClass}>
            {paymentMethods.map((value) => (
              <option key={value} value={value}>
                {t(methodLabels[value])}
              </option>
            ))}
          </select>
        </Field>
        <AccountSelect type="asset" value={paidFromId} onChange={setPaidFromId} label={t('pro.pay.paidFrom')} />
        <Field label={t('pro.pay.reference')}>
          <input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={100} dir="ltr" className={inputClass} />
          <span className="mt-1 block text-xs text-gray-500">{t('pro.pay.referenceHint')}</span>
        </Field>
        <Field label={t('erp.form.notes')}>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} className={inputClass} />
        </Field>
      </div>

      <section aria-label={t('pro.pay.openInvoices')}>
        <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('pro.pay.openInvoices')}</h4>
        {supplierId === '' ? <p className="text-sm text-gray-400">{t('pro.pay.pickSupplier')}</p> : null}
        {supplierId !== '' && openPhase === 'loading' ? <p className="text-sm text-gray-400">{t('erp.loading')}</p> : null}
        {supplierId !== '' && openPhase === 'error' ? (
          <p role="alert" className={errorClass}>
            {t(loadError)}
          </p>
        ) : null}
        {supplierId !== '' && openPhase === 'ready' && open.length === 0 ? <p className="text-sm text-gray-400">{t('pro.pay.noOpen')}</p> : null}
        {open.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-gray-400">
                <tr className="border-b border-[#30363d]">
                  <th className="px-3 py-2 text-start font-medium">{t('pro.cn.invoice')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('pro.inv.dueDate')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('erp.form.total')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('pro.inv.balance')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('pro.pay.allocated')}</th>
                </tr>
              </thead>
              <tbody>
                {open.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-[#30363d]/60 text-gray-200">
                    <td className="px-3 py-2">
                      <Num>SI-{invoice.number}</Num> · <Num>{invoice.supplierInvoiceNumber}</Num>
                    </td>
                    <td className="px-3 py-2">
                      <Num>{invoice.dueDate}</Num>
                    </td>
                    <td className="px-3 py-2">
                      <Money value={minorText(invoice.totalMinor)} />
                    </td>
                    <td className="px-3 py-2">
                      <Money value={minorText(invoice.balanceMinor)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={allocations[invoice.id] ?? ''}
                          onChange={(event) => setAllocations((current) => ({ ...current, [invoice.id]: event.target.value }))}
                          inputMode="decimal"
                          dir="ltr"
                          aria-label={`${t('pro.pay.allocated')} — SI-${invoice.number}`}
                          className={`${inputClass} mt-0 w-32`}
                        />
                        <button
                          type="button"
                          onClick={() => setAllocations((current) => ({ ...current, [invoice.id]: minorToInput(invoice.balanceMinor) }))}
                          className="text-xs text-blue-300 underline"
                        >
                          {t('pro.pay.fullBalance')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <div className="rounded-xl border border-[#30363d] p-4">
        <Fact label={t('pro.pay.amount')}>
          <Money value={minorText(total)} className="font-semibold" />
        </Fact>
      </div>

      {errors.length > 0 ? (
        <ul role="alert" className={`${errorClass} list-disc space-y-1 ps-6`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
        </ul>
      ) : null}
      <FailureMessage failure={failure} onReload={() => setReloadCount((value) => value + 1)} />

      <div className="flex flex-wrap justify-end gap-2 border-t border-[#30363d] pt-4">
        <button type="button" onClick={submit} disabled={pending || total === 0} className={primaryButton}>
          {pending ? t('erp.loading') : t('pro.pay.confirm')}
        </button>
        <button type="button" onClick={onClose} className={secondaryButton}>
          {t('erp.cancel')}
        </button>
      </div>
    </div>
  )
}
