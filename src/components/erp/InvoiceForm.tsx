'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest, errorKey, isAbort, newIdempotencyKey } from '@/components/erp/api'
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
import { bpsToInput, formatMinor, minorToInput, parseKwdToMinor, parsePercentToBps } from '@/lib/money'
import type { Customer } from '@/modules/crm/client'
import type { Item, Warehouse } from '@/modules/inventory/client'
import {
  computeTotals,
  createInvoiceSchema,
  requiresApproval,
  updateInvoiceSchema,
  type InvoiceDetail,
} from '@/modules/finance/client'

type LineDraft = { key: string; description: string; quantity: string; price: string; tax: string; itemId: string; warehouseId: string }

let lineCounter = 0
function emptyLine(): LineDraft {
  lineCounter += 1
  return { key: `line-${lineCounter}`, description: '', quantity: '1', price: '', tax: '0', itemId: '', warehouseId: '' }
}

function today(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

function toNumbers(line: LineDraft) {
  return {
    description: line.description,
    quantity: /^\d{1,7}$/.test(line.quantity.trim()) ? Number(line.quantity.trim()) : Number.NaN,
    unitPriceMinor: parseKwdToMinor(line.price) ?? Number.NaN,
    taxRateBps: parsePercentToBps(line.tax) ?? Number.NaN,
    itemId: line.itemId === '' ? null : line.itemId,
    warehouseId: line.warehouseId === '' ? null : line.warehouseId,
  }
}

function issueMessage(path: ReadonlyArray<PropertyKey>): MessageKey {
  const [root, , field] = path
  if (root === 'customerId') return 'erp.form.errCustomer'
  if (root === 'issueDate' || root === 'dueDate') return 'erp.form.errDates'
  if (root === 'lines' && path.length === 1) return 'erp.form.errLines'
  if (root === 'lines' && field === 'description') return 'erp.form.errDescription'
  if (root === 'lines' && field === 'quantity') return 'erp.form.errQuantity'
  if (root === 'lines' && field === 'unitPriceMinor') return 'erp.form.errPrice'
  if (root === 'lines' && field === 'taxRateBps') return 'erp.form.errTax'
  if (root === 'lines' && (field === 'itemId' || field === 'warehouseId')) return 'erp.form.errStock'
  return 'erp.form.errGeneric'
}

type Props = {
  invoice?: InvoiceDetail
  approvalThresholdMinor: number
  onSaved: (invoice: InvoiceDetail, message: MessageKey) => void
  onCancel: () => void
}

export function InvoiceForm({ invoice, approvalThresholdMinor, onSaved, onCancel }: Props) {
  const { t } = useI18n()
  const [customers, setCustomers] = useState<Customer[]>([])
  // Stock choices are optional. A user without inventory access simply sees no item or warehouse pickers.
  const [stockItems, setStockItems] = useState<Item[]>([])
  const [stockWarehouses, setStockWarehouses] = useState<Warehouse[]>([])
  const [customerId, setCustomerId] = useState(invoice?.customerId ?? '')
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? today(0))
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? today(30))
  const [notes, setNotes] = useState(invoice?.notes ?? '')
  const [lines, setLines] = useState<LineDraft[]>(() =>
    invoice
      ? invoice.lines.map((line) => {
          const draft = emptyLine()
          return {
            ...draft,
            description: line.description,
            quantity: String(line.quantity),
            price: minorToInput(line.unitPriceMinor),
            tax: bpsToInput(line.taxRateBps),
            itemId: line.itemId ?? '',
            warehouseId: line.warehouseId ?? '',
          }
        })
      : [emptyLine()]
  )
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [pending, setPending] = useState(false)
  const [newCustomer, setNewCustomer] = useState<string | null>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  // One key per form session: a double click or a retry after a lost response replays instead of duplicating.
  const idempotencyKey = useRef(newIdempotencyKey())

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ data: Customer[] }>('/api/v1/crm/customers?limit=100&sort=name&direction=asc&status=active', { signal: controller.signal })
      .then((page) => setCustomers(page.data))
      .catch((error: unknown) => {
        if (!isAbort(error)) setErrors([errorKey(error)])
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<{ data: Item[] }>('/api/v1/inventory/items?limit=100&sort=name&direction=asc&status=active', { signal: controller.signal }),
      apiRequest<{ data: Warehouse[] }>('/api/v1/inventory/warehouses?limit=100&status=active', { signal: controller.signal }),
    ])
      .then(([items, warehouses]) => {
        setStockItems(items.data)
        setStockWarehouses(warehouses.data)
      })
      .catch(() => {
        setStockItems([])
        setStockWarehouses([])
      })
    return () => controller.abort()
  }, [])

  const totals = useMemo(() => {
    try {
      return computeTotals(lines.map(toNumbers))
    } catch {
      return null
    }
  }, [lines])

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  /** Picking an item fills an empty description and price, and the only warehouse when there is just one. */
  function chooseItem(key: string, itemId: string) {
    const item = stockItems.find((candidate) => candidate.id === itemId)
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line
        if (!item) return { ...line, itemId: '', warehouseId: '' }
        return {
          ...line,
          itemId,
          description: line.description.trim() === '' ? item.name : line.description,
          price: line.price.trim() === '' ? minorToInput(item.sellingPriceMinor) : line.price,
          warehouseId: line.warehouseId !== '' ? line.warehouseId : stockWarehouses.length === 1 ? stockWarehouses[0].id : '',
        }
      })
    )
  }

  async function addCustomer() {
    if (!newCustomer || newCustomer.trim() === '') return
    setPending(true)
    setErrors([])
    try {
      const created = await apiRequest<{ data: Customer }>('/api/v1/crm/customers', {
        method: 'POST',
        body: { name: newCustomer },
      })
      setCustomers((current) => [...current, created.data].sort((a, b) => a.name.localeCompare(b.name)))
      setCustomerId(created.data.id)
      setNewCustomer(null)
      setNotice('erp.msg.customerAdded')
    } catch (error) {
      setErrors([errorKey(error)])
    } finally {
      setPending(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setNotice(null)
    const candidate = {
      customerId,
      issueDate,
      dueDate,
      notes: notes.trim() === '' ? null : notes,
      lines: lines.map(toNumbers),
    }
    const parsed = invoice
      ? updateInvoiceSchema.safeParse({ ...candidate, version: invoice.version })
      : createInvoiceSchema.safeParse(candidate)
    if (!parsed.success) {
      setErrors(Array.from(new Set(parsed.error.issues.map((issue) => issueMessage(issue.path)))))
      return
    }
    setErrors([])
    setPending(true)
    try {
      const saved = invoice
        ? await apiRequest<{ data: InvoiceDetail }>(`/api/v1/finance/invoices/${invoice.id}`, { method: 'PATCH', body: parsed.data })
        : await apiRequest<{ data: InvoiceDetail }>('/api/v1/finance/invoices', {
            method: 'POST',
            body: parsed.data,
            idempotencyKey: idempotencyKey.current,
          })
      idempotencyKey.current = newIdempotencyKey()
      onSaved(saved.data, invoice ? 'erp.msg.updated' : 'erp.msg.created')
    } catch (error) {
      setErrors([errorKey(error)])
    } finally {
      setPending(false)
    }
  }

  const needsApproval = totals !== null && requiresApproval(totals.totalMinor, approvalThresholdMinor)

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <label className={`${labelClass} flex-1`}>
              {t('erp.form.customer')}
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className={inputClass}>
                <option value="">{t('erp.form.selectCustomer')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            {newCustomer === null ? (
              <button type="button" onClick={() => setNewCustomer('')} className={secondaryButton}>
                {t('erp.form.newCustomer')}
              </button>
            ) : null}
          </div>
          {newCustomer !== null ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className={`${labelClass} min-w-[12rem] flex-1`}>
                {t('erp.form.customerName')}
                <input value={newCustomer} onChange={(event) => setNewCustomer(event.target.value)} className={inputClass} />
              </label>
              <button type="button" disabled={pending} onClick={addCustomer} className={primaryButton}>
                {t('erp.form.addCustomer')}
              </button>
              <button type="button" onClick={() => setNewCustomer(null)} className={secondaryButton}>
                {t('erp.cancel')}
              </button>
            </div>
          ) : null}
        </div>
        <label className={labelClass}>
          {t('erp.form.issueDate')}
          <input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className={inputClass} dir="ltr" />
        </label>
        <label className={labelClass}>
          {t('erp.form.dueDate')}
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} dir="ltr" />
        </label>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('erp.form.lines')}</h4>
        <div className="space-y-3">
          {lines.map((line) => (
            <div key={line.key} className="grid grid-cols-2 gap-3 rounded-xl border border-[#30363d] p-3 sm:grid-cols-12">
              <label className={`${labelClass} col-span-2 sm:col-span-5`}>
                {t('erp.form.description')}
                <input value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} className={inputClass} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                {t('erp.form.quantity')}
                <input inputMode="numeric" dir="ltr" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} className={inputClass} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                {t('erp.form.unitPrice')}
                <input inputMode="decimal" dir="ltr" value={line.price} onChange={(event) => updateLine(line.key, { price: event.target.value })} className={inputClass} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                {t('erp.form.tax')}
                <input inputMode="decimal" dir="ltr" value={line.tax} onChange={(event) => updateLine(line.key, { tax: event.target.value })} className={inputClass} />
              </label>
              {stockItems.length > 0 ? (
                <>
                  <label className={`${labelClass} col-span-2 sm:col-span-6`}>
                    {t('erp.form.item')}
                    <select value={line.itemId} onChange={(event) => chooseItem(line.key, event.target.value)} className={inputClass}>
                      <option value="">{t('erp.form.noItem')}</option>
                      {stockItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sku} · {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={`${labelClass} col-span-2 sm:col-span-6`}>
                    {t('erp.form.warehouse')}
                    <select
                      value={line.warehouseId}
                      disabled={line.itemId === ''}
                      onChange={(event) => updateLine(line.key, { warehouseId: event.target.value })}
                      className={`${inputClass} disabled:opacity-50`}
                    >
                      <option value="">{t('erp.form.selectWarehouse')}</option>
                      {stockWarehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.code} · {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <div className="col-span-2 flex items-end sm:col-span-1">
                <button
                  type="button"
                  disabled={lines.length === 1}
                  aria-label={t('erp.form.removeLine')}
                  title={t('erp.form.removeLine')}
                  onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  className={`${dangerButton} w-full px-2`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={lines.length >= 200}
          onClick={() => setLines((current) => [...current, emptyLine()])}
          className={`${secondaryButton} mt-3`}
        >
          {t('erp.form.addLine')}
        </button>
      </div>

      {lines.some((line) => line.itemId !== '') ? <p className="text-xs text-gray-400">{t('erp.form.stockNote')}</p> : null}

      <label className={`${labelClass} block`}>
        {t('erp.form.notes')}
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={2000} className={inputClass} />
      </label>

      <dl className="space-y-1.5 rounded-xl border border-[#30363d] bg-[#0d1117] p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-gray-400">{t('erp.form.subtotal')}</dt>
          <dd>{totals ? <Money value={formatMinor(totals.subtotalMinor)} /> : <Num>—</Num>}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-gray-400">{t('erp.form.taxTotal')}</dt>
          <dd>{totals ? <Money value={formatMinor(totals.taxMinor)} /> : <Num>—</Num>}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[#30363d] pt-2 font-semibold text-gray-100">
          <dt>{t('erp.form.total')}</dt>
          <dd>{totals ? <Money value={formatMinor(totals.totalMinor)} /> : <Num>—</Num>}</dd>
        </div>
      </dl>

      {needsApproval ? (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
          {t('erp.form.approvalNote')} {t('erp.form.threshold')}: <Money value={formatMinor(approvalThresholdMinor)} />
        </p>
      ) : null}

      {errors.length > 0 ? (
        <ul role="alert" className={`${errorClass} space-y-1`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
        </ul>
      ) : null}
      {notice ? <p className={noticeClass}>{t(notice)}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? t('erp.working') : invoice ? t('erp.save') : t('erp.create')}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t('erp.cancel')}
        </button>
      </div>
    </form>
  )
}
