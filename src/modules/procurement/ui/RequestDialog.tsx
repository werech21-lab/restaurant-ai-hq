'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { dangerButton, errorClass, inputClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { useCan } from '@/modules/procurement/ui/permissions'
import { bpsToInput, minorToInput, parseKwdToMinor, parsePercentToBps } from '@/lib/money'
import {
  canCancelRequest,
  convertRequestSchema,
  createRequestSchema,
  isRequestEditable,
  updateRequestSchema,
  type PurchaseRequestDetail,
} from '@/modules/procurement/client'
import {
  draftFromLine,
  emptyLine,
  LineEditor,
  lineIssue,
  requestLinesPayload,
  type LineDraft,
} from '@/modules/procurement/ui/LineEditor'
import { SupplierSelect } from '@/modules/procurement/ui/Selects'
import {
  Fact,
  Field,
  FailureMessage,
  RequestStatusBadge,
  dateTimeText,
  todayUtc,
  useIdempotencyKey,
  useRunner,
  type Phase,
} from '@/modules/procurement/ui/shared'

type Props = {
  requestId?: string
  onChanged: (message: MessageKey) => void
  onClose: () => void
  onOpenOrder: (orderId: string) => void
}

type Pricing = Record<string, { price: string; tax: string }>

function formIssue(path: ReadonlyArray<PropertyKey>): MessageKey {
  if (path[0] === 'neededBy' || path[0] === 'orderDate' || path[0] === 'expectedDate') return 'pro.err.form.date'
  if (path[0] === 'supplierId') return 'pro.err.form.supplier'
  if (path[0] === 'lines' && path[2] === 'unitCostMinor') return 'pro.err.form.price'
  if (path[0] === 'lines' && path[2] === 'taxRateBps') return 'pro.err.form.tax'
  return lineIssue(path)
}

/**
 * Create, edit and decide a purchase request. A draft is editable. A submitted one waits for a decision. An approved one is
 * priced by the buyer and turned into a draft purchase order.
 */
