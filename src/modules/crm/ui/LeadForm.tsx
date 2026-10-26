'use client'

import { FormEvent, useRef, useState } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { errorClass, inputClass, labelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { minorToInput, parseKwdToMinor, parseWholeNumber } from '@/lib/money'
import {
  createLeadSchema,
  openLeadStages,
  updateLeadSchema,
  type CustomerRef,
  type Lead,
  type OpenLeadStage,
  type TeamMember,
} from '@/modules/crm/client'
import { CustomerPicker } from '@/modules/crm/ui/CustomerPicker'
import { memberName, stageLabels } from '@/modules/crm/ui/shared'

type Props = {
  lead?: Lead
  /** Customer to start with when the form is opened from a customer profile. */
  customer?: CustomerRef
  team: TeamMember[]
  onSaved: (lead: Lead, message: MessageKey) => void
  onCancel: () => void
}

function issueMessage(path: ReadonlyArray<PropertyKey>): MessageKey {
  const [root] = path
  if (root === 'customerId') return 'crm.form.errCustomer'
  if (root === 'title') return 'crm.form.errTitle'
  if (root === 'expectedRevenueMinor') return 'crm.form.errRevenue'
  if (root === 'probability') return 'crm.form.errProbability'
  if (root === 'expectedCloseDate') return 'crm.form.errDate'
  return 'erp.form.errGeneric'
}

/** Creates or edits an open opportunity. A won or lost one is final and is not edited here. */
export function LeadForm({ lead, customer, team, onSaved, onCancel }: Props) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<CustomerRef | null>(customer ?? null)
  const [title, setTitle] = useState(lead?.title ?? '')
  const [revenue, setRevenue] = useState(lead ? minorToInput(lead.expectedRevenueMinor) : '')
  const [probability, setProbability] = useState(lead ? String(lead.probability) : '20')
  const [stage, setStage] = useState<OpenLeadStage>('new')
  const [assignedTo, setAssignedTo] = useState(lead?.assignedTo ?? '')
  const [closeDate, setCloseDate] = useState(lead?.expectedCloseDate ?? '')
  const [notes, setNotes] = useState(lead?.notes ?? '')
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [pending, setPending] = useState(false)
  const idempotencyKey = useRef(newIdempotencyKey())

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const shared = {
      title,
      expectedRevenueMinor: parseKwdToMinor(revenue) ?? Number.NaN,
      probability: parseWholeNumber(probability) ?? Number.NaN,
      assignedTo: assignedTo === '' ? null : assignedTo,
      expectedCloseDate: closeDate === '' ? null : closeDate,
      notes: notes.trim() === '' ? null : notes,
    }
    const parsed = lead
      ? updateLeadSchema.safeParse({ ...shared, version: lead.version })
      : createLeadSchema.safeParse({ ...shared, customerId: selected?.id ?? '', stage })
    if (!parsed.success) {
      setErrors(Array.from(new Set(parsed.error.issues.map((issue) => issueMessage(issue.path)))))
      return
    }
    setErrors([])
    setPending(true)
    try {
      const saved = lead
        ? await apiRequest<{ data: Lead }>(`/api/v1/crm/leads/${lead.id}`, { method: 'PATCH', body: parsed.data })
        : await apiRequest<{ data: Lead }>('/api/v1/crm/leads', {
            method: 'POST',
            body: parsed.data,
            idempotencyKey: idempotencyKey.current,
          })
      idempotencyKey.current = newIdempotencyKey()
      onSaved(saved.data, 'crm.msg.leadSaved')
    } catch (error) {
      setErrors([errorKey(error)])
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {lead ? (
        <div>
          <span className={labelClass}>{t('crm.lead.customer')}</span>
          <p className="mt-1.5 rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm font-semibold text-gray-100">{lead.customerName}</p>
        </div>
      ) : (
        <CustomerPicker value={selected} onChange={setSelected} label={t('crm.lead.customer')} />
      )}
      <label className={`${labelClass} block`}>
        {t('crm.lead.title')}
        <input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          {t('crm.lead.revenue')}
          <input inputMode="decimal" dir="ltr" value={revenue} onChange={(event) => setRevenue(event.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('crm.lead.probability')}
          <input inputMode="numeric" dir="ltr" value={probability} onChange={(event) => setProbability(event.target.value)} className={inputClass} />
        </label>
        {lead ? null : (
          <label className={labelClass}>
            {t('crm.lead.stage')}
            <select value={stage} onChange={(event) => setStage(event.target.value as OpenLeadStage)} className={inputClass}>
              {openLeadStages.map((value) => (
                <option key={value} value={value}>
                  {t(stageLabels[value])}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={labelClass}>
          {t('crm.lead.assignee')}
          <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className={inputClass}>
            <option value="">{t('crm.lead.noAssignee')}</option>
            {team.map((member) => (
              <option key={member.userId} value={member.userId}>
                {memberName(team, member.userId)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t('crm.lead.closeDate')}
          <input type="date" dir="ltr" value={closeDate} onChange={(event) => setCloseDate(event.target.value)} className={inputClass} />
        </label>
      </div>
      <label className={`${labelClass} block`}>
        {t('crm.lead.notes')}
        <textarea value={notes} rows={2} maxLength={2000} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
      </label>

      {errors.length > 0 ? (
        <ul role="alert" className={`${errorClass} space-y-1`}>
          {errors.map((message) => (
            <li key={message}>{t(message)}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? t('erp.working') : t('erp.save')}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t('erp.cancel')}
        </button>
      </div>
    </form>
  )
}
