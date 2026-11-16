'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { useDebounced } from '@/components/erp/common'
import { Badge, Num } from '@/components/ui'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import { formatDate, formatInt, formatPct, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { bpsToInput, minorToInput, parseKwdToMinor, parsePercentToBps } from '@/lib/money'
import { computeTotals } from '@/modules/finance/client'
import {
  canVoidInvoice,
  createSupplierInvoiceSchema,
  invoiceableQuantity,
  planInvoice,
  voidSupplierInvoiceSchema,
  type MatchIssueCode,
  type MatchResult,
  type MatchStatus,
  type PurchaseOrderDetail,
  type SupplierInvoiceDetail,
  type SupplierPaymentStatus,
} from '@/modules/procurement/client'
import { useCan } from '@/modules/procurement/ui/permissions'
import {
  Fact,
  FailureMessage,
  Field,
  InvoiceStatusBadge,
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
  orderId?: string
  onChanged: (message: MessageKey) => void
  onClose: () => void
  onBack: (orderId: string) => void
  onPay: (start: { supplierId: string; invoiceId: string }) => void
  onCredit: (invoiceId: string) => void
}

const matchLabels: Record<MatchStatus, MessageKey> = {
  matched: 'pro.match.matched',
  within_tolerance: 'pro.match.within_tolerance',
  blocked: 'pro.match.blocked',
}
const matchTones: Record<MatchStatus, 'good' | 'warn' | 'bad'> = {
  matched: 'good',
  within_tolerance: 'warn',
  blocked: 'bad',
}

const issueLabels: Record<MatchIssueCode, MessageKey> = {
  over_invoice: 'pro.err.over_invoice',
  price_variance_exceeded: 'pro.err.price_variance_exceeded',
  tax_variance_exceeded: 'pro.err.tax_variance_exceeded',
  order_line_not_found: 'pro.err.not_found',
  duplicate_invoice_line: 'pro.err.duplicate_line',
  invalid_quantity: 'pro.err.form.quantity',
  invalid_price: 'pro.err.invalid_price',
}

const paymentLabels: Record<SupplierPaymentStatus, MessageKey> = {
  unpaid: 'pro.paystate.unpaid',
  partially_paid: 'pro.paystate.partially_paid',
  paid: 'pro.paystate.paid',
  credited: 'pro.paystate.credited',
}
const paymentTones: Record<
  SupplierPaymentStatus,
  'warn' | 'info' | 'good' | 'neutral'
> = {
  unpaid: 'warn',
  partially_paid: 'info',
  paid: 'good',
  credited: 'neutral',
}

/** Supplier invoice booking and three-way match dialog. */
export function InvoiceDialog({
  invoiceId,
  orderId,
  onChanged,
  onClose,
  onBack,
  onPay,
  onCredit,
}: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const canCreate = useCan(permissions.procurementInvoiceCreate)
  const canVoid = useCan(permissions.procurementInvoiceVoid)
  const canPay = useCan(permissions.procurementPaymentCreate)
  const canCredit = useCan(permissions.procurementCreditNoteCreate)
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [rates, setRates] = useState<Record<string, string>>({})
  const [match, setMatch] = useState<MatchResult | null>(null)
  const [matchFailed, setMatchFailed] = useState<MessageKey | null>(null)
  const [invoice, setInvoice] = useState<SupplierInvoiceDetail | null>(null)
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [reloadCount, setReloadCount] = useState(0)

  const [number, setNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayUtc)
  const [expected, setExpected] = useState('')
  const [notes, setNotes] = useState('')
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
    const load = invoiceId
      ? apiRequest<{ data: SupplierInvoiceDetail }>(
          `/api/v1/procurement/invoices/${invoiceId}`,
          { signal: controller.signal },
        ).then((payload) => {
          setInvoice(payload.data)
        })
      : apiRequest<{ data: PurchaseOrderDetail }>(
          `/api/v1/procurement/orders/${orderId}`,
          { signal: controller.signal },
        ).then((payload) => {
          setOrder(payload.data)
          setQuantities(
            Object.fromEntries(
              payload.data.lines.map((line) => [
                line.id,
                String(invoiceableQuantity(line)),
              ]),
            ),
          )
          setPrices(
            Object.fromEntries(
              payload.data.lines.map((line) => [
                line.id,
                minorToInput(line.unitCostMinor),
              ]),
            ),
          )
          setRates(
            Object.fromEntries(
              payload.data.lines.map((line) => [
                line.id,
                bpsToInput(line.taxRateBps),
              ]),
            ),
          )
        })
    load
      .then(() => setPhase('ready'))
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [invoiceId, orderId, reloadCount])

  function reload() {
    setReloadCount((value) => value + 1)
  }

  const chosen = useMemo(() => {
    if (!order) return []
    return order.lines
      .map((line) => ({
        line,
        text: (quantities[line.id] ?? '').trim(),
      }))
      .filter((entry) => entry.text !== '' && entry.text !== '0')
      .map(({ line, text }) => {
        const price = parseKwdToMinor(prices[line.id] ?? '')
        const rate = parsePercentToBps(rates[line.id] ?? '')
        return {
          orderLineId: line.id,
          quantity: /^\d{1,7}$/.test(text) ? Number(text) : Number.NaN,
          unitCostMinor:
            price === null
              ? Number.NaN
              : price === line.unitCostMinor
                ? null
                : price,
          taxRateBps:
            rate === null ? Number.NaN : rate === line.taxRateBps ? null : rate,
        }
      })
  }, [order, quantities, prices, rates])

  const preview = useMemo(() => {
    if (!order) return null
    const lines = chosen.flatMap((entry) => {
      const source = order.lines.find((line) => line.id === entry.orderLineId)
      if (!source || !Number.isInteger(entry.quantity) || entry.quantity < 1) return []
      const price = entry.unitCostMinor === null ? source.unitCostMinor : entry.unitCostMinor
      const rate = entry.taxRateBps === null ? source.taxRateBps : entry.taxRateBps
      return Number.isInteger(price) && Number.isInteger(rate)
        ? [{ quantity: entry.quantity, unitPriceMinor: price, taxRateBps: rate }]
        : []
    })
    if (lines.length === 0) return null
    try {
      return computeTotals(lines)
    } catch {
      return null
    }
  }, [order, chosen])

  const matchBody = useMemo(() => {
    if (!order || !canCreate || chosen.length === 0) return null
    const parsed = createSupplierInvoiceSchema.safeParse({
      orderId: order.id,
      supplierInvoiceNumber: 'preview',
      invoiceDate: todayUtc(),
      currency: 'KWD',
      lines: chosen,
    })
    return parsed.success ? JSON.stringify(parsed.data) : null
  }, [order, canCreate, chosen])
  const settledMatchBody = useDebounced(matchBody, 400)

  useEffect(() => {
    if (!settledMatchBody) {
      setMatch(null)
      setMatchFailed(null)
      return
    }
    const controller = new AbortController()
    apiRequest<{ data: MatchResult }>('/api/v1/procurement/invoices/match', {
      method: 'POST',
      body: JSON.parse(settledMatchBody) as unknown,
      signal: controller.signal,
    })
      .then((payload) => {
        setMatch(payload.data)
        setMatchFailed(null)
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setMatch(null)
        setMatchFailed(errorKey(error))
      })
    return () => controller.abort()
  }, [settledMatchBody])

  function book() {
    if (!order) return
    setErrors([])
    const lines = chosen
    const parsed = createSupplierInvoiceSchema.safeParse({
      orderId: order.id,
      supplierInvoiceNumber: number,
      invoiceDate,
      currency: 'KWD',
      expectedTotalMinor:
        expected.trim() === '' ? null : (parseKwdToMinor(expected) ?? Number.NaN),
      notes: notes.trim() === '' ? null : notes,
      lines,
    })
    if (!parsed.success) {
      const keys = parsed.error.issues.map((issue): MessageKey => {
        if (issue.path[0] === 'supplierInvoiceNumber') {
          return 'pro.err.form.invoiceNumber'
        }
        if (issue.path[0] === 'invoiceDate') return 'pro.err.form.date'
        if (issue.path[0] === 'expectedTotalMinor') {
          return 'pro.err.form.expectedTotal'
        }
        if (issue.path[0] === 'lines' && issue.path.length > 1) {
          return issue.path[2] === 'quantity'
            ? 'pro.err.form.quantity'
            : 'pro.err.form.billedPrice'
        }
        return 'pro.err.form.invoiceLines'
      })
      setErrors(Array.from(new Set(keys)))
      return
    }
    try {
      planInvoice(order.lines, parsed.data.lines)
    } catch (error) {
      setErrors([errorKey(error)])
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: SupplierInvoiceDetail }>(
        '/api/v1/procurement/invoices',
        {
          method: 'POST',
          body: parsed.data,
          idempotencyKey: key.ref.current,
        },
      )
      key.reset()
      setInvoice(result.data)
      setNotice('pro.msg.invoicePosted')
      onChanged('pro.msg.invoicePosted')
    }, key)
  }

  function voidInvoice() {
    if (!invoice) return
    setErrors([])
    const parsed = voidSupplierInvoiceSchema.safeParse({
      version: invoice.version,
      reason: voidReason,
      entryDate: voidDate,
    })
    if (!parsed.success) {
      setErrors(['pro.err.form.void'])
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: SupplierInvoiceDetail }>(
        `/api/v1/procurement/invoices/${invoice.id}/void`,
        { method: 'POST', body: parsed.data },
      )
      setInvoice(result.data)
      setVoiding(false)
      setNotice('pro.msg.invoiceVoided')
      onChanged('pro.msg.invoiceVoided')
    })
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

  if (invoice) {
    return (
      <div className="space-y-5">
        <h4 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
          <Num className="text-emerald-700 dark:text-emerald-300">
            SI-{invoice.number}
          </Num>
          <InvoiceStatusBadge status={invoice.status} />
        </h4>
        {notice ? (
          <p role="status" className={proNoticeClass}>
            {t(notice)}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label={t('pro.col.supplier')}>{invoice.supplierName}</Fact>
          <Fact label={t('pro.inv.supplierNumber')}>
            <Num>{invoice.supplierInvoiceNumber}</Num>
          </Fact>
          <Fact label={t('pro.rcv.order')}>
            <button
              type="button"
              onClick={() => onBack(invoice.orderId)}
              className="ds-focus-ring cursor-pointer rounded font-semibold text-emerald-700 underline dark:text-emerald-300"
            >
              <Num>PO-{invoice.orderNumber}</Num>
            </button>
          </Fact>
          <Fact label={t('pro.inv.date')}>
            <Num>{formatDate(invoice.invoiceDate, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('pro.inv.dueDate')}>
            <Num>{formatDate(invoice.dueDate, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('erp.form.subtotal')}>
            <Num>{formatMinorKwd(invoice.subtotalMinor, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('erp.form.taxTotal')}>
            <Num>{formatMinorKwd(invoice.taxMinor, fmtLocale)}</Num>
          </Fact>
          <Fact label={t('erp.form.total')}>
            <Num className="font-semibold">
              {formatMinorKwd(invoice.totalMinor, fmtLocale)}
            </Num>
          </Fact>
        </div>

        {invoice.status === 'posted' ? (
          <section
            aria-label={t('pro.inv.settlement')}
            className={`${proSubtleClass} space-y-3`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('pro.inv.settlement')}
              </h4>
              <Badge tone={paymentTones[invoice.paymentStatus]}>
                {t(paymentLabels[invoice.paymentStatus])}
              </Badge>
              <Badge tone="info">
                {t(
                  invoice.accountingBasis === 'receipt_basis'
                    ? 'pro.acct.basis.receipt'
                    : 'pro.acct.basis.invoice',
                )}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Fact label={t('pro.inv.paid')}>
                <Num>{formatMinorKwd(invoice.paidMinor, fmtLocale)}</Num>
              </Fact>
              <Fact label={t('pro.inv.credited')}>
                <Num>{formatMinorKwd(invoice.creditedMinor, fmtLocale)}</Num>
              </Fact>
              <Fact label={t('pro.inv.balance')}>
                <Num className="font-semibold">
                  {formatMinorKwd(invoice.balanceMinor, fmtLocale)}
                </Num>
              </Fact>
              <Fact label={t('pro.inv.priceVariance')}>
                <Num>{formatMinorKwd(invoice.priceVarianceMinor, fmtLocale)}</Num>
              </Fact>
              <Fact label={t('pro.inv.taxVariance')}>
                <Num>{formatMinorKwd(invoice.taxVarianceMinor, fmtLocale)}</Num>
              </Fact>
            </div>
          </section>
        ) : null}

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-start">{t('erp.form.description')}</th>
                <th className="px-3 py-2 text-end">{t('erp.form.quantity')}</th>
                <th className="px-3 py-2 text-end">{t('pro.inv.poPrice')}</th>
                <th className="px-3 py-2 text-end">{t('pro.inv.billedPrice')}</th>
                <th className="px-3 py-2 text-end">{t('erp.form.tax')}</th>
                <th className="px-3 py-2 text-end">{t('pro.cn.credited')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ds-border-hairline)] text-slate-800 dark:text-slate-100">
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.quantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatMinorKwd(line.poUnitCostMinor, fmtLocale)}</Num>
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
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.creditedQuantity, fmtLocale)}</Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('pro.inv.ledger')}{' '}
          {invoice.journalEntryId ? (
            <Link
              href={`/erp/ledger?entry=${invoice.journalEntryId}`}
              className="font-semibold text-emerald-700 underline dark:text-emerald-300"
            >
              {t('pro.inv.openLedger')}
            </Link>
          ) : (
            <Link
              href="/erp/finance"
              className="font-semibold text-emerald-700 underline dark:text-emerald-300"
            >
              {t('pro.inv.openFinance')}
            </Link>
          )}
        </p>

        {invoice.status === 'void' ? (
          <div className={`${proSubtleClass} grid grid-cols-2 gap-4`}>
            {invoice.voidedAt ? (
              <Fact label={t('pro.inv.voidedAt')}>
                <Num>{dateTimeText(invoice.voidedAt, fmtLocale)}</Num>
              </Fact>
            ) : null}
            {invoice.voidReason ? (
              <Fact label={t('pro.reason')}>{invoice.voidReason}</Fact>
            ) : null}
          </div>
        ) : null}

        {voiding ? (
          <section className="space-y-3 rounded-xl border border-rose-500/35 bg-rose-50/50 p-4 dark:bg-rose-950/20">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {t('pro.inv.voidHint')}
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
                onClick={voidInvoice}
                disabled={pending || voidReason.trim() === ''}
                className={proDangerButton}
              >
                {t('pro.inv.void')}
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
          {invoice.status === 'posted' && invoice.balanceMinor > 0 && canPay ? (
            <button
              type="button"
              onClick={() =>
                onPay({ supplierId: invoice.supplierId, invoiceId: invoice.id })
              }
              className={proPrimaryButton}
            >
              {t('pro.inv.pay')}
            </button>
          ) : null}
          {invoice.status === 'posted' && canCredit ? (
            <button
              type="button"
              onClick={() => onCredit(invoice.id)}
              className={proSecondaryButton}
            >
              {t('pro.inv.credit')}
            </button>
          ) : null}
          {canVoidInvoice(invoice.status) && canVoid && !voiding ? (
            <button
              type="button"
              onClick={() => setVoiding(true)}
              disabled={invoice.paidMinor > 0 || invoice.creditedMinor > 0}
              title={
                invoice.paidMinor > 0 || invoice.creditedMinor > 0
                  ? t('pro.inv.voidBlocked')
                  : undefined
              }
              className={proDangerButton}
            >
              {t('pro.inv.void')}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={proSecondaryButton}>
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
          <Num className="text-emerald-700 dark:text-emerald-300">
            PO-{order.number}
          </Num>{' '}
          · {order.supplierName}
        </Fact>
        <Field label={t('pro.inv.supplierNumber')}>
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            maxLength={60}
            dir="ltr"
            className={proInputClass}
          />
        </Field>
        <Field label={t('pro.inv.date')}>
          <input
            type="date"
            value={invoiceDate}
            onChange={(event) => setInvoiceDate(event.target.value)}
            dir="ltr"
            className={proInputClass}
          />
        </Field>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400">
        {t('pro.inv.priceNote')}
      </p>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 text-start">{t('erp.form.description')}</th>
              <th className="px-3 py-2 text-end">{t('pro.ord.received')}</th>
              <th className="px-3 py-2 text-end">{t('pro.ord.invoiced')}</th>
              <th className="px-3 py-2 text-end">{t('pro.inv.poPrice')}</th>
              <th className="px-3 py-2 text-start">{t('pro.inv.billNow')}</th>
              <th className="px-3 py-2 text-start">{t('pro.inv.billedPrice')}</th>
              <th className="px-3 py-2 text-start">{t('erp.form.tax')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ds-border-hairline)] text-slate-800 dark:text-slate-100">
            {order.lines.map((line) => {
              const open = invoiceableQuantity(line)
              return (
                <tr key={line.id}>
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.receivedQuantity, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Num>{formatInt(line.invoicedQuantity, fmtLocale)}</Num>
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
                      aria-label={`${t('pro.inv.billNow')} — ${line.description}`}
                      className={`${proInputClass} mt-0 w-24`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={prices[line.id] ?? ''}
                      onChange={(event) =>
                        setPrices((current) => ({
                          ...current,
                          [line.id]: event.target.value,
                        }))
                      }
                      disabled={open === 0}
                      inputMode="decimal"
                      dir="ltr"
                      aria-label={`${t('pro.inv.billedPrice')} — ${line.description}`}
                      className={`${proInputClass} mt-0 w-28`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={rates[line.id] ?? ''}
                      onChange={(event) =>
                        setRates((current) => ({
                          ...current,
                          [line.id]: event.target.value,
                        }))
                      }
                      disabled={open === 0}
                      inputMode="decimal"
                      dir="ltr"
                      aria-label={`${t('erp.form.tax')} — ${line.description}`}
                      className={`${proInputClass} mt-0 w-20`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('pro.inv.expectedTotal')}>
          <input
            value={expected}
            onChange={(event) => setExpected(event.target.value)}
            inputMode="decimal"
            dir="ltr"
            className={proInputClass}
          />
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
            {t('pro.inv.expectedHint')}
          </span>
        </Field>
        <Field label={t('erp.form.notes')}>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            rows={2}
            className={proInputClass}
          />
        </Field>
      </div>

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

      {match ? (
        <section aria-label={t('pro.match.title')} className={`${proSubtleClass} space-y-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('pro.match.title')}
            </h4>
            <Badge tone={matchTones[match.status]}>{t(matchLabels[match.status])}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact label={t('pro.match.poNet')}>
              <Num>{formatMinorKwd(match.poNetMinor, fmtLocale)}</Num>
            </Fact>
            <Fact label={t('pro.match.billedNet')}>
              <Num>{formatMinorKwd(match.subtotalMinor, fmtLocale)}</Num>
            </Fact>
            <Fact label={t('pro.inv.priceVariance')}>
              <Num>{formatMinorKwd(match.priceVarianceMinor, fmtLocale)}</Num>
            </Fact>
            <Fact label={t('pro.inv.taxVariance')}>
              <Num>{formatMinorKwd(match.taxVarianceMinor, fmtLocale)}</Num>
            </Fact>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('pro.match.tolerance')}{' '}
            <Num>
              {formatPct(match.priceToleranceBps / 100, {
                locale: fmtLocale,
                decimals: 2,
              })}
            </Num>{' '}
            · <Num>{formatMinorKwd(match.taxToleranceMinor, fmtLocale)}</Num>
          </p>
          {match.issues.length > 0 ? (
            <ul role="alert" className={`${proErrorClass} list-disc space-y-1 ps-6`}>
              {match.issues.map((issue, index) => (
                <li key={`${issue.code}-${issue.orderLineId ?? index}`}>
                  {t(issueLabels[issue.code])}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {matchFailed ? (
        <p role="alert" className={proErrorClass}>
          {t(matchFailed)}
        </p>
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
          onClick={book}
          disabled={pending || !canCreate || match?.status === 'blocked'}
          className={proPrimaryButton}
        >
          {pending ? t('erp.loading') : t('pro.inv.book')}
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
