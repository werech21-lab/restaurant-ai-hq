'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { errorClass, inputClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import {
  assertPostable,
  createJournalEntrySchema,
  reverseJournalEntrySchema,
  updateJournalEntrySchema,
  type JournalEntryDetail,
} from '@/modules/finance/client'
import { draftFromJournalLine, draftTotals, emptyJournalLine, journalIssue, journalLinesPayload, type JournalLineDraft } from '@/modules/finance/ui/journal-draft'
import { JournalLineEditor } from '@/modules/finance/ui/JournalLineEditor'
import { EntryStatusBadge, FormIssues, LedgerFailure, sourceTypeLabels } from '@/modules/finance/ui/shared'
import { useCan } from '@/modules/procurement/ui/permissions'
import { dateTimeText, Fact, Field, minorText, todayUtc, useIdempotencyKey, useRunner, type Phase } from '@/modules/procurement/ui/shared'

type Props = {
  entryId?: string
  onChanged: (message: MessageKey) => void
  onClose: () => void
  onOpenEntry: (entryId: string) => void
}

/** A manual entry starts with the two lines the API asks for at least. */
function startingLines(): JournalLineDraft[] {
  return [emptyJournalLine('debit'), emptyJournalLine('credit')]
}

/**
 * One journal entry. A draft can be edited and posted; a posted entry is read-only and is corrected by a reversal, never
 * by an edit. An entry that a business document made is reversed by voiding that document, so this screen does not offer
 * it. Every amount is integer fils shown as KWD with three decimals.
 */