export function RequestDialog({ requestId, onChanged, onClose, onOpenOrder }: Props) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<PurchaseRequestDetail | null>(null)
  const [phase, setPhase] = useState<Phase>(requestId ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [reloadCount, setReloadCount] = useState(0)

  const [neededBy, setNeededBy] = useState('')
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<LineDraft[]>(() => [emptyLine()])

  const [supplierId, setSupplierId] = useState('')
  const [orderDate, setOrderDate] = useState(todayUtc)
  const [expectedDate, setExpectedDate] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [pricing, setPricing] = useState<Pricing>({})

  const [note, setNote] = useState('')
  const [asking, setAsking] = useState<'reject' | 'cancel' | null>(null)
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [notice, setNotice] = useState<MessageKey | null>(null)

  const createKey = useIdempotencyKey()
  const convertKey = useIdempotencyKey()
  const { pending, failure, run, clear } = useRunner()
  // Hidden buttons are a convenience only: the API and the database check each permission again.
  const canEditRequest = useCan(permissions.procurementRequestCreate)
  const canSubmitRequest = useCan(permissions.procurementRequestSubmit)
  const canApproveRequest = useCan(permissions.procurementRequestApprove)
  const canCancelPermitted = useCan(permissions.procurementRequestCancel)
  const canConvertRequest = useCan(permissions.procurementRequestConvert)

  const editable = detail === null || isRequestEditable(detail.status)

  const applyDetail = useCallback((next: PurchaseRequestDetail) => {
    setDetail(next)
    setNeededBy(next.neededBy ?? '')
    setReason(next.reason ?? '')
    setLines(next.lines.map(draftFromLine))
    setPricing((current) =>
      Object.fromEntries(next.lines.map((line) => [line.id, current[line.id] ?? { price: '', tax: bpsToInput(0) }]))
    )
  }, [])

  useEffect(() => {
    if (!requestId) return
    const controller = new AbortController()
    apiRequest<{ data: PurchaseRequestDetail }>(`/api/v1/procurement/requests/${requestId}`, { signal: controller.signal })
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
  }, [requestId, reloadCount, applyDetail])

  const reload = useCallback(() => {
    setPhase('loading')
    setReloadCount((value) => value + 1)
  }, [])

  function done(message: MessageKey, next?: PurchaseRequestDetail) {
    if (next) applyDetail(next)
    setNotice(message)
    setAsking(null)
    setNote('')
    onChanged(message)
  }

  /** Validates with the API's own schema, then creates or updates. Returns null when the form is not valid. */
  async function persist(): Promise<PurchaseRequestDetail | null> {
    setErrors([])
    const candidate = {
      neededBy: neededBy === '' ? null : neededBy,
      reason: reason.trim() === '' ? null : reason,
      lines: requestLinesPayload(lines),
    }
    const parsed = detail
      ? updateRequestSchema.safeParse({ ...candidate, version: detail.version })
      : createRequestSchema.safeParse(candidate)
    if (!parsed.success) {
      setErrors(Array.from(new Set(parsed.error.issues.map((issue) => formIssue(issue.path)))))
      return null
    }
    const saved = detail
      ? await apiRequest<{ data: PurchaseRequestDetail }>(`/api/v1/procurement/requests/${detail.id}`, { method: 'PATCH', body: parsed.data })
      : await apiRequest<{ data: PurchaseRequestDetail }>('/api/v1/procurement/requests', {
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
      if (saved) done('pro.msg.requestSaved')
    }, createKey)
  }

  function transition(action: 'submit' | 'approve' | 'reject' | 'cancel', message: MessageKey) {
    void run(async () => {
      let target = detail
      if (action === 'submit' && (target === null || editable)) {
        target = await persist()
        if (!target) return
      }
      if (!target) return
      const body =
        action === 'reject'
          ? { version: target.version, note }
          : action === 'cancel'
            ? { version: target.version, reason: note }
            : { version: target.version }
      const result = await apiRequest<{ data: PurchaseRequestDetail }>(`/api/v1/procurement/requests/${target.id}/${action}`, {
        method: 'POST',
        body,
      })
      done(message, result.data)
    })
  }

  function convert() {
    if (!detail) return
    setErrors([])
    const candidate = {
      version: detail.version,
      supplierId,
      orderDate,
      expectedDate: expectedDate === '' ? null : expectedDate,
      notes: orderNotes.trim() === '' ? null : orderNotes,
      lines: detail.lines.map((line) => ({
        requestLineId: line.id,
        unitCostMinor: parseKwdToMinor(pricing[line.id]?.price ?? '') ?? Number.NaN,
        taxRateBps: parsePercentToBps(pricing[line.id]?.tax ?? '') ?? Number.NaN,
      })),
    }
    const parsed = convertRequestSchema.safeParse(candidate)
    if (!parsed.success) {
      setErrors(Array.from(new Set(parsed.error.issues.map((issue) => formIssue(issue.path)))))
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: PurchaseRequestDetail }>(`/api/v1/procurement/requests/${detail.id}/convert`, {
        method: 'POST',
        body: parsed.data,
        idempotencyKey: convertKey.ref.current,
      })
      convertKey.reset()
      done('pro.msg.requestConverted', result.data)
    }, convertKey)
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

  const status = detail?.status
  const asked = asking !== null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-100">
          {detail ? (
            <>
              <Num className="text-blue-300">PR-{detail.number}</Num>
              <RequestStatusBadge status={detail.status} />
            </>
          ) : (
            t('pro.req.new')
          )}
        </h3>
        {status === 'converted' && detail?.purchaseOrderId ? (
          <button type="button" onClick={() => onOpenOrder(detail.purchaseOrderId as string)} className={secondaryButton}>
            {t('pro.req.openOrder')} <Num>PO-{detail.purchaseOrderNumber}</Num>
          </button>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className={noticeClass}>
          {t(notice)}
        </p>
      ) : null}

      {detail ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label={t('pro.col.created')}>{dateTimeText(detail.createdAt)}</Fact>
          {detail.decidedAt ? <Fact label={t('pro.req.decidedAt')}>{dateTimeText(detail.decidedAt)}</Fact> : null}
          {detail.decisionNote ? <Fact label={t('pro.req.decisionNote')}>{detail.decisionNote}</Fact> : null}
          {detail.cancelledReason ? <Fact label={t('pro.req.cancelledReason')}>{detail.cancelledReason}</Fact> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('pro.req.neededBy')}>
          <input type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} disabled={!editable} dir="ltr" className={inputClass} />
        </Field>
        <Field label={t('pro.req.reason')} className="sm:col-span-2">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={!editable}
            maxLength={1000}
            rows={2}
            className={inputClass}
          />
        </Field>
      </div>

      <section aria-label={t('erp.form.lines')}>
        <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('erp.form.lines')}</h4>
        <LineEditor lines={lines} onChange={setLines} priced={false} disabled={!editable} />
      </section>

      {status === 'approved' ? (
        <section aria-label={t('pro.req.convertTitle')} className="space-y-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <div>
            <h4 className="text-sm font-semibold text-blue-200">{t('pro.req.convertTitle')}</h4>
            <p className="mt-1 text-xs text-gray-400">{t('pro.req.convertHint')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SupplierSelect value={supplierId} onChange={setSupplierId} label={t('pro.col.supplier')} />
            <Field label={t('pro.ord.orderDate')}>
              <input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} dir="ltr" className={inputClass} />
            </Field>
            <Field label={t('pro.ord.expectedDate')}>
              <input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} dir="ltr" className={inputClass} />
            </Field>
          </div>
          <div className="space-y-2">
            {detail?.lines.map((line) => (
              <div key={line.id} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-[#30363d] bg-[#0d1117]/60 p-3 sm:grid-cols-4">
                <p className="col-span-2 text-sm text-gray-200">
                  {line.description} · <Num>× {line.quantity.toLocaleString('en-US')}</Num>
                </p>
                <Field label={t('pro.line.unitCost')}>
                  <input
                    value={pricing[line.id]?.price ?? ''}
                    onChange={(event) => setPricing((current) => ({ ...current, [line.id]: { price: event.target.value, tax: current[line.id]?.tax ?? '0' } }))}
                    inputMode="decimal"
                    dir="ltr"
                    className={inputClass}
                    placeholder={minorToInput(0)}
                  />
                </Field>
                <Field label={t('erp.form.tax')}>
                  <input
                    value={pricing[line.id]?.tax ?? '0'}
                    onChange={(event) => setPricing((current) => ({ ...current, [line.id]: { price: current[line.id]?.price ?? '', tax: event.target.value } }))}
                    inputMode="decimal"
                    dir="ltr"
                    className={inputClass}
                  />
                </Field>
              </div>
            ))}
          </div>
          <Field label={t('erp.form.notes')}>
            <textarea value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} maxLength={2000} rows={2} className={inputClass} />
          </Field>
          {canConvertRequest ? (
            <button type="button" onClick={convert} disabled={pending} className={primaryButton}>
              {pending ? t('erp.loading') : t('pro.req.convert')}
            </button>
          ) : null}
        </section>
      ) : null}

      {asked ? (
        <section className="space-y-3 rounded-xl border border-[#30363d] p-4">
          <Field label={t(asking === 'reject' ? 'pro.req.rejectNote' : 'pro.reason')}>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} className={inputClass} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || note.trim() === ''}
              onClick={() => transition(asking, asking === 'reject' ? 'pro.msg.requestRejected' : 'pro.msg.requestCancelled')}
              className={dangerButton}
            >
              {t(asking === 'reject' ? 'pro.req.reject' : 'pro.req.cancel')}
            </button>
            <button type="button" onClick={() => setAsking(null)} className={secondaryButton}>
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
          {editable && canEditRequest ? (
            <button type="button" onClick={save} disabled={pending} className={secondaryButton}>
              {t('pro.save')}
            </button>
          ) : null}
          {editable && canEditRequest && canSubmitRequest ? (
            <button type="button" onClick={() => { clear(); transition('submit', 'pro.msg.requestSubmitted') }} disabled={pending} className={primaryButton}>
              {t('pro.req.submit')}
            </button>
          ) : null}
          {status === 'submitted' && canApproveRequest ? (
            <>
              <button type="button" onClick={() => transition('approve', 'pro.msg.requestApproved')} disabled={pending} className={primaryButton}>
                {t('pro.req.approve')}
              </button>
              <button type="button" onClick={() => setAsking('reject')} disabled={pending} className={dangerButton}>
                {t('pro.req.reject')}
              </button>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {detail && canCancelRequest(detail.status) && canCancelPermitted ? (
            <button type="button" onClick={() => setAsking('cancel')} disabled={pending} className={dangerButton}>
              {t('pro.req.cancel')}
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
