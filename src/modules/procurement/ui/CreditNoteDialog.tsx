'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { dangerButton, errorClass, inputClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Badge, Money, Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { parseKwdToMinor } from '@/lib/money'
import { computeTotals } from '@/modules/finance/client'
import {
  createCreditNoteSchema,
  creditableQuantity,
  planCreditNote,
  voidCreditNoteSchema,
  type PurchaseOrderDetail,
  type SupplierCreditNoteDetail,
  type SupplierInvoiceDetail,
} from '@/modules/procurement/client'
import { useCan } from '@/modules/procurement/ui/permissions'
import { Fact, FailureMessage, Field, dateTimeText, minorText, todayUtc, useIdempotencyKey, useRunner, type Phase } from '@/modules/procurement/ui/shared'

type Props = {
  /** Credit goods of this posted invoice. */
  invoiceId?: string
  /** Open one recorded credit note. */
  creditNoteId?: string
  onChanged: (message: MessageKey) => void
  onClose: () => void
  onOpenInvoice: (invoiceId: string) => void
}

/**
 * A supplier credit note cancels billed goods that went back. A line takes the invoice line's own price and rate. What may be
 * credited is what the invoice line still has uncredited and what is no longer held (billed, returned, not yet credited).
 */
export function CreditNoteDialog({ invoiceId, creditNoteId, onChanged, onClose, onOpenInvoice }: Props) {
  const { t } = useI18n()
  const canVoid = useCan(permissions.procurementCreditNoteVoid)
  const [invoice, setInvoice] = useState<SupplierInvoiceDetail | null>(null)
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null)
  const [note, setNote] = useState<SupplierCreditNoteDetail | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [reloadCount, setReloadCount] = useState(0)

  const [number, setNumber] = useState('')
  const [creditDate, setCreditDate] = useState(todayUtc)
  const [reason, setReason] = useState('')
  const [expected, setExpected] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [voiding, setVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidDate, setVoidDate] = useState(todayUtc)
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const key = useIdempotencyKey()
  const { pending, failure, run } = useRunner()

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    const load = async () => {
      if (creditNoteId) {
        const payload = await apiRequest<{ data: SupplierCreditNoteDetail }>(`/api/v1/procurement/credit-notes/${creditNoteId}`, { signal: controller.signal })
        setNote(payload.data)
        return
      }
      const loadedInvoice = await apiRequest<{ data: SupplierInvoiceDetail }>(`/api/v1/procurement/invoices/${invoiceId}`, { signal: controller.signal })
      const loadedOrder = await apiRequest<{ data: PurchaseOrderDetail }>(`/api/v1/procurement/orders/${loadedInvoice.data.orderId}`, { signal: controller.signal })
      setInvoice(loadedInvoice.data)
      setOrder(loadedOrder.data)
    }
    load()
      .then(() => setPhase('ready'))
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [invoiceId, creditNoteId, reloadCount])

  function reload() {
    setReloadCount((value) => value + 1)
  }

  const chosen = useMemo(() => {
    if (!invoice) return []
    return invoice.lines
      .map((line) => ({ invoiceLineId: line.id, text: (quantities[line.id] ?? '').trim() }))
      .filter((line) => line.text !== '' && line.text !== '0')
      .map((line) => ({ invoiceLineId: line.invoiceLineId, quantity: /^\d{1,7}$/.test(line.text) ? Number(line.text) : Number.NaN }))
  }, [invoice, quantities])

  /** The totals the server will compute from the invoice lines' own prices and rates. */
  const preview = useMemo(() => {
    if (!invoice) return null
    const lines = chosen
      .filter((line) => Number.isInteger(line.quantity))
      .flatMap((line) => {
        const source = invoice.lines.find((entry) => entry.id === line.invoiceLineId)
        return source ? [{ quantity: line.quantity, unitPriceMinor: source.unitCostMinor, taxRateBps: source.taxRateBps }] : []
      })
    if (lines.length === 0) return null
    try {
      return computeTotals(lines)
    } catch {
      return null
    }
  }, [invoice, chosen])

  function submit() {
    if (!invoice || !order) return
    setErrors([])
    const parsed = createCreditNoteSchema.safeParse({
      invoiceId: invoice.id,
      supplierCreditNoteNumber: number,
      creditDate,
      currency: 'KWD',
      expectedTotalMinor: expected.trim() === '' ? null : (parseKwdToMinor(expected) ?? Number.NaN),
      reason,
      lines: chosen,
    })
    if (!parsed.success) {
      const keys = parsed.error.issues.map((issue): MessageKey => {
        if (issue.path[0] === 'supplierCreditNoteNumber') return 'pro.err.form.creditNumber'
        if (issue.path[0] === 'creditDate') return 'pro.err.form.date'
        if (issue.path[0] === 'reason') return 'pro.err.form.reason'
        if (issue.path[0] === 'expectedTotalMinor') return 'pro.err.form.expectedTotal'
        if (issue.path[0] === 'lines' && issue.path.length > 1) return 'pro.err.form.quantity'
        return 'pro.err.form.creditLines'
      })
      setErrors(Array.from(new Set(keys)))
      return
    }
    try {
      planCreditNote(invoice.lines, order.lines, parsed.data.lines)
    } catch (error) {
      setErrors([errorKey(error)])
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: SupplierCreditNoteDetail }>('/api/v1/procurement/credit-notes', {
        method: 'POST',
        body: parsed.data,
        idempotencyKey: key.ref.current,
      })
      key.reset()
      setNote(result.data)
      setNotice('pro.msg.creditPosted')
      onChanged('pro.msg.creditPosted')
    }, key)
  }

  function voidNote() {
    if (!note) return
    setErrors([])
    const parsed = voidCreditNoteSchema.safeParse({ version: note.version, reason: voidReason, entryDate: voidDate })
    if (!parsed.success) {
      setErrors(['pro.err.form.void'])
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: SupplierCreditNoteDetail }>(`/api/v1/procurement/credit-notes/${note.id}/void`, {
        method: 'POST',
        body: parsed.data,
      })
      setNote(result.data)
      setVoiding(false)
      setNotice('pro.msg.creditVoided')
      onChanged('pro.msg.creditVoided')
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
          <button type="button" onClick={reload} className={secondaryButton}>
            {t('erp.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (note) {
    return (
      <div className="space-y-5">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-100">
          <Num className="text-blue-300">CN-{note.number}</Num>
          <Badge tone={note.status === 'posted' ? 'good' : 'neutral'}>{t(note.status === 'posted' ? 'pro.cstatus.posted' : 'pro.cstatus.void')}</Badge>
        </h3>
        {notice ? (
          <p role="status" className={noticeClass}>
            {t(notice)}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label={t('pro.col.supplier')}>{note.supplierName}</Fact>
          <Fact label={t('pro.cn.supplierNumber')}>
            <Num>{note.supplierCreditNoteNumber}</Num>
          </Fact>
          <Fact label={t('pro.cn.invoice')}>
            <button type="button" onClick={() => onOpenInvoice(note.invoiceId)} className="text-blue-300 underline">
              <Num>SI-{note.invoiceNumber}</Num>
            </button>
          </Fact>
          <Fact label={t('pro.cn.date')}>
            <Num>{note.creditDate}</Num>
          </Fact>
          <Fact label={t('erp.form.subtotal')}>
            <Money value={minorText(note.subtotalMinor)} />
          </Fact>
          <Fact label={t('erp.form.taxTotal')}>
            <Money value={minorText(note.taxMinor)} />
          </Fact>
          <Fact label={t('erp.form.total')}>
            <Money value={minorText(note.totalMinor)} className="font-semibold" />
          </Fact>
          <Fact label={t('pro.reason')}>{note.reason}</Fact>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-start font-medium">{t('pro.line.no')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('erp.form.quantity')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('pro.line.unitCost')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('erp.form.tax')}</th>
              </tr>
            </thead>
            <tbody>
              {note.lines.map((line) => (
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
                  <td className="px-3 py-2">
                    <Num>{(line.taxRateBps / 100).toFixed(2)}%</Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {note.status === 'void' ? (
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#30363d] p-4">
            {note.voidedAt ? <Fact label={t('pro.inv.voidedAt')}>{dateTimeText(note.voidedAt)}</Fact> : null}
            {note.voidReason ? <Fact label={t('pro.reason')}>{note.voidReason}</Fact> : null}
          </div>
        ) : null}

        {voiding ? (
          <section className="space-y-3 rounded-xl border border-red-500/30 p-4">
            <p className="text-sm text-gray-300">{t('pro.cn.voidHint')}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('pro.inv.voidDate')}>
                <input type="date" value={voidDate} onChange={(event) => setVoidDate(event.target.value)} dir="ltr" className={inputClass} />
              </Field>
              <Field label={t('pro.reason')}>
                <input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={500} className={inputClass} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={voidNote} disabled={pending || voidReason.trim() === ''} className={dangerButton}>
                {t('pro.cn.void')}
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
        <FailureMessage failure={failure} onReload={reload} />

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#30363d] pt-4">
          {note.status === 'posted' && canVoid && !voiding ? (
            <button type="button" onClick={() => setVoiding(true)} className={dangerButton}>
              {t('pro.cn.void')}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={secondaryButton}>
            {t('erp.close')}
          </button>
        </div>
      </div>
    )
  }

  if (!invoice || !order) return null

  const orderLines = new Map(order.lines.map((line) => [line.id, line]))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Fact label={t('pro.cn.invoice')}>
          <Num className="text-blue-300">SI-{invoice.number}</Num> · {invoice.supplierName}
        </Fact>
        <Field label={t('pro.cn.supplierNumber')}>
          <input value={number} onChange={(event) => setNumber(event.target.value)} maxLength={60} dir="ltr" className={inputClass} />
        </Field>
        <Field label={t('pro.cn.date')}>
          <input type="date" value={creditDate} onChange={(event) => setCreditDate(event.target.value)} dir="ltr" className={inputClass} />
        </Field>
        <Field label={t('pro.reason')} className="sm:col-span-3">
          <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className={inputClass} />
        </Field>
      </div>

      <p className="text-xs text-gray-400">{t('pro.cn.note')}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="text-gray-400">
            <tr className="border-b border-[#30363d]">
              <th className="px-3 py-2 text-start font-medium">{t('erp.form.description')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.cn.billed')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.cn.credited')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.cn.creditable')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.line.unitCost')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('pro.cn.now')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => {
              const orderLine = orderLines.get(line.orderLineId)
              const open = orderLine ? creditableQuantity(line, orderLine) : 0
              return (
                <tr key={line.id} className="border-b border-[#30363d]/60 text-gray-200">
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2">
                    <Num>{line.quantity.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Num>{line.creditedQuantity.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2">
                    <Num>{open.toLocaleString('en-US')}</Num>
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
                      aria-label={`${t('pro.cn.now')} — ${line.description}`}
                      className={`${inputClass} mt-0 w-28`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Field label={t('pro.cn.expectedTotal')} className="max-w-xs">
        <input value={expected} onChange={(event) => setExpected(event.target.value)} inputMode="decimal" dir="ltr" className={inputClass} />
      </Field>

      {preview ? (
        <div className="grid grid-cols-3 gap-4 rounded-xl border border-[#30363d] p-4">
          <Fact label={t('erp.form.subtotal')}>
            <Money value={minorText(preview.subtotalMinor)} />
          </Fact>
          <Fact label={t('erp.form.taxTotal')}>
            <Money value={minorText(preview.taxMinor)} />
          </Fact>
          <Fact label={t('erp.form.total')}>
            <Money value={minorText(preview.totalMinor)} className="font-semibold" />
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
          {pending ? t('erp.loading') : t('pro.cn.confirm')}
        </button>
        <button type="button" onClick={() => onOpenInvoice(invoice.id)} className={secondaryButton}>
          {t('pro.cn.backToInvoice')}
        </button>
      </div>
    </div>
  )
}
