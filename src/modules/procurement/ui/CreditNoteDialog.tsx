'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { Badge, Num } from '@/components/ui'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import { formatDate, formatInt, formatPct, type FormatLocale } from '@/lib/format'
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
import {
  Fact,
  FailureMessage,
  Field,
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
  invoiceId?: string
  creditNoteId?: string
  onChanged: (message: MessageKey) => void
  onClose: () => void
  onOpenInvoice: (invoiceId: string) => void
}

/** Supplier credit note creation and voiding dialog. */
export function CreditNoteDialog({
  invoiceId,
  creditNoteId,
  onChanged,
  onClose,
  onOpenInvoice,
}: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
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
        const payload = await apiRequest<{ data: SupplierCreditNoteDetail }>(
          `/api/v1/procurement/credit-notes/${creditNoteId}`,
          { signal: controller.signal },
        )
        setNote(payload.data)
        return
      }
      const loadedInvoice = await apiRequest<{ data: SupplierInvoiceDetail }>(
        `/api/v1/procurement/invoices/${invoiceId}`,
        { signal: controller.signal },
      )
      const loadedOrder = await apiRequest<{ data: PurchaseOrderDetail }>(
        `/api/v1/procurement/orders/${loadedInvoice.data.orderId}`,
        { signal: controller.signal },
      )
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
      .map((line) => ({
        invoiceLineId: line.id,
        text: (quantities[line.id] ?? '').trim(),
      }))
      .filter((line) => line.text !== '' && line.text !== '0')
      .map((line) => ({
        invoiceLineId: line.invoiceLineId,
        quantity: /^\d{1,7}$/.test(line.text) ? Number(line.text) : Number.NaN,
      }))
  }, [invoice, quantities])

  const preview = useMemo(() => {
    if (!invoice) return null
    const lines = chosen
      .filter((line) => Number.isInteger(line.quantity))
      .flatMap((line) => {
        const source = invoice.lines.find((entry) => entry.id === line.invoiceLineId)
        return source
          ? [
              {
                quantity: line.quantity,
                unitPriceMinor: source.unitCostMinor,
                taxRateBps: source.taxRateBps,
              },
            ]
          : []
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
      expectedTotalMinor:
        expected.trim() === '' ? null : (parseKwdToMinor(expected) ?? Number.NaN),
      reason,
      lines: chosen,
    })
    if (!parsed.success) {
      const keys = parsed.error.issues.map((issue): MessageKey => {
        if (issue.path[0] === 'supplierCreditNoteNumber') {
          return 'pro.err.form.creditNumber'
        }
        if (issue.path[0] === 'creditDate') return 'pro.err.form.date'
        if (issue.path[0] === 'reason') return 'pro.err.form.reason'
        if (issue.path[0] === 'expectedTotalMinor') {
          return 'pro.err.form.expectedTotal'
        }
        if (issue.path[0] === 'lines' && issue.path.length > 1) {
          return 'pro.err.form.quantity'
        }
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
      const result = await apiRequest<{ data: SupplierCreditNoteDetail }>(
        '/api/v1/procurement/credit-notes',
        {
          method: 'POST',
          body: parsed.data,
          idempotencyKey: key.ref.current,
        },
      )
      key.reset()
      setNote(result.data)
      setNotice('pro.msg.creditPosted')
      onChanged('pro.msg.creditPosted')
    }, key)
  }

  function voidNote() {
    if (!note) return
    setErrors([])
    const parsed = voidCreditNoteSchema.safeParse({
      version: note.version,
      reason: voidReason,
      entryDate: voidDate,
    })
    if (!parsed.success) {
      setErrors(['pro.err.form.void'])
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: SupplierCreditNoteDetail }>(
        `/api/v1/procurement/credit-notes/${note.id}/void`,
        { method: 'POST', body: parsed.data },
      )
      setNote(result.data)
      setVoiding(false)
      setNotice('pro.msg.creditVoided')
      onChanged('pro.msg.creditVoided')
    })
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

  if (note) {
    return (
      <div className="space-y-5">
        <h4 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
          <Num className="text-emerald-700 dark:text-emerald-300">
            CN-{note.number}
          </Num>
          <Badge tone={note.status === 'posted' ? 'good' : 'neutral'}>
            {t(note.status === 'posted' ? 'pro.cstatus.posted' : 'pro.cstatus.void')}
          </Badge>
        </h4>
        {notice ? (
          <p role="status" className={proNoticeClass}>
            {t(notice)}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label={t('pro.col.supplier')}>{note.supplierName}</Fact>
          <Fact label={t('pro.cn.supplierNumber')}>
            <Num>{note.supplierCreditNoteNumber}</Num>
          </Fact>
          <Fact label={t('pro.cn.invoice')}>
            <button
              type="button"
              onClick={() => onOpenInvoice(note.invoiceId)}
              className="ds-focus-ring cursor-pointer rounded font-semibold text-emerald-700 underline dark:text-emerald-300"
            >
              <Num>SI-{note.invoiceNumber}</Num>
            </button>
          </Fact>
          <Fact label={t('pro.cn.date')}>
            <Num>{formatDate(note.creditDate, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('erp.form.subtotal')}>
            <Num>{formatMinorKwd(note.subtotalMinor, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('erp.form.taxTotal')}>
            <Num>{formatMinorKwd(note.taxMinor, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('erp.form.total')}>
            <Num className="font-semibold">
              {formatMinorKwd(note.totalMinor, fmtLocale)}
            </Num>
          </Fact>
          <Fact label={t('pro.reason')}>{note.reason}</Fact>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[24rem] text-sm">
            <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-start">{t('pro.line.no')}</th>
                <th className="px-3 py-2 text-end">{t('erp.form.quantity')}</th>
                <th className="px-3 py-2 text-end">{t('pro.line.unitCost')}</th>
                <th className="px-3 py-2 text-end">{t('erp.form.tax')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ds-border-hairline)] text-slate-800 dark:text-slate-100">
              {note.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">
                    <Num>{formatInt(line.lineNo, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.quantity, fmtLocale)}</Num>
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

        {note.status === 'void' ? (
          <div className={`${proSubtleClass} grid grid-cols-2 gap-4`}>
            {note.voidedAt ? (
              <Fact label={t('pro.inv.voidedAt')}>
                <Num>{dateTimeText(note.voidedAt, fmtLocale)}</Num>
              </Fact>
            ) : null}
            {note.voidReason ? (
              <Fact label={t('pro.reason')}>{note.voidReason}</Fact>
            ) : null}
          </div>
        ) : null}

        {voiding ? (
          <section className="space-y-3 rounded-xl border border-rose-500/35 bg-rose-50/50 p-4 dark:bg-rose-950/20">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {t('pro.cn.voidHint')}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('pro.inv.voidDate')}>
                <input
                  type="date"
                  value={voidDate}
                  onChange={(event) => setVoidDate(event.target.value)}
                  dir="ltr"
                  className={proInputClass}
                />
              </Field>
              <Field label={t('pro.reason')}>
                <input
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                  maxLength={500}
                  className={proInputClass}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={voidNote}
                disabled={pending || voidReason.trim() === ''}
                className={proDangerButton}
              >
                {t('pro.cn.void')}
              </button>
              <button
                type="button"
                onClick={() => setVoiding(false)}
                className={proSecondaryButton}
              >
                {t('erp.cancel')}
              </button>
            </div>
          </section>
        ) : null}

        {errors.length > 0 ? (
          <ul role="alert" className={`${proErrorClass} list-disc space-y-1 ps-6`}>
            {errors.map((message) => (
              <li key={message}>{t(message)}</li>
            ))}
          </ul>
        ) : null}
        <FailureMessage failure={failure} onReload={reload} />

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ds-border-hairline)] pt-4">
          {note.status === 'posted' && canVoid && !voiding ? (
            <button
              type="button"
              onClick={() => setVoiding(true)}
              className={proDangerButton}
            >
              {t('pro.cn.void')}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={proSecondaryButton}>
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
          <Num className="text-emerald-700 dark:text-emerald-300">
            SI-{invoice.number}
          </Num>{' '}
          · {invoice.supplierName}
        </Fact>
        <Field label={t('pro.cn.supplierNumber')}>
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            maxLength={60}
            dir="ltr"
            className={proInputClass}
          />
        </Field>
        <Field label={t('pro.cn.date')}>
          <input
            type="date"
            value={creditDate}
            onChange={(event) => setCreditDate(event.target.value)}
            dir="ltr"
            className={proInputClass}
          />
        </Field>
        <Field label={t('pro.reason')} className="sm:col-span-3">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            className={proInputClass}
          />
        </Field>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400">{t('pro.cn.note')}</p>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 text-start">{t('erp.form.description')}</th>
              <th className="px-3 py-2 text-end">{t('pro.cn.billed')}</th>
              <th className="px-3 py-2 text-end">{t('pro.cn.credited')}</th>
              <th className="px-3 py-2 text-end">{t('pro.cn.creditable')}</th>
              <th className="px-3 py-2 text-end">{t('pro.line.unitCost')}</th>
              <th className="px-3 py-2 text-start">{t('pro.cn.now')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ds-border-hairline)] text-slate-800 dark:text-slate-100">
            {invoice.lines.map((line) => {
              const orderLine = orderLines.get(line.orderLineId)
              const open = orderLine ? creditableQuantity(line, orderLine) : 0
              return (
                <tr key={line.id}>
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.quantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.creditedQuantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(open, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatMinorKwd(line.unitCostMinor, fmtLocale)}</Num>
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
                      aria-label={`${t('pro.cn.now')} — ${line.description}`}
                      className={`${proInputClass} mt-0 w-28`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Field label={t('pro.cn.expectedTotal')} className="max-w-xs">
        <input
          value={expected}
          onChange={(event) => setExpected(event.target.value)}
          inputMode="decimal"
          dir="ltr"
          className={proInputClass}
        />
      </Field>

      {preview ? (
        <div className={`${proSubtleClass} grid grid-cols-1 gap-4 sm:grid-cols-3`}>
          <Fact label={t('erp.form.subtotal')}>
            <Num>{formatMinorKwd(preview.subtotalMinor, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('erp.form.taxTotal')}>
            <Num>{formatMinorKwd(preview.taxMinor, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('erp.form.total')}>
            <Num className="font-semibold">
              {formatMinorKwd(preview.totalMinor, fmtLocale)}
            </Num>
          </Fact>
        </div>
      ) : null}

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
          {pending ? t('erp.loading') : t('pro.cn.confirm')}
        </button>
        <button
          type="button"
          onClick={() => onOpenInvoice(invoice.id)}
          className={proSecondaryButton}
        >
          {t('pro.cn.backToInvoice')}
        </button>
      </div>
    </div>
  )
}