export function JournalEntryDialog({ entryId, onChanged, onClose, onOpenEntry }: Props) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<JournalEntryDetail | null>(null)
  const [phase, setPhase] = useState<Phase>(entryId ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState<MessageKey>('erp.err.generic')
  const [reloadCount, setReloadCount] = useState(0)

  const [entryDate, setEntryDate] = useState(todayUtc)
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState<JournalLineDraft[]>(startingLines)
  const [issues, setIssues] = useState<MessageKey[]>([])
  const [notice, setNotice] = useState<MessageKey | null>(null)

  const [reversing, setReversing] = useState(false)
  const [reverseDate, setReverseDate] = useState(todayUtc)
  const [reverseMemo, setReverseMemo] = useState('')

  const canCreate = useCan(permissions.financeJournalCreate)
  const canPost = useCan(permissions.financeJournalPost)
  // The service asks for both permissions before it reverses an entry.
  const canReverse = useCan(permissions.financeJournalReverse, permissions.financeJournalPost)

  const createKey = useIdempotencyKey()
  const reverseKey = useIdempotencyKey()
  const { pending, failure, run } = useRunner()

  const applyDetail = useCallback((next: JournalEntryDetail) => {
    setDetail(next)
    setEntryDate(next.entryDate)
    setMemo(next.memo)
    setLines(next.lines.map(draftFromJournalLine))
  }, [])

  useEffect(() => {
    if (!entryId) return
    const controller = new AbortController()
    apiRequest<{ data: JournalEntryDetail }>(`/api/v1/finance/journal-entries/${entryId}`, { signal: controller.signal })
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
  }, [entryId, reloadCount, applyDetail])

  const reload = useCallback(() => {
    setPhase('loading')
    setReloadCount((value) => value + 1)
  }, [])

  function done(message: MessageKey, next: JournalEntryDetail) {
    applyDetail(next)
    setNotice(message)
    setReversing(false)
    onChanged(message)
  }

  async function persist(): Promise<JournalEntryDetail | null> {
    setIssues([])
    const body = { entryDate, memo, currency: 'KWD', lines: journalLinesPayload(lines) }
    const parsed = detail ? updateJournalEntrySchema.safeParse({ ...body, version: detail.version }) : createJournalEntrySchema.safeParse(body)
    if (!parsed.success) {
      setIssues(Array.from(new Set(parsed.error.issues.map((issue) => journalIssue(issue.path)))))
      return null
    }
    const saved = detail
      ? await apiRequest<{ data: JournalEntryDetail }>(`/api/v1/finance/journal-entries/${detail.id}`, { method: 'PATCH', body: parsed.data })
      : await apiRequest<{ data: JournalEntryDetail }>('/api/v1/finance/journal-entries', {
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
      if (saved) done(detail ? 'led.msg.entrySaved' : 'led.msg.entryCreated', saved)
    }, createKey)
  }

  function post() {
    void run(async () => {
      // Unsaved edits go first, so the entry is posted exactly as it is on the screen.
      const target = canCreate ? await persist() : detail
      if (!target) return
      // The same pure rule the service and the database apply, so the user reads why before a request goes out.
      assertPostable(target.lines)
      const posted = await apiRequest<{ data: JournalEntryDetail }>(`/api/v1/finance/journal-entries/${target.id}/post`, {
        method: 'POST',
        body: { version: target.version },
      })
      done('led.msg.entryPosted', posted.data)
    }, createKey)
  }

  function reverse() {
    if (!detail) return
    setIssues([])
    const parsed = reverseJournalEntrySchema.safeParse({ version: detail.version, entryDate: reverseDate, memo: reverseMemo })
    if (!parsed.success) {
      setIssues(Array.from(new Set(parsed.error.issues.map((issue) => journalIssue(issue.path)))))
      return
    }
    void run(async () => {
      const created = await apiRequest<{ data: JournalEntryDetail }>(`/api/v1/finance/journal-entries/${detail.id}/reverse`, {
        method: 'POST',
        body: parsed.data,
        idempotencyKey: reverseKey.ref.current,
      })
      reverseKey.reset()
      setReversing(false)
      onChanged('led.msg.entryReversed')
      // The answer is the new reversing entry, already posted. Open it so the user sees what was booked.
      onOpenEntry(created.data.id)
    }, reverseKey)
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

  const draft = detail === null || detail.status === 'draft'
  const editable = draft && canCreate
  const totals = draftTotals(lines)
  const balanced = detail && !draft ? detail.totalDebitMinor === detail.totalCreditMinor : totals !== null && totals.balanced
  // A posted entry made by a business document is corrected through that document, not here.
  const reversible = detail !== null && detail.status === 'posted' && detail.reversedById === null && (detail.sourceType === 'manual' || detail.sourceType === 'reversal')
  const reversesId = detail?.reversesId ?? null
  const reversedById = detail?.reversedById ?? null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-100">
          {detail ? (
            <>
              <Num className="text-blue-300">JE-{detail.number}</Num>
              <EntryStatusBadge status={detail.status} />
            </>
          ) : (
            t('led.je.new')
          )}
        </h3>
        {detail ? <span className="text-sm text-gray-400">{t(sourceTypeLabels[detail.sourceType])}</span> : null}
      </div>

      {notice ? (
        <p role="status" className={noticeClass}>
          {t(notice)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {editable ? (
          <Field label={t('led.je.date')}>
            <input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} dir="ltr" className={inputClass} />
          </Field>
        ) : (
          <Fact label={t('led.je.date')}>
            <Num>{entryDate}</Num>
          </Fact>
        )}
        {detail?.postedAt ? <Fact label={t('led.je.postedAt')}>{dateTimeText(detail.postedAt)}</Fact> : null}
        {detail ? <Fact label={t('led.je.currency')}>{detail.currency}</Fact> : null}
        {editable ? (
          <Field label={t('led.je.memo')} className="sm:col-span-3">
            <textarea value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={500} rows={2} className={inputClass} />
          </Field>
        ) : (
          <Fact label={t('led.je.memo')}>{memo === '' ? '—' : memo}</Fact>
        )}
      </div>

      {detail && detail.status === 'posted' ? <p className="text-xs text-gray-500">{t('led.je.postedNote')}</p> : null}

      {reversesId !== null || reversedById !== null ? (
        <div className="flex flex-wrap gap-2">
          {reversesId !== null ? (
            <button type="button" onClick={() => onOpenEntry(reversesId)} className={secondaryButton}>
              {t('led.je.openOriginal')}
            </button>
          ) : null}
          {reversedById !== null ? (
            <button type="button" onClick={() => onOpenEntry(reversedById)} className={secondaryButton}>
              {t('led.je.openReversal')}
            </button>
          ) : null}
        </div>
      ) : null}

      {editable ? (
        <section aria-label={t('led.je.lines')}>
          <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('led.je.lines')}</h4>
          <JournalLineEditor lines={lines} onChange={setLines} />
        </section>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-start font-medium">{t('led.line.account')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('led.line.description')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('led.line.debit')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('led.line.credit')}</th>
              </tr>
            </thead>
            <tbody>
              {(detail?.lines ?? []).map((line) => (
                <tr key={line.id} className="border-b border-[#30363d]/60 text-gray-200">
                  <td className="px-3 py-2">
                    <Num className="font-semibold text-blue-300">{line.accountCode}</Num> {line.accountName}
                  </td>
                  <td className="px-3 py-2">{line.description === '' ? '—' : line.description}</td>
                  <td className="px-3 py-2">{line.debitMinor > 0 ? <Money value={minorText(line.debitMinor)} /> : '—'}</td>
                  <td className="px-3 py-2">{line.creditMinor > 0 ? <Money value={minorText(line.creditMinor)} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#30363d] p-4 sm:grid-cols-3">
        <Fact label={t('led.je.totalDebit')}>
          <Money value={minorText(editable ? (totals?.debitMinor ?? 0) : (detail?.totalDebitMinor ?? 0))} />
        </Fact>
        <Fact label={t('led.je.totalCredit')}>
          <Money value={minorText(editable ? (totals?.creditMinor ?? 0) : (detail?.totalCreditMinor ?? 0))} />
        </Fact>
        <Fact label={t('led.je.balance')}>
          {balanced ? (
            <span className="text-emerald-300">{t('led.je.balanced')}</span>
          ) : (
            <span className="text-amber-300">
              {t('led.je.unbalanced')}
              {editable && totals ? (
                <>
                  {' · '}
                  {t('led.je.difference')} <Money value={minorText(Math.abs(totals.differenceMinor))} />
                </>
              ) : null}
            </span>
          )}
        </Fact>
      </div>

      {editable ? <p className="text-xs text-gray-500">{t('led.je.draftNote')}</p> : null}

      {reversing && detail ? (
        <section className="space-y-3 rounded-xl border border-[#30363d] p-4" aria-label={t('led.je.reverseTitle')}>
          <h4 className="text-sm font-semibold text-gray-200">{t('led.je.reverseTitle')}</h4>
          <p className="text-xs text-gray-400">{t('led.je.reverseHint')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('led.je.reverseDate')}>
              <input type="date" value={reverseDate} onChange={(event) => setReverseDate(event.target.value)} dir="ltr" className={inputClass} />
            </Field>
            <Field label={t('led.je.reverseMemo')}>
              <input value={reverseMemo} onChange={(event) => setReverseMemo(event.target.value)} maxLength={500} className={inputClass} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={reverse} disabled={pending} className={primaryButton}>
              {pending ? t('erp.loading') : t('led.je.confirmReverse')}
            </button>
            <button type="button" onClick={() => setReversing(false)} className={secondaryButton}>
              {t('erp.cancel')}
            </button>
          </div>
        </section>
      ) : null}

      <FormIssues issues={issues} />
      <LedgerFailure failure={failure} onReload={reload} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#30363d] pt-4">
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <button type="button" onClick={save} disabled={pending} className={secondaryButton}>
              {t('led.save')}
            </button>
          ) : null}
          {draft && canPost && (detail !== null || canCreate) ? (
            <button type="button" onClick={post} disabled={pending || !balanced} className={primaryButton}>
              {t('led.je.post')}
            </button>
          ) : null}
          {reversible && canReverse && !reversing ? (
            <button type="button" onClick={() => setReversing(true)} disabled={pending} className={secondaryButton}>
              {t('led.je.reverse')}
            </button>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className={secondaryButton}>
          {t('erp.close')}
        </button>
      </div>
    </div>
  )
}
