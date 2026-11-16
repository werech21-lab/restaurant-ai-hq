'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, apiRequest, errorDetail, errorKey, isAbort, newIdempotencyKey } from '@/components/erp/api'
import type { ListPage, Phase } from '@/components/erp/common'
import { Num, StateBlock } from '@/components/ui'
import { UNAVAILABLE_DASH, formatInt, getUnavailableTooltip } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { bpsToInput, minorToInput, parseKwdToMinor, parsePercentToBps } from '@/lib/money'
import {
  addDays,
  createQuotationSchema,
  isPastValidity,
  updateQuotationSchema,
  type ConversionResult,
  type CustomerRef,
  type Lead,
  type QuotationDetail,
} from '@/modules/crm/client'
import { CustomerPicker } from '@/modules/crm/ui/CustomerPicker'
import { ItemPicker } from '@/modules/crm/ui/ItemPicker'
import {
  CrmMoney,
  CrmPill,
  QuotationStatusBadge,
  crmDangerBtn,
  crmErrorClass,
  crmInputClass,
  crmLabelClass,
  crmNoticeClass,
  crmPrimaryBtn,
  crmSecondaryBtn,
  crmSubcardClass,
  stageLabels,
  todayUtc,
} from '@/modules/crm/ui/shared'
import { computeTotals, requiresApproval } from '@/modules/finance/client'
import type { InvoiceSummary } from '@/modules/finance/client'
import type { Item, StockBalance, Warehouse } from '@/modules/inventory/client'

type LineKind = 'item' | 'service'

type LineDraft = {
  key: string
  kind: LineKind
  itemId: string
  sku: string
  description: string
  quantity: string
  price: string
  tax: string
  warehouseId: string
}

type Failure = { key: MessageKey; detail: string | null; conflict: boolean }

type Props = {
  quotationId?: string
  initialCustomer?: CustomerRef | null
  initialLeadId?: string | null
  onChanged: (message: MessageKey) => void
  onClose: () => void
}

let lineCounter = 0

function emptyLine(kind: LineKind): LineDraft {
  lineCounter += 1
  return { key: `ql-${lineCounter}`, kind, itemId: '', sku: '', description: '', quantity: '1', price: '', tax: '0', warehouseId: '' }
}

function toNumbers(line: LineDraft) {
  return {
    description: line.description,
    quantity: /^\d{1,7}$/.test(line.quantity.trim()) ? Number(line.quantity.trim()) : Number.NaN,
    unitPriceMinor: parseKwdToMinor(line.price) ?? Number.NaN,
    taxRateBps: parsePercentToBps(line.tax) ?? Number.NaN,
    itemId: line.kind === 'item' && line.itemId !== '' ? line.itemId : null,
    warehouseId: line.kind === 'item' && line.warehouseId !== '' ? line.warehouseId : null,
  }
}

function issueMessage(path: ReadonlyArray<PropertyKey>): MessageKey {
  const [root, , field] = path
  if (root === 'customerId') return 'crm.form.errCustomer'
  if (root === 'validUntil') return 'crm.form.errDate'
  if (root === 'lines' && path.length === 1) return 'erp.form.errLines'
  if (root === 'lines' && field === 'description') return 'erp.form.errDescription'
  if (root === 'lines' && field === 'quantity') return 'erp.form.errQuantity'
  if (root === 'lines' && field === 'unitPriceMinor') return 'erp.form.errPrice'
  if (root === 'lines' && field === 'taxRateBps') return 'erp.form.errTax'
  if (root === 'lines' && (field === 'itemId' || field === 'warehouseId')) return 'erp.form.errStock'
  return 'erp.form.errGeneric'
}

function stockKey(itemId: string, warehouseId: string): string {
  return `${itemId}|${warehouseId}`
}

/**
 * Create, edit and run a quotation. A draft is editable with live stock checks and totals. Once sent, the quotation is
 * read-only and moves only by explicit actions. The convert button runs quote-to-cash and works only on an accepted one.
 */
