'use client'

import { FormEvent, useState } from 'react'
import { apiRequest, errorKey } from '@/components/erp/api'
import { errorClass, inputClass, labelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { minorToInput, parseKwdToMinor } from '@/lib/money'
import {
  createCustomerSchema,
  customerStatuses,
  customerTypes,
  updateCustomerSchema,
  type Customer,
  type CustomerStatus,
  type CustomerType,
} from '@/modules/crm/client'
import { customerStatusLabels } from '@/modules/crm/ui/shared'

type Props = {
  customer?: Customer
  onSaved: (customer: Customer, message: MessageKey) => void
  onCancel: () => void
}

function issueMessage(path: ReadonlyArray<PropertyKey>): MessageKey {
  const [root] = path
  if (root === 'name') return 'crm.form.errName'
  if (root === 'email') return 'crm.form.errEmail'
  if (root === 'phone') return 'crm.form.errPhone'
  if (root === 'creditLimitMinor') return 'crm.form.errCredit'
  return 'erp.form.errGeneric'
}

export function CustomerForm({ customer, onSaved, onCancel }: Props) {
  const { t } = useI18n()
  const [name, setName] = useState(customer?.name ?? '')
  const [customerType, setCustomerType] = useState<CustomerType>(customer?.customerType ?? 'company')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [taxId, setTaxId] = useState(customer?.taxId ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [credit, setCredit] = useState(customer?.creditLimitMinor === null || customer === undefined ? '' : minorToInput(customer.creditLimitMinor))
  const [status, setStatus] = useState<CustomerStatus>(customer?.status ?? 'active')
  const [notes, setNotes] = useState(customer?.notes ?? '')
  const [errors, setErrors] = useState<MessageKey[]>([])
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const creditLimit = credit.trim() === '' ? null : (parseKwdToMinor(credit) ?? Number.NaN)
    const shared = { name, customerType, email, phone, taxId, address, creditLimitMinor: creditLimit, status, notes }
    const parsed = customer
      ? updateCustomerSchema.safeParse({ ...shared, version: customer.version })
      : createCustomerSchema.safeParse(shared)
    if (!parsed.success) {
      setErrors(Array.from(new Set(parsed.error.issues.map((issue) => issueMessage(issue.path)))))
      return
    }
    setErrors([])
    setPending(true)
    try {
      const saved = customer
        ? await apiRequest<{ data: Customer }>(`/api/v1/crm/customers/${customer.id}`, { method: 'PATCH', body: parsed.data })
        : await apiRequest<{ data: Customer }>('/api/v1/crm/customers', { method: 'POST', body: parsed.data })
      onSaved(saved.data, 'crm.msg.customerSaved')
    } catch (error) {
      setErrors([errorKey(error)])
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          {t('crm.cform.name')}
          <input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('crm.cform.type')}
          <select value={customerType} onChange={(event) => setCustomerType(event.target.value as CustomerType)} className={inputClass}>
            {customerTypes.map((value) => (
              <option key={value} value={value}>
                {t(value === 'company' ? 'crm.ctype.company' : 'crm.ctype.individual')}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t('crm.cform.status')}
          <select value={status} onChange={(event) => setStatus(event.target.value as CustomerStatus)} className={inputClass}>
            {customerStatuses.map((value) => (
              <option key={value} value={value}>
                {t(customerStatusLabels[value])}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-gray-400 sm:col-span-2">{t('crm.cform.statusHint')}</p>
        <label className={labelClass}>
          {t('crm.cform.email')}
          <input type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('crm.cform.phone')}
          <input type="tel" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('crm.cform.taxId')}
          <input dir="ltr" value={taxId} maxLength={40} onChange={(event) => setTaxId(event.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('crm.cform.credit')}
          <input inputMode="decimal" dir="ltr" value={credit} onChange={(event) => setCredit(event.target.value)} className={inputClass} />
        </label>
        <p className="-mt-2 text-xs text-gray-400 sm:col-span-2">{t('crm.cform.creditHint')}</p>
        <label className={`${labelClass} sm:col-span-2`}>
          {t('crm.cform.address')}
          <input value={address} maxLength={500} onChange={(event) => setAddress(event.target.value)} className={inputClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          {t('crm.cform.notes')}
          <textarea value={notes} rows={2} maxLength={2000} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
        </label>
      </div>

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
