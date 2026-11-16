'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { Num } from '@/components/ui'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import { formatInt, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
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
import { useCan } from '@/modules/procurement/ui/permissions'
import { SupplierSelect } from '@/modules/procurement/ui/Selects'
import {
  Fact,
  FailureMessage,
  Field,
  RequestStatusBadge,
  dateTimeText,
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
  requestId?: string
  onChanged: (message: MessageKey) => void
  onClose: () => void
  onOpenOrder: (orderId: string) => void
}

type Pricing = Record<string, { price: string; tax: string }>

function formIssue(path: ReadonlyArray<PropertyKey>): MessageKey {
  if (path[0] === 'neededBy' || path[0] === 'orderDate' || path[0] === 'expectedDate') {
    return 'pro.err.form.date'
  }
  if (path[0] === 'supplierId') return 'pro.err.form.supplier'
  if (path[0] === 'lines' && path[2] === 'unitCostMinor') return 'pro.err.form.price'
  if (path[0] === 'lines' && path[2] === 'taxRateBps') return 'pro.err.form.tax'
  return lineIssue(path)
}

/** Create, edit, decide, and convert a purchase request. */
export function RequestDialog({
  requestId,
  onChanged,
  onClose,
  onOpenOrder,
}: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
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
      Object.fromEntries(
        next.lines.map((line) => [
          line.id,
          current[line.id] ?? { price: '', tax: bpsToInput(0) },
        ]),
      ),
    )
  }, [])

  useEffect(() => {
    if (!requestId) return
    const controller = new AbortController()
    apiRequest<{ data: PurchaseRequestDetail }>(
      `/api/v1/procurement/requests/${requestId}`,
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
      setErrors(
        Array.from(
          new Set(parsed.error.issues.map((issue) => formIssue(issue.path))),
        ),
      )
      return null
    }
    const saved = detail
      ? await apiRequest<{ data: PurchaseRequestDetail }>(
          `/api/v1/procurement/requests/${detail.id}`,
          { method: 'PATCH', body: parsed.data },
        )
      : await apiRequest<{ data: PurchaseRequestDetail }>(
          '/api/v1/procurement/requests',
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
      if (saved) done('pro.msg.requestSaved')
    }, createKey)
  }

  function transition(
    action: 'submit' | 'approve' | 'reject' | 'cancel',
    message: MessageKey,
  ) {
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
      const result = await apiRequest<{ data: PurchaseRequestDetail }>(
        `/api/v1/procurement/requests/${target.id}/${action}`,
        { method: 'POST', body },
      )
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
      setErrors(
        Array.from(
          new Set(parsed.error.issues.map((issue) => formIssue(issue.path))),
        ),
      )
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: PurchaseRequestDetail }>(
        `/api/v1/procurement/requests/${detail.id}/convert`,
        {
          method: 'POST',
          body: parsed.data,
          idempotencyKey: convertKey.ref.current,
        },
      )
      convertKey.reset()
      done('pro.msg.requestConverted', result.data)
    }, convertKey)
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

  const status = detail?.status
  const asked = asking !== null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
          {detail ? (
            <>
              <Num className="text-emerald-700 dark:text-emerald-300">
                PR-{detail.number}
              </Num>
              <RequestStatusBadge status={detail.status} />
            </>
          ) : (
            t('pro.req.new')
          )}
        </h4>
        {status === 'converted' && detail?.purchaseOrderId ? (
          <button
            type="button"
            onClick={() => onOpenOrder(detail.purchaseOrderId as string)}
            className={proSecondaryButton}
          >
            {t('pro.req.openOrder')} <Num>PO-{detail.purchaseOrderNumber}</Num>
          </button>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className={proNoticeClass}>
          {t(notice)}
        </p>
      ) : null}

      {detail ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label={t('pro.col.created')}>
            <Num>{dateTimeText(detail.createdAt, fmtLocale)}</Num>
          </Fact>
          {detail.decidedAt ? (
            <Fact label={t('pro.req.decidedAt')}>
              <Num>{dateTimeText(detail.decidedAt, fmtLocale)}</Num>
            </Fact>
          ) : null}
          {detail.decisionNote ? (
            <Fact label={t('pro.req.decisionNote')}>{detail.decisionNote}</Fact>
          ) : null}
          {detail.cancelledReason ? (
            <Fact label={t('pro.req.cancelledReason')}>
              {detail.cancelledReason}
            </Fact>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('pro.req.neededBy')}>
          <input
            type="date"
            value={neededBy}
            onChange={(event) => setNeededBy(event.target.value)}
            disabled={!editable}
            dir="ltr"
            className={proInputClass}
          />
        </Field>
        <Field label={t('pro.req.reason')} className="sm:col-span-2">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={!editable}
            maxLength={1000}
            rows={2}
            className={proInputClass}
          />
        </Field>
      </div>

      <section aria-label={t('erp.form.lines')}>
        <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          {t('erp.form.lines')}
        </h4>
        <LineEditor
          lines={lines}
          onChange={setLines}
          priced={false}
          disabled={!editable}
        />
      </section>

      {status === 'approved' ? (
        <section
          aria-label={t('pro.req.convertTitle')}
          className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-50/70 p-4 dark:bg-emerald-950/20"
        >
          <div>
            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              {t('pro.req.convertTitle')}
            </h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {t('pro.req.convertHint')}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SupplierSelect
              value={supplierId}
              onChange={setSupplierId}
              label={t('pro.col.supplier')}
            />
            <Field label={t('pro.ord.orderDate')}>
              <input
                type="date"
                value={orderDate}
                onChange={(event) => setOrderDate(event.target.value)}
                dir="ltr"
                className={proInputClass}
              />
            </Field>
            <Field label={t('pro.ord.expectedDate')}>
              <input
                type="date"
                value={expectedDate}
                onChange={(event) => setExpectedDate(event.target.value)}
                dir="ltr"
                className={proInputClass}
              />
            </Field>
          </div>
          <div className="space-y-2">
            {detail?.lines.map((line) => (
              <div
                key={line.id}
                className={`${proSubtleClass} grid grid-cols-2 items-end gap-3 sm:grid-cols-4`}
              >
                <p className="col-span-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {line.description} ·{' '}
                  <Num>× {formatInt(line.quantity, fmtLocale)}</Num>
                </p>
                <Field label={t('pro.line.unitCost')}>
                  <input
                    value={pricing[line.id]?.price ?? ''}
                    onChange={(event) =>
                      setPricing((current) => ({
                        ...current,
                        [line.id]: {
                          price: event.target.value,
                          tax: current[line.id]?.tax ?? '0',
                        },
                      }))
                    }
                    inputMode="decimal"
                    dir="ltr"
                    className={proInputClass}
                    placeholder={minorToInput(0)}
                  />
                </Field>
                <Field label={t('erp.form.tax')}>
                  <input
                    value={pricing[line.id]?.tax ?? '0'}
                    onChange={(event) =>
                      setPricing((current) => ({
                        ...current,
                        [line.id]: {
                          price: current[line.id]?.price ?? '',
                          tax: event.target.value,
                        },
                      }))
                    }
                    inputMode="decimal"
                    dir="ltr"
                    className={proInputClass}
                  />
                </Field>
              </div>
            ))}
          </div>
          <Field label={t('erp.form.notes')}>
            <textarea
              value={orderNotes}
              onChange={(event) => setOrderNotes(event.target.value)}
              maxLength={2000}
              rows={2}
              className={proInputClass}
            />
          </Field>
          {canConvertRequest ? (
            <button
              type="button"
              onClick={convert}
              disabled={pending}
              className={proPrimaryButton}
            >
              {pending ? t('erp.loading') : t('pro.req.convert')}
            </button>
          ) : null}
        </section>
      ) : null}

      {asked ? (
        <section className={`${proSubtleClass} space-y-3`}>
          <Field label={t(asking === 'reject' ? 'pro.req.rejectNote' : 'pro.reason')}>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={2}
              className={proInputClass}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || note.trim() === ''}
              onClick={() =>
                transition(
                  asking,
                  asking === 'reject'
                    ? 'pro.msg.requestRejected'
                    : 'pro.msg.requestCancelled',
                )
              }
              className={proDangerButton}
            >
              {t(asking === 'reject' ? 'pro.req.reject' : 'pro.req.cancel')}
            </button>
            <button
              type="button"
              onClick={() => setAsking(null)}
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
          {editable && canEditRequest ? (
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className={proSecondaryButton}
            >
              {t('pro.save')}
            </button>
          ) : null}
          {editable && canEditRequest && canSubmitRequest ? (
            <button
              type="button"
              onClick={() => {
                clear()
                transition('submit', 'pro.msg.requestSubmitted')
              }}
              disabled={pending}
              className={proPrimaryButton}
            >
              {t('pro.req.submit')}
            </button>
          ) : null}
          {status === 'submitted' && canApproveRequest ? (
            <>
              <button
                type="button"
                onClick={() => transition('approve', 'pro.msg.requestApproved')}
                disabled={pending}
                className={proPrimaryButton}
              >
                {t('pro.req.approve')}
              </button>
              <button
                type="button"
                onClick={() => setAsking('reject')}
                disabled={pending}
                className={proDangerButton}
              >
                {t('pro.req.reject')}
              </button>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {detail && canCancelRequest(detail.status) && canCancelPermitted ? (
            <button
              type="button"
              onClick={() => setAsking('cancel')}
              disabled={pending}
              className={proDangerButton}
            >
              {t('pro.req.cancel')}
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