export function QuotationBuilder({ quotationId, initialCustomer = null, initialLeadId = null, onChanged, onClose }: Props) {
  const { t, locale } = useI18n()
  const fmtLocale = locale === 'en' ? 'en' : 'ar'
  const unavailableTip = getUnavailableTooltip(fmtLocale)
  const [detail, setDetail] = useState<QuotationDetail | null>(null)
  const [phase, setPhase] = useState<Phase>(quotationId ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [reloadCount, setReloadCount] = useState(0)

  const [customer, setCustomer] = useState<CustomerRef | null>(initialCustomer)
  const [leadId, setLeadId] = useState(initialLeadId ?? '')
  const [validUntil, setValidUntil] = useState(() => addDays(todayUtc(), 30))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>(() => [emptyLine('item')])
  const [baseline, setBaseline] = useState<string | null>(null)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stockEnabled, setStockEnabled] = useState(true)
  const [balances, setBalances] = useState<Record<string, StockBalance[]>>({})
  const requestedBalances = useRef(new Set<string>())
  const [openLeads, setOpenLeads] = useState<Lead[]>([])

  const [errors, setErrors] = useState<MessageKey[]>([])
  const [failure, setFailure] = useState<Failure | null>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [threshold, setThreshold] = useState<number | null>(null)
  const [result, setResult] = useState<ConversionResult | null>(null)
  const createKey = useRef(newIdempotencyKey())
  const convertKey = useRef(newIdempotencyKey())

  const editable = detail === null || detail.status === 'draft'
  const today = todayUtc()
  const customerId = detail?.customerId ?? customer?.id ?? ''

  const loadBalances = useCallback((itemId: string) => {
    if (itemId === '' || requestedBalances.current.has(itemId)) return
    requestedBalances.current.add(itemId)
    apiRequest<ListPage<StockBalance>>(`/api/v1/inventory/balances?itemId=${itemId}&limit=100`)
      .then((page) => setBalances((current) => ({ ...current, [itemId]: page.data })))
      .catch(() => {
        requestedBalances.current.delete(itemId)
      })
  }, [])

  const applyDetail = useCallback(
    (next: QuotationDetail) => {
      const nextLines = next.lines.map((line) => {
        const draft = emptyLine(line.itemId ? 'item' : 'service')
        return {
          ...draft,
          itemId: line.itemId ?? '',
          description: line.description,
          quantity: String(line.quantity),
          price: minorToInput(line.unitPriceMinor),
          tax: bpsToInput(line.taxRateBps),
          warehouseId: line.warehouseId ?? '',
        }
      })
      setDetail(next)
      setLeadId(next.leadId ?? '')
      setValidUntil(next.validUntil)
      setNotes(next.notes ?? '')
      setLines(nextLines)
      setBaseline(serialize(next.customerId, next.leadId ?? '', next.validUntil, next.notes ?? '', nextLines))
      nextLines.forEach((line) => loadBalances(line.itemId))
    },
    [loadBalances],
  )

  useEffect(() => {
    if (!quotationId) return
    const controller = new AbortController()
    apiRequest<{ data: QuotationDetail }>(`/api/v1/crm/quotations/${quotationId}`, { signal: controller.signal })
      .then((payload) => {
        applyDetail(payload.data)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setLoadError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [quotationId, reloadCount, applyDetail])

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<ListPage<Warehouse>>('/api/v1/inventory/warehouses?limit=100&status=active', { signal: controller.signal })
      .then((page) => setWarehouses(page.data))
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setWarehouses([])
        setStockEnabled(false)
        setLines((current) => current.map((line) => (line.itemId === '' ? { ...line, kind: 'service' } : line)))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (customerId === '') {
      setOpenLeads([])
      return
    }
    const controller = new AbortController()
    const params = new URLSearchParams({ customerId, limit: '50', sort: 'createdAt', direction: 'desc' })
    apiRequest<ListPage<Lead>>(`/api/v1/crm/leads?${params.toString()}`, { signal: controller.signal })
      .then((page) => setOpenLeads(page.data.filter((lead) => lead.stage !== 'won' && lead.stage !== 'lost')))
      .catch(() => setOpenLeads([]))
    return () => controller.abort()
  }, [customerId])

  const totals = useMemo(() => {
    try {
      return computeTotals(lines.map(toNumbers))
    } catch {
      return null
    }
  }, [lines])

  const required = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of lines) {
      const numbers = toNumbers(line)
      if (!numbers.itemId || !numbers.warehouseId || Number.isNaN(numbers.quantity)) continue
      const key = stockKey(numbers.itemId, numbers.warehouseId)
      map.set(key, (map.get(key) ?? 0) + numbers.quantity)
    }
    return map
  }, [lines])

  function onHand(itemId: string, warehouseId: string): number | null {
    const rows = balances[itemId]
    if (!rows) return null
    return rows.find((row) => row.warehouseId === warehouseId)?.onHand ?? 0
  }

  const current = serialize(customerId, leadId, validUntil, notes, lines)
  const dirty = editable && (detail === null || current !== baseline)
  const pastDue = detail !== null && detail.status === 'sent' && isPastValidity(detail.validUntil, today)
  const serverShortages = detail && detail.status !== 'converted' ? detail.stockShortages : []

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((existing) => existing.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function chooseItem(key: string, item: Item) {
    setLines((existing) =>
      existing.map((line) =>
        line.key === key
          ? {
              ...line,
              itemId: item.id,
              sku: item.sku,
              description: line.description.trim() === '' ? item.name : line.description,
              price: line.price.trim() === '' ? minorToInput(item.sellingPriceMinor) : line.price,
              warehouseId: '',
            }
          : line,
      ),
    )
    apiRequest<ListPage<StockBalance>>(`/api/v1/inventory/balances?itemId=${item.id}&limit=100`)
      .then((page) => {
        requestedBalances.current.add(item.id)
        setBalances((existing) => ({ ...existing, [item.id]: page.data }))
        const activeIds = new Set(warehouses.map((warehouse) => warehouse.id))
        const best = [...page.data].filter((row) => activeIds.has(row.warehouseId)).sort((a, b) => b.onHand - a.onHand)[0]
        const fallback = warehouses.length === 1 ? warehouses[0].id : ''
        setLines((existing) =>
          existing.map((line) =>
            line.key === key && line.itemId === item.id && line.warehouseId === ''
              ? { ...line, warehouseId: best ? best.warehouseId : fallback }
              : line,
          ),
        )
      })
      .catch(() => undefined)
  }

  function clearItem(key: string) {
    updateLine(key, { itemId: '', sku: '', warehouseId: '' })
  }

  async function run(task: () => Promise<void>, keyToReset?: { current: string }) {
    setNotice(null)
    setFailure(null)
    setErrors([])
    setPending(true)
    try {
      await task()
    } catch (error) {
      if (keyToReset && !(error instanceof ApiError && (error.status === 0 || error.status >= 500))) {
        keyToReset.current = newIdempotencyKey()
      }
      setFailure({
        key: errorKey(error),
        detail: errorDetail(error),
        conflict: error instanceof ApiError && error.code === 'version_conflict',
      })
    } finally {
      setPending(false)
    }
  }

  async function persist(): Promise<QuotationDetail | null> {
    const candidate = {
      customerId,
      leadId: leadId === '' ? null : leadId,
      validUntil,
      notes: notes.trim() === '' ? null : notes,
      lines: lines.map(toNumbers),
    }
    const parsed = detail
      ? updateQuotationSchema.safeParse({ ...candidate, version: detail.version })
      : createQuotationSchema.safeParse(candidate)
    if (!parsed.success) {
      setErrors(Array.from(new Set(parsed.error.issues.map((issue) => issueMessage(issue.path)))))
      return null
    }
    const saved = detail
      ? await apiRequest<{ data: QuotationDetail }>(`/api/v1/crm/quotations/${detail.id}`, { method: 'PATCH', body: parsed.data })
      : await apiRequest<{ data: QuotationDetail }>('/api/v1/crm/quotations', {
          method: 'POST',
          body: parsed.data,
          idempotencyKey: createKey.current,
        })
    createKey.current = newIdempotencyKey()
    applyDetail(saved.data)
    return saved.data
  }

  function save() {
    void run(async () => {
      const saved = await persist()
      if (!saved) return
      setNotice('crm.msg.quoteSaved')
      onChanged('crm.msg.quoteSaved')
    })
  }

  function transition(path: 'send' | 'accept' | 'reject' | 'expire', message: MessageKey) {
    void run(async () => {
      let target = detail
      if (target === null || (editable && dirty)) {
        target = await persist()
        if (!target) return
      }
      const changed = await apiRequest<{ data: QuotationDetail }>(`/api/v1/crm/quotations/${target.id}/${path}`, {
        method: 'POST',
        body: { version: target.version },
      })
      applyDetail(changed.data)
      setNotice(message)
      onChanged(message)
    })
  }

  function openConfirm() {
    setConfirming(true)
    setFailure(null)
    apiRequest<{ data: InvoiceSummary }>('/api/v1/finance/invoices/summary')
      .then((payload) => setThreshold(payload.data.approvalThresholdMinor))
      .catch(() => setThreshold(null))
  }

  function convert() {
    if (!detail) return
    void run(async () => {
      const outcome = await apiRequest<{ data: ConversionResult }>(`/api/v1/crm/quotations/${detail.id}/convert`, {
        method: 'POST',
        body: { version: detail.version },
        idempotencyKey: convertKey.current,
      })
      convertKey.current = newIdempotencyKey()
      applyDetail(outcome.data.quotation)
      setResult(outcome.data)
      setConfirming(false)
      onChanged('crm.msg.converted')
    }, convertKey)
  }

  if (phase === 'loading') {
    return <StateBlock state="loading" locale={fmtLocale} title={t('erp.loading')} />
  }

  if (phase === 'error') {
    return (
      <StateBlock
        state="error"
        locale={fmtLocale}
        title={t(loadError)}
        onRetry={() => {
          setPhase('loading')
          setReloadCount((value) => value + 1)
        }}
        retryLabel={t('erp.retry')}
      />
    )
  }

  const needsApproval = totals !== null && threshold !== null && requiresApproval(totals.totalMinor, threshold)
  const canConvert = detail !== null && detail.status === 'accepted' && !dirty

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          {detail ? (
            <>
              <Num className="text-emerald-700 dark:text-emerald-300">{detail.quoteNumber}</Num>
              <QuotationStatusBadge quotation={detail} />
            </>
          ) : (
            t('crm.qb.new')
          )}
        </h3>
        {detail?.status === 'converted' && detail.invoiceId ? <CrmPill tone="gold">{t('crm.qb.convertedNote')}</CrmPill> : null}
      </div>

      {result ? (
        <div role="status" className="space-y-1.5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/45 dark:text-emerald-200">
          <p className="font-semibold">{t('crm.qb.doneTitle')}</p>
          <p>
            {t('crm.qb.invoice')}: <Num className="font-semibold">{result.invoice.number}</Num>
          </p>
          <p>{t(result.stockDeducted ? 'crm.qb.doneIssued' : 'crm.qb.donePending')}</p>
          {result.lead ? <p>{t('crm.qb.doneLead')}</p> : null}
          <Link href="/erp/finance" className="inline-block font-semibold text-emerald-700 underline dark:text-emerald-300">
            {t('crm.qb.openFinance')}
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {detail ? (
            <div>
              <span className={crmLabelClass}>{t('crm.qb.customer')}</span>
              <p className={`${crmSubcardClass} mt-1.5 text-sm font-semibold text-slate-900 dark:text-white`}>
                {detail.customerName}
              </p>
            </div>
          ) : (
            <CustomerPicker value={customer} onChange={setCustomer} label={t('crm.qb.customer')} />
          )}
        </div>
        <label className={crmLabelClass}>
          {t('crm.qb.lead')}
          <select
            value={leadId}
            disabled={!editable}
            onChange={(event) => setLeadId(event.target.value)}
            className={`${crmInputClass} disabled:opacity-60`}
          >
            <option value="">{t('crm.qb.noLead')}</option>
            {openLeads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.title} · {t(stageLabels[lead.stage])}
              </option>
            ))}
            {leadId !== '' && !openLeads.some((lead) => lead.id === leadId) ? <option value={leadId}>{leadId.slice(0, 8)}</option> : null}
          </select>
        </label>
        <label className={crmLabelClass}>
          {t('crm.qb.validUntil')}
          <input
            type="date"
            dir="ltr"
            value={validUntil}
            disabled={!editable}
            onChange={(event) => setValidUntil(event.target.value)}
            className={`${crmInputClass} tabular-nums disabled:opacity-60`}
          />
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{t('crm.qb.validUntilHint')}</span>
        </label>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{t('crm.qb.lines')}</h4>
        <div className="space-y-3">
          {lines.map((line) => {
            const numbers = toNumbers(line)
            const have = numbers.itemId && numbers.warehouseId ? onHand(numbers.itemId, numbers.warehouseId) : null
            const wanted = numbers.itemId && numbers.warehouseId ? required.get(stockKey(numbers.itemId, numbers.warehouseId)) ?? 0 : 0
            const short = have !== null && wanted > have
            const chipSku = line.sku !== '' ? line.sku : balances[line.itemId]?.[0]?.sku ?? ''
            return (
              <div key={line.key} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-12 dark:border-emerald-500/15">
                {editable && stockEnabled ? (
                  <div className="col-span-2 flex gap-2 text-xs sm:col-span-12">
                    {(['item', 'service'] as const).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={line.kind === kind}
                        onClick={() => updateLine(line.key, kind === 'service' ? { kind, itemId: '', sku: '', warehouseId: '' } : { kind })}
                        className={`cursor-pointer rounded-full border px-3 py-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                          line.kind === kind
                            ? 'border-emerald-500/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                            : 'border-slate-300 text-slate-600 hover:text-slate-900 dark:border-white/15 dark:text-slate-300 dark:hover:text-white'
                        }`}
                      >
                        {t(kind === 'item' ? 'crm.qb.stockItem' : 'crm.qb.service')}
                      </button>
                    ))}
                  </div>
                ) : null}

                {line.kind === 'item' ? (
                  <div className="col-span-2 sm:col-span-12">
                    {line.itemId !== '' ? (
                      <div className={`${crmSubcardClass} flex items-center justify-between gap-3 text-sm text-slate-900 dark:text-white`}>
                        <span className="min-w-0 truncate">
                          {chipSku !== '' ? <Num className="font-semibold text-emerald-700 dark:text-emerald-300">{chipSku}</Num> : <CrmPill tone="info">{t('crm.qb.stockItem')}</CrmPill>}
                        </span>
                        {editable ? (
                          <button
                            type="button"
                            onClick={() => clearItem(line.key)}
                            className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-emerald-300 dark:hover:bg-white/[0.06]"
                          >
                            {t('crm.picker.change')}
                          </button>
                        ) : null}
                      </div>
                    ) : editable ? (
                      <ItemPicker value={null} onChange={(item) => (item ? chooseItem(line.key, item) : clearItem(line.key))} />
                    ) : null}
                  </div>
                ) : null}

                <label className={`${crmLabelClass} col-span-2 sm:col-span-5`}>
                  {t('erp.form.description')}
                  <input
                    value={line.description}
                    disabled={!editable}
                    onChange={(event) => updateLine(line.key, { description: event.target.value })}
                    className={`${crmInputClass} disabled:opacity-60`}
                  />
                </label>
                <label className={`${crmLabelClass} sm:col-span-2`}>
                  {t('erp.form.quantity')}
                  <input
                    inputMode="numeric"
                    dir="ltr"
                    value={line.quantity}
                    disabled={!editable}
                    onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                    className={`${crmInputClass} tabular-nums disabled:opacity-60`}
                  />
                </label>
                <label className={`${crmLabelClass} sm:col-span-2`}>
                  {t('erp.form.unitPrice')}
                  <input
                    inputMode="decimal"
                    dir="ltr"
                    value={line.price}
                    disabled={!editable}
                    onChange={(event) => updateLine(line.key, { price: event.target.value })}
                    className={`${crmInputClass} tabular-nums disabled:opacity-60`}
                  />
                </label>
                <label className={`${crmLabelClass} sm:col-span-2`}>
                  {t('erp.form.tax')}
                  <input
                    inputMode="decimal"
                    dir="ltr"
                    value={line.tax}
                    disabled={!editable}
                    onChange={(event) => updateLine(line.key, { tax: event.target.value })}
                    className={`${crmInputClass} tabular-nums disabled:opacity-60`}
                  />
                </label>
                {editable ? (
                  <div className="col-span-2 flex items-end sm:col-span-1">
                    <button
                      type="button"
                      disabled={lines.length === 1}
                      aria-label={t('erp.form.removeLine')}
                      title={t('erp.form.removeLine')}
                      onClick={() => setLines((existing) => existing.filter((item) => item.key !== line.key))}
                      className={`${crmDangerBtn} w-full px-2`}
                    >
                      ×
                    </button>
                  </div>
                ) : null}

                {line.kind === 'item' && line.itemId !== '' ? (
                  <div className="col-span-2 sm:col-span-12">
                    <label className={crmLabelClass}>
                      {t('crm.qb.warehouse')}
                      <select
                        value={line.warehouseId}
                        disabled={!editable}
                        onChange={(event) => updateLine(line.key, { warehouseId: event.target.value })}
                        className={`${crmInputClass} disabled:opacity-60`}
                      >
                        <option value="">{t('crm.qb.pickWarehouse')}</option>
                        {warehouses.map((warehouse) => {
                          const quantity = onHand(line.itemId, warehouse.id)
                          return (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.code} · {warehouse.name}
                              {quantity === null ? '' : ` — ${t('crm.qb.available')}: ${formatInt(quantity, fmtLocale)}`}
                            </option>
                          )
                        })}
                        {line.warehouseId !== '' && !warehouses.some((warehouse) => warehouse.id === line.warehouseId) ? (
                          <option value={line.warehouseId}>{line.warehouseId.slice(0, 8)}</option>
                        ) : null}
                      </select>
                    </label>
                    {editable && have !== null ? (
                      <p className={`mt-1.5 text-xs font-medium ${short ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        {short ? t('crm.qb.short') : t('crm.qb.enough')} · {t('crm.qb.need')}: <Num>{formatInt(wanted, fmtLocale)}</Num> ·{' '}
                        {t('crm.qb.have')}: <Num>{formatInt(have, fmtLocale)}</Num>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        {editable ? (
          <button
            type="button"
            disabled={lines.length >= 200}
            onClick={() => setLines((existing) => [...existing, emptyLine(stockEnabled ? 'item' : 'service')])}
            className={`${crmSecondaryBtn} mt-3`}
          >
            {t('crm.qb.addLine')}
          </button>
        ) : null}
      </div>

      {serverShortages.length > 0 ? (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/45 dark:text-amber-200">
          <p className="font-semibold">{t('crm.qb.shortTitle')}</p>
          <ul className="mt-1 space-y-0.5">
            {serverShortages.map((shortage) => (
              <li key={`${shortage.itemId}-${shortage.warehouseId}`}>
                <Num>{shortage.sku}</Num> · <Num>{shortage.warehouseCode}</Num> — {t('crm.qb.need')}:{' '}
                <Num>{formatInt(shortage.required, fmtLocale)}</Num> · {t('crm.qb.have')}: <Num>{formatInt(shortage.available, fmtLocale)}</Num>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className={crmLabelClass}>
        {t('crm.qb.notes')}
        <textarea
          value={notes}
          disabled={!editable}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={2000}
          className={`${crmInputClass} disabled:opacity-60`}
        />
      </label>

      <dl className={`${crmSubcardClass} space-y-1.5 text-sm`}>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-600 dark:text-slate-300">{t('erp.form.subtotal')}</dt>
          <dd>
            {totals ? (
              <CrmMoney minor={totals.subtotalMinor} />
            ) : (
              <span title={unavailableTip} className="tabular-nums text-slate-500 dark:text-slate-400">
                {UNAVAILABLE_DASH}
              </span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-600 dark:text-slate-300">{t('erp.form.taxTotal')}</dt>
          <dd>
            {totals ? (
              <CrmMoney minor={totals.taxMinor} />
            ) : (
              <span title={unavailableTip} className="tabular-nums text-slate-500 dark:text-slate-400">
                {UNAVAILABLE_DASH}
              </span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 font-semibold text-slate-900 dark:border-white/10 dark:text-white">
          <dt>{t('erp.form.total')}</dt>
          <dd>
            {totals ? (
              <CrmMoney minor={totals.totalMinor} className="font-bold" />
            ) : (
              <span title={unavailableTip} className="tabular-nums text-slate-500 dark:text-slate-400">
                {UNAVAILABLE_DASH}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {pastDue ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/45 dark:text-amber-200">
          {t('crm.qb.expiredNote')}
        </p>
      ) : null}
      {detail && (detail.status === 'rejected' || detail.status === 'expired') ? (
        <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600 dark:border-emerald-500/15 dark:text-slate-300">
          {t('crm.qb.closedNote')}
        </p>
      ) : null}
      {detail && detail.status === 'sent' && !pastDue ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">{t('crm.qb.sentNote')}</p>
      ) : null}

      {errors.length > 0 ? (
        <ul role="alert" className={`${crmErrorClass} space-y-1`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
        </ul>
      ) : null}
      {failure ? (
        <div role="alert" className={`${crmErrorClass} space-y-1`}>
          <p>{t(failure.key)}</p>
          {failure.detail ? <p className="text-xs">{failure.detail}</p> : null}
          {failure.conflict && quotationId ? (
            <button
              type="button"
              onClick={() => {
                setFailure(null)
                setReloadCount((value) => value + 1)
              }}
              className="cursor-pointer font-semibold text-emerald-700 underline dark:text-emerald-300"
            >
              {t('erp.retry')}
            </button>
          ) : null}
        </div>
      ) : null}
      {notice ? <p role="status" className={crmNoticeClass}>{t(notice)}</p> : null}

      {confirming && detail ? (
        <div className="space-y-2 rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm text-slate-800 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-slate-100">
          <p className="font-semibold text-slate-900 dark:text-white">{t('crm.qb.convertTitle')}</p>
          <p>{t('crm.qb.convertIntro')}</p>
          <ul className="list-disc space-y-1 ps-5">
            <li>{t('crm.qb.convertStep1')}</li>
            <li>{t('crm.qb.convertStep2')}</li>
            <li>{t('crm.qb.convertStockOut')}</li>
            {detail.leadId ? <li>{t('crm.qb.convertLead')}</li> : null}
          </ul>
          <p>
            {t('crm.qb.convertTotal')}: <CrmMoney minor={detail.totalMinor} className="font-semibold" />
          </p>
          {needsApproval ? <p className="font-medium text-amber-800 dark:text-amber-300">{t('crm.qb.convertApproval')}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={convert} disabled={pending} className={crmPrimaryBtn}>
              {pending ? t('erp.working') : t('crm.qb.convertGo')}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={crmSecondaryBtn}>
              {t('erp.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {editable ? (
          <button type="button" onClick={save} disabled={pending || !dirty} className={crmPrimaryBtn}>
            {pending ? t('erp.working') : detail ? t('crm.qb.save') : t('crm.qb.create')}
          </button>
        ) : null}
        {editable ? (
          <button type="button" onClick={() => transition('send', 'crm.msg.quoteSent')} disabled={pending} className={crmSecondaryBtn}>
            {t('crm.qb.send')}
          </button>
        ) : null}
        {detail?.status === 'sent' ? (
          <>
            <button
              type="button"
              onClick={() => transition('accept', 'crm.msg.quoteAccepted')}
              disabled={pending || pastDue}
              className={crmSecondaryBtn}
            >
              {t('crm.qb.accept')}
            </button>
            <button type="button" onClick={() => transition('reject', 'crm.msg.quoteRejected')} disabled={pending} className={crmSecondaryBtn}>
              {t('crm.qb.reject')}
            </button>
          </>
        ) : null}
        {pastDue ? (
          <button type="button" onClick={() => transition('expire', 'crm.msg.quoteExpired')} disabled={pending} className={crmSecondaryBtn}>
            {t('crm.qb.expire')}
          </button>
        ) : null}
        {detail && (detail.status === 'draft' || detail.status === 'sent' || detail.status === 'accepted') ? (
          <span className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={openConfirm}
              disabled={pending || !canConvert || confirming}
              title={canConvert ? undefined : t('crm.qb.convertNeedsAccepted')}
              className={crmPrimaryBtn}
            >
              {t('crm.qb.convert')}
            </button>
            {!canConvert ? <span className="text-xs text-slate-600 dark:text-slate-300">{t('crm.qb.convertNeedsAccepted')}</span> : null}
          </span>
        ) : null}
        <button type="button" onClick={onClose} className={`${crmSecondaryBtn} ms-auto`}>
          {t('erp.close')}
        </button>
      </div>
    </div>
  )
}

function serialize(customerId: string, leadId: string, validUntil: string, notes: string, lines: readonly LineDraft[]): string {
  return JSON.stringify({
    customerId,
    leadId,
    validUntil,
    notes,
    lines: lines.map((line) => [line.kind, line.itemId, line.description, line.quantity, line.price, line.tax, line.warehouseId]),
  })
}
