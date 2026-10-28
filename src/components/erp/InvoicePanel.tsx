'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest, errorDetail, errorKey, isAbort, newIdempotencyKey } from '@/components/erp/api'
import { InvoiceForm } from '@/components/erp/InvoiceForm'
import { StatusBadge } from '@/components/erp/StatusBadge'
import {
  dangerButton,
  errorClass,
  inputClass,
  labelClass,
  noticeClass,
  primaryButton,
  secondaryButton,
} from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor, parseKwdToMinor } from '@/lib/money'
import {
  paymentMethods,
  recordPaymentSchema,
  voidInvoiceSchema,
  type InvoiceDetail,
  type PaymentMethod,
} from '@/modules/finance/client'

type Mode = 'view' | 'edit' | 'pay' | 'void'

type Props = {
  invoiceId: string
  approvalThresholdMinor: number
  onChanged: () => void
  onClose: () => void
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

export function InvoicePanel({ invoiceId, approvalThresholdMinor, onChanged, onClose }: Props) {
  const { t } = useI18n()
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [loadError, setLoadError] = useState<MessageKey | null>(null)
  const [mode, setMode] = useState<Mode>('view')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [errorExtra, setErrorExtra] = useState<string | null>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const paymentKey = useRef(newIdempotencyKey())

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoadError(null)
      apiRequest<{ data: InvoiceDetail }>(`/api/v1/finance/invoices/${invoiceId}`, { signal })
        .then((result) => setInvoice(result.data))
        .catch((failure: unknown) => {
          if (!isAbort(failure)) setLoadError(errorKey(failure))
        })
    },
    [invoiceId]
  )

  useEffect(() => {
    const controller = new AbortController()
    setInvoice(null)
    setMode('view')
    setError(null)
    setNotice(null)
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  function applied(next: InvoiceDetail, message: MessageKey) {
    setInvoice(next)
    setMode('view')
    setError(null)
    setNotice(message)
    onChanged()
  }

  async function run(action: () => Promise<{ data: InvoiceDetail } | null>, message: MessageKey) {
    setPending(true)
    setError(null)
    setErrorExtra(null)
    setNotice(null)
    try {
      const result = await action()
      if (result) applied(result.data, message)
    } catch (failure) {
      setError(errorKey(failure))
      setErrorExtra(errorDetail(failure))
      if (failure instanceof ApiError && failure.code === 'version_conflict') load()
    } finally {
      setPending(false)
    }
  }

  function post(path: string, body: unknown) {
    return apiRequest<{ data: InvoiceDetail }>(`/api/v1/finance/invoices/${invoiceId}/${path}`, { method: 'POST', body })
  }

  function onPay(event: FormEvent) {
    event.preventDefault()
    if (!invoice) return
    setNotice(null)
    const amountMinor = parseKwdToMinor(amount)
    if (amountMinor === null || amountMinor < 1 || amountMinor > invoice.totalMinor - invoice.paidMinor) {
      setError('erp.pay.errAmount')
      return
    }
    const parsed = recordPaymentSchema.safeParse({
      version: invoice.version,
      amountMinor,
      currency: 'KWD',
      method,
      paidAt: paidOn ? `${paidOn}T12:00:00.000Z` : '',
      reference: reference.trim() === '' ? null : reference,
    })
    if (!parsed.success) {
      setError(parsed.error.issues.some((issue) => issue.path[0] === 'paidAt') ? 'erp.pay.errDate' : 'erp.pay.errAmount')
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: { invoice: InvoiceDetail } }>(`/api/v1/finance/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: parsed.data,
        idempotencyKey: paymentKey.current,
      })
      paymentKey.current = newIdempotencyKey()
      setAmount('')
      setReference('')
      return { data: result.data.invoice }
    }, 'erp.msg.paid')
  }

  function onVoid(event: FormEvent) {
    event.preventDefault()
    if (!invoice) return
    const parsed = voidInvoiceSchema.safeParse({ version: invoice.version, reason })
    if (!parsed.success) {
      setNotice(null)
      setError('erp.void.errReason')
      return
    }
    void run(() => post('void', parsed.data), 'erp.msg.voided')
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p role="alert" className={errorClass}>
          {t(loadError)}
        </p>
        <button type="button" onClick={() => load()} className={secondaryButton}>
          {t('erp.retry')}
        </button>
      </div>
    )
  }
  if (!invoice) return <p className="text-sm text-gray-400">{t('erp.loading')}</p>

  if (mode === 'edit') {
    return (
      <InvoiceForm
        invoice={invoice}
        approvalThresholdMinor={approvalThresholdMinor}
        onSaved={applied}
        onCancel={() => setMode('view')}
      />
    )
  }

  const balance = invoice.totalMinor - invoice.paidMinor
  const canPay = invoice.status === 'issued' || invoice.status === 'partially_paid'
  const canVoid = invoice.status === 'draft' || invoice.status === 'pending_approval' || invoice.status === 'issued'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-gray-100">
            <Num>{invoice.number}</Num>
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {t('erp.detail.customer')}: <span className="text-gray-200">{invoice.customerName}</span>
          </p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-gray-400">{t('erp.detail.issueDate')}</dt>
          <dd><Num>{invoice.issueDate}</Num></dd>
        </div>
        <div>
          <dt className="text-gray-400">{t('erp.col.due')}</dt>
          <dd><Num>{invoice.dueDate}</Num></dd>
        </div>
        <div>
          <dt className="text-gray-400">{t('erp.col.total')}</dt>
          <dd><Money value={formatMinor(invoice.totalMinor)} /></dd>
        </div>
        <div>
          <dt className="text-gray-400">{t('erp.detail.balance')}</dt>
          <dd><Money value={formatMinor(balance)} /></dd>
        </div>
        {invoice.approvedAt ? (
          <div>
            <dt className="text-gray-400">{t('erp.detail.approvedAt')}</dt>
            <dd><Num>{dateOnly(invoice.approvedAt)}</Num></dd>
          </div>
        ) : null}
        {invoice.voidReason ? (
          <div className="col-span-2">
            <dt className="text-gray-400">{t('erp.detail.voidReason')}</dt>
            <dd className="text-gray-200">{invoice.voidReason}</dd>
          </div>
        ) : null}
      </dl>

      {invoice.notes ? <p className="text-sm text-gray-300">{invoice.notes}</p> : null}
      {invoice.status === 'pending_approval' ? (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">{t('erp.detail.awaiting')}</p>
      ) : null}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('erp.detail.lines')}</h4>
        <div className="overflow-x-auto rounded-xl border border-[#30363d]">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="bg-white/[0.03] text-gray-400">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t('erp.form.description')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('erp.form.quantity')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('erp.form.unitPrice')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('erp.form.tax')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('erp.col.total')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-t border-[#30363d] text-gray-200">
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2"><Num>{line.quantity}</Num></td>
                  <td className="px-3 py-2"><Num>{formatMinor(line.unitPriceMinor)}</Num></td>
                  <td className="px-3 py-2"><Num>{`${line.taxRateBps / 100}%`}</Num></td>
                  <td className="px-3 py-2"><Num>{formatMinor(line.lineNetMinor)}</Num></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-400">{t('erp.form.subtotal')}</dt>
            <dd><Money value={formatMinor(invoice.subtotalMinor)} /></dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-400">{t('erp.form.taxTotal')}</dt>
            <dd><Money value={formatMinor(invoice.taxMinor)} /></dd>
          </div>
          <div className="flex justify-between gap-3 font-semibold text-gray-100">
            <dt>{t('erp.form.total')}</dt>
            <dd><Money value={formatMinor(invoice.totalMinor)} /></dd>
          </div>
        </dl>
      </div>

      {invoice.cogsEntryId ? (
        <p className="text-sm text-gray-300">
          {t('erp.detail.cogs')}{' '}
          <Link href="/erp/ledger" className="text-[#d4a574] underline">
            {t('erp.detail.cogsOpen')}
          </Link>
        </p>
      ) : null}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('erp.detail.payments')}</h4>
        {invoice.payments.length === 0 ? (
          <p className="text-sm text-gray-400">{t('erp.detail.noPayments')}</p>
        ) : (
          <ul className="space-y-2">
            {invoice.payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#30363d] px-3 py-2 text-sm">
                <span className="text-gray-300">
                  <Num>{dateOnly(payment.paidAt)}</Num> · {t(`erp.method.${payment.method}`)}
                  {payment.reference ? ` · ${payment.reference}` : ''}
                </span>
                <Money value={formatMinor(payment.amountMinor)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p role="alert" className={errorClass}>
          {t(error)}
          {errorExtra ? (
            <span dir="ltr" className="mt-1 block text-start text-xs text-red-200">
              {errorExtra}
            </span>
          ) : null}
        </p>
      ) : null}
      {notice ? <p className={noticeClass}>{t(notice)}</p> : null}

      {mode === 'pay' ? (
        <form onSubmit={onPay} noValidate className="space-y-3 rounded-xl border border-[#30363d] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              {t('erp.pay.amount')}
              <input inputMode="decimal" dir="ltr" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t('erp.pay.method')}
              <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={inputClass}>
                {paymentMethods.map((item) => (
                  <option key={item} value={item}>
                    {t(`erp.method.${item}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {t('erp.pay.paidAt')}
              <input type="date" dir="ltr" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t('erp.pay.reference')}
              <input value={reference} maxLength={200} onChange={(event) => setReference(event.target.value)} className={inputClass} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={primaryButton}>
              {pending ? t('erp.working') : t('erp.recordPayment')}
            </button>
            <button type="button" onClick={() => setMode('view')} className={secondaryButton}>
              {t('erp.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {mode === 'void' ? (
        <form onSubmit={onVoid} noValidate className="space-y-3 rounded-xl border border-red-500/30 p-4">
          <label className={`${labelClass} block`}>
            {t('erp.void.reason')}
            <textarea value={reason} rows={2} maxLength={500} onChange={(event) => setReason(event.target.value)} className={inputClass} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={dangerButton}>
              {pending ? t('erp.working') : t('erp.void')}
            </button>
            <button type="button" onClick={() => setMode('view')} className={secondaryButton}>
              {t('erp.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {mode === 'view' ? (
        <div className="flex flex-wrap gap-2">
          {invoice.status === 'draft' ? (
            <>
              <button type="button" onClick={() => setMode('edit')} className={secondaryButton}>
                {t('erp.edit')}
              </button>
              <button type="button" disabled={pending} onClick={() => void run(() => post('submit', { version: invoice.version }), 'erp.msg.submitted')} className={primaryButton}>
                {t('erp.submit')}
              </button>
            </>
          ) : null}
          {invoice.status === 'pending_approval' ? (
            <button type="button" disabled={pending} onClick={() => void run(() => post('approve', { version: invoice.version }), 'erp.msg.approved')} className={primaryButton}>
              {t('erp.approve')}
            </button>
          ) : null}
          {canPay ? (
            <button type="button" onClick={() => setMode('pay')} className={primaryButton}>
              {t('erp.recordPayment')}
            </button>
          ) : null}
          {canVoid ? (
            <button type="button" onClick={() => setMode('void')} className={dangerButton}>
              {t('erp.void')}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={secondaryButton}>
            {t('erp.close')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
