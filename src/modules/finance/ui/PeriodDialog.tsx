'use client'

import { useState } from 'react'
import { apiRequest } from '@/components/erp/api'
import { dangerButton, inputClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { closePeriodSchema, createPeriodSchema, type FiscalPeriod } from '@/modules/finance/client'
import { FormIssues, LedgerFailure, PeriodStatusBadge } from '@/modules/finance/ui/shared'
import { useCan } from '@/modules/procurement/ui/permissions'
import { dateTimeText, Fact, Field, todayUtc, useRunner } from '@/modules/procurement/ui/shared'

type Props = {
  /** The row the list already holds. The API has no endpoint that reads one period on its own. */
  period?: FiscalPeriod
  onChanged: (message: MessageKey) => void
  onClose: () => void
}

function issueOf(path: ReadonlyArray<PropertyKey>): MessageKey {
  if (path[0] === 'name') return 'led.err.form.periodName'
  if (path[0] === 'startsOn' || path[0] === 'endsOn') return 'led.err.form.periodRange'
  return 'led.err.form.generic'
}

/**
 * A fiscal period. Creating one needs a name and a range that touches no other period. Closing is final and the API
 * refuses it while the period still holds a draft entry, so the screen asks for a confirmation first.
 */
export function PeriodDialog({ period, onChanged, onClose }: Props) {
  const { t } = useI18n()
  const canManage = useCan(permissions.financePeriodManage)
  const [current, setCurrent] = useState<FiscalPeriod | null>(period ?? null)
  const [name, setName] = useState(period?.name ?? '')
  const [startsOn, setStartsOn] = useState(period?.startsOn ?? todayUtc())
  const [endsOn, setEndsOn] = useState(period?.endsOn ?? todayUtc())
  const [confirming, setConfirming] = useState(false)
  const [issues, setIssues] = useState<MessageKey[]>([])
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const { pending, failure, run } = useRunner()

  function create() {
    setIssues([])
    const parsed = createPeriodSchema.safeParse({ name, startsOn, endsOn })
    if (!parsed.success) {
      setIssues(Array.from(new Set(parsed.error.issues.map((issue) => issueOf(issue.path)))))
      return
    }
    void run(async () => {
      const created = await apiRequest<{ data: FiscalPeriod }>('/api/v1/finance/periods', { method: 'POST', body: parsed.data })
      setCurrent(created.data)
      setNotice('led.msg.periodCreated')
      onChanged('led.msg.periodCreated')
    })
  }

  function close() {
    if (!current) return
    void run(async () => {
      // The period came from the API, so its version always passes the schema the endpoint uses.
      const body = closePeriodSchema.parse({ version: current.version })
      const closed = await apiRequest<{ data: FiscalPeriod }>(`/api/v1/finance/periods/${current.id}/close`, { method: 'POST', body })
      setCurrent(closed.data)
      setConfirming(false)
      setNotice('led.msg.periodClosed')
      onChanged('led.msg.periodClosed')
    })
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className={noticeClass}>
          {t(notice)}
        </p>
      ) : null}

      {current ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Fact label={t('led.per.name')}>{current.name}</Fact>
          <Fact label={t('led.col.status')}>
            <PeriodStatusBadge status={current.status} />
          </Fact>
          <Fact label={t('led.per.startsOn')}>
            <Num>{current.startsOn}</Num>
          </Fact>
          <Fact label={t('led.per.endsOn')}>
            <Num>{current.endsOn}</Num>
          </Fact>
          {current.closedAt ? <Fact label={t('led.per.closedAt')}>{dateTimeText(current.closedAt)}</Fact> : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t('led.per.name')}>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className={inputClass} />
          </Field>
          <Field label={t('led.per.startsOn')}>
            <input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} dir="ltr" className={inputClass} />
          </Field>
          <Field label={t('led.per.endsOn')}>
            <input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} dir="ltr" className={inputClass} />
          </Field>
        </div>
      )}

      {current?.status === 'open' ? <p className="text-xs text-gray-500">{t('led.per.closeHint')}</p> : null}

      {confirming && current ? (
        <div className="space-y-3 rounded-xl border border-[#30363d] p-4">
          <p className="text-sm text-amber-300">{t('led.per.confirmClose')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={close} disabled={pending} className={dangerButton}>
              {pending ? t('erp.loading') : t('led.per.close')}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={secondaryButton}>
              {t('erp.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      <FormIssues issues={issues} />
      <LedgerFailure failure={failure} />

      <div className="flex flex-wrap justify-end gap-2 border-t border-[#30363d] pt-4">
        {!current && canManage ? (
          <button type="button" onClick={create} disabled={pending} className={primaryButton}>
            {pending ? t('erp.loading') : t('led.per.create')}
          </button>
        ) : null}
        {current?.status === 'open' && canManage && !confirming ? (
          <button type="button" onClick={() => setConfirming(true)} disabled={pending} className={dangerButton}>
            {t('led.per.close')}
          </button>
        ) : null}
        <button type="button" onClick={onClose} className={secondaryButton}>
          {t('erp.close')}
        </button>
      </div>
    </div>
  )
}
